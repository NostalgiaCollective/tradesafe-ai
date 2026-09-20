import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { randomBytes, randomUUID, createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import sharp from 'sharp'
import { APP_ORIGIN, API_ORIGIN, MAIL_ORIGIN, localEnvironment } from '../../scripts/ci/local-environment.mjs'
import { expectSuccess, expectDatabaseError } from '../../scripts/staging/assertions.mjs'
import { jpegAtSize } from '../fixtures/large-photo.mjs'

test.describe.configure({ mode: 'serial' })
const credentials = { email: 'owner-' + randomUUID() + '@example.test', password: randomBytes(24).toString('base64url') }
let owner, admin, companyId, reportId, photoId, exportId, original, photoHash, pdfHash
const address = 'SYNTHETIC WebKit local test site'
const caption = 'SYNTHETIC orange cone - local WebKit'
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const client = key => createClient(API_ORIGIN, key, { auth: { persistSession: false, autoRefreshToken: false } })
test.beforeAll(() => {
  localEnvironment({ API_URL: process.env.NEXT_PUBLIC_SUPABASE_URL, ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY })
  owner = client(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  admin = client(process.env.SUPABASE_SERVICE_ROLE_KEY)
})
test.beforeEach(async ({ context }) => {
  // No browser request may reach a hosted app, provider, analytics or external mailbox.
  await context.route('**/*', route => {
    const url = new URL(route.request().url())
    return [APP_ORIGIN, API_ORIGIN].includes(url.origin) ? route.continue() : route.abort('blockedbyclient')
  })
})
const saved = page => expect(page.locator('.save-state')).toHaveText('Saved')
async function login(page, account = credentials) {
  await page.goto('/auth/login')
  await page.getByLabel('Email', { exact: true }).fill(account.email)
  await page.getByLabel('Password', { exact: true }).fill(account.password)
  await page.getByRole('button', { name: 'Sign In', exact: true }).click()
  await page.waitForURL('**/dashboard')
}
async function mailLink() {
  // Mailpit is a local SMTP sink. Never return the message or token in reports.
  const response = await fetch(MAIL_ORIGIN + '/api/v1/messages', { redirect: 'error' })
  expect(response.status).toBe(200)
  const mailbox = await response.json()
  const message = mailbox.messages?.find(m => m.To?.some(to => to.Address === credentials.email))
  if (!message) return null
  const detail = await (await fetch(MAIL_ORIGIN + '/api/v1/message/' + message.ID, { redirect: 'error' })).json()
  const links = [...(detail.HTML || '').matchAll(/href=["']([^"']+)["']/g)].map(m => m[1].replaceAll('&amp;', '&'))
  const link = links.find(value => { try { const u = new URL(value); return u.origin === API_ORIGIN && u.pathname === '/auth/v1/verify' && u.searchParams.get('type') === 'signup' } catch { return false } })
  expect(Boolean(link)).toBe(true)
  const redirect = new URL(new URL(link).searchParams.get('redirect_to'))
  expect(redirect.origin).toBe(APP_ORIGIN); expect(redirect.pathname).toBe('/auth/callback')
  return link
}

test('WebKit sign-in, captured local confirmation, company setup and draft reload', async ({ page }) => {
  await page.goto('/auth/login')
  await page.getByRole('button', { name: 'Sign up', exact: true }).click()
  await page.getByLabel('Email', { exact: true }).fill(credentials.email)
  await page.getByLabel('Password', { exact: true }).fill(credentials.password)
  const response = page.waitForResponse(r => r.url().includes('/auth/v1/signup') && r.request().method() === 'POST')
  await page.getByRole('button', { name: 'Create Account', exact: true }).click()
  expect((await response).status()).toBe(200)
  await expect(page.getByRole('status')).toContainText('check your inbox')
  let link
  await expect.poll(async () => Boolean(link = await mailLink())).toBe(true)
  await page.goto(link) // Retain the initiating PKCE browser context.
  await page.waitForURL('**/dashboard')
  const auth = expectSuccess(await owner.auth.signInWithPassword(credentials))
  expect(Boolean(auth.user.email_confirmed_at)).toBe(true)
  await page.getByLabel('Business name', { exact: true }).fill('SYNTHETIC WebKit local company')
  await page.getByRole('button', { name: 'Create company', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Start a report', exact: true })).toBeVisible()
  companyId = expectSuccess(await owner.from('ts_members').select('company_id').single()).company_id
  await login(page) // Actual password sign-in, independently of callback success.
  await page.goto('/report/new?company=' + companyId)
  await page.getByRole('button', { name: 'Create saved draft', exact: true }).click()
  await page.waitForURL(/\/report\/[a-f0-9-]{36}$/)
  reportId = new URL(page.url()).pathname.split('/').at(-1)
  await page.getByLabel('Job address', { exact: true }).fill(address)
  await page.getByLabel('Work date', { exact: true }).fill('2026-09-20')
  await saved(page)
  await page.reload()
  await expect(page.getByLabel('Job address', { exact: true })).toHaveValue(address)
  await expect(page.getByLabel('Work date', { exact: true })).toHaveValue('2026-09-20')
  expect(expectSuccess(await owner.from('ts_reports').select('document').eq('id', reportId).single()).document.job.address).toBe(address)
})

test('WebKit actual photo upload, retained PDF, immutable finalization and amendment reload', async ({ page, context }) => {
  await login(page)
  await page.goto('/report/' + reportId)
  await page.getByRole('button', { name: '2. Observations', exact: true }).click()
  const answers = page.getByLabel('Observation', { exact: true })
  await expect(answers.first()).toBeVisible()
  expect(await answers.evaluateAll(es => es.every(e => e.value === 'unanswered'))).toBe(true)
  for (const answer of await answers.all()) await answer.selectOption('meets')
  await saved(page)
  await page.getByRole('link', { name: 'Add or review photos', exact: true }).click()
  const jpeg = await sharp(Buffer.from('<svg width="1000" height="800"><rect width="1000" height="800" fill="#17415a"/><path d="M500 120L260 650H740Z" fill="#ff8500"/><text x="70" y="740" fill="white" font-size="38">SYNTHETIC WEBKIT ORANGE CONE</text></svg>')).jpeg().toBuffer()
  await page.getByLabel('Photo file', { exact: true }).setInputFiles({ name: 'SYNTHETIC-orange-cone.jpg', mimeType: 'image/jpeg', buffer: jpegAtSize(jpeg, 3600000) })
  await page.getByLabel('Photo caption', { exact: true }).fill(caption)
  await page.getByRole('button', { name: 'Upload photo', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Photo saved and retained.' })).toBeVisible()
  await page.reload()
  await expect(page.getByText(caption, { exact: true })).toBeVisible()
  await expect.poll(() => page.getByRole('img', { name: caption, exact: true }).evaluate(e => e.complete && e.naturalWidth > 0)).toBe(true)
  const base = '/api/reports/' + reportId
  const photos = await (await context.request.get(base + '/evidence')).json()
  expect(photos.filter(p => p.state === 'ready')).toHaveLength(1)
  photoId = photos[0].id
  const photo = await context.request.get(base + '/evidence/' + photoId)
  expect(photo.status()).toBe(200); photoHash = hash(await photo.body())
  expect((await sharp(await photo.body()).metadata()).exif).toBeUndefined()
  await page.getByRole('button', { name: 'Continue to review', exact: true }).click()
  await page.getByRole('button', { name: 'Continue to finalize', exact: true }).click()
  await page.getByRole('checkbox').check()
  await expect(page.getByRole('button', { name: 'Finalize report', exact: true })).toBeEnabled()
  await page.getByRole('button', { name: 'Finalize report', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Open PDF', exact: true })).toBeEnabled()
  original = expectSuccess(await owner.from('ts_reports').select('*').eq('id', reportId).single())
  expect(original.lifecycle).toBe('finalized')
  const popup = page.waitForEvent('popup')
  await page.getByRole('button', { name: 'Open PDF', exact: true }).click()
  const viewer = await popup
  await expect(page.getByRole('link', { name: 'Open prepared PDF', exact: true })).toHaveAttribute('href', /^blob:/)
  await viewer.close()
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download PDF', exact: true }).click()
  const download = await downloadPromise
  const pdfPath = 'test-results/local-report.pdf'
  await download.saveAs(pdfPath)
  const job = await (await context.request.get(base + '/exports')).json()
  expect(job.state).toBe('ready'); exportId = job.id
  const pdf = await context.request.get(base + '/exports/' + exportId)
  expect(pdf.status()).toBe(200); expect(await pdf.body()).toEqual(readFileSync(pdfPath)); pdfHash = hash(await pdf.body())
  const text = execFileSync('pdftotext', [pdfPath, '-'], { encoding: 'utf8' })
  expect(text).toContain(address); expect(text).toContain(caption)
  await page.getByRole('link', { name: 'Make a correction', exact: true }).click()
  await page.getByLabel('Reason for amendment', { exact: true }).fill('SYNTHETIC WebKit local correction')
  await page.getByRole('button', { name: 'Create amendment', exact: true }).click()
  await page.waitForURL(u => /\/report\/[a-f0-9-]{36}$/.test(u.pathname) && !u.pathname.endsWith(reportId))
  await page.getByLabel('Client or job reference (optional)', { exact: true }).fill('SYNTHETIC correction persists')
  await saved(page); await page.reload()
  await expect(page.getByLabel('Client or job reference (optional)', { exact: true })).toHaveValue('SYNTHETIC correction persists')
  expect(expectSuccess(await owner.from('ts_reports').select('*').eq('id', reportId).single())).toEqual(original)
  const immutable = await context.request.post('/api/workspace', { headers: { origin: APP_ORIGIN }, data: { command: 'save_report', payload: { companyId, id: reportId, revision: original.revision, requestId: randomUUID(), document: original.document } } })
  expect(immutable.status()).toBe(409); expect((await immutable.json()).code).toBe('immutable')
  expect(hash(await (await context.request.get(base + '/evidence/' + photoId)).body())).toBe(photoHash)
  expect(hash(await (await context.request.get(base + '/exports/' + exportId)).body())).toBe(pdfHash)
})

test('WebKit cross-company, anonymous and revoked-member report/evidence/PDF denial', async ({ page, context, browser }) => {
  // Additional permission actors are provider-assisted local fixtures, not email signup evidence.
  const worker = { email: 'worker-' + randomUUID() + '@example.test', password: randomBytes(24).toString('base64url') }
  const user = expectSuccess(await admin.auth.admin.createUser({ ...worker, email_confirm: true })).user
  const ordinary = client(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  expectSuccess(await ordinary.auth.signInWithPassword(worker))
  const base = '/api/reports/' + reportId
  await login(page, worker)
  for (const path of [base + '/evidence', base + '/evidence/' + photoId, base + '/exports/' + exportId]) {
    const denied = await context.request.get(path); expect(denied.status()).toBe(404); expect((await denied.json()).code).toBe('not_found')
  }
  expect(expectSuccess(await ordinary.from('ts_reports').select('id').eq('company_id', companyId))).toEqual([])
  expectDatabaseError(await ordinary.from('ts_reports').update({ lifecycle: 'draft' }).eq('id', reportId), '42501')
  const token = randomBytes(32).toString('hex')
  expectSuccess(await owner.rpc('ts_command', { command: 'invite', p: { companyId, email: worker.email, role: 'worker', token } }))
  expectSuccess(await ordinary.rpc('ts_command', { command: 'accept_invitation', p: { token } }))
  expect((await context.request.get(base + '/evidence/' + photoId)).status()).toBe(200)
  expect((await context.request.get(base + '/exports/' + exportId)).status()).toBe(200)
  expectDatabaseError(await ordinary.rpc('ts_command', { command: 'member', p: { companyId, userId: user.id, role: 'owner' } }), 'TS_denied')
  expectSuccess(await owner.rpc('ts_command', { command: 'member', p: { companyId, userId: user.id, role: 'remove' } }))
  expect((await page.goto('/report/' + reportId)).status()).toBe(404)
  for (const path of [base + '/evidence/' + photoId, base + '/exports/' + exportId]) expect((await context.request.get(path)).status()).toBe(404)
  expect((await context.request.post(base + '/exports', { headers: { origin: APP_ORIGIN } })).status()).toBe(404)
  const deniedSave = await context.request.post('/api/workspace', { headers: { origin: APP_ORIGIN }, data: { command: 'save_report', payload: { companyId, id: reportId, requestId: randomUUID(), revision: original.revision, document: original.document } } })
  expect([403, 404]).toContain(deniedSave.status()); expect(['denied', 'not_found']).toContain((await deniedSave.json()).code)
  const anonymous = await browser.newContext()
  try { expect((await anonymous.request.get(APP_ORIGIN + base + '/exports/' + exportId)).status()).toBe(401) } finally { await anonymous.close() }
})
