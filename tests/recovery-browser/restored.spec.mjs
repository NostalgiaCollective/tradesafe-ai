import { test, expect, devices } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync } from 'node:fs'
import { randomUUID, createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { APP_ORIGIN, API_ORIGIN, localEnvironment } from '../../scripts/ci/local-environment.mjs'
import { expectSuccess, expectDatabaseError } from '../../scripts/staging/assertions.mjs'

test('Restored WebKit: identities, drafts, evidence, PDF, amendments, history and access boundaries', async ({ browser }) => {
  localEnvironment({ API_URL: process.env.NEXT_PUBLIC_SUPABASE_URL, ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY })
  const f = JSON.parse(readFileSync('.ci-local/recovery-fixture.json', 'utf8'))
  writeFileSync('test-results/local-recovery-runtime.json', JSON.stringify({ webkit: browser.version(), playwright: JSON.parse(readFileSync('node_modules/@playwright/test/package.json', 'utf8')).version }))
  const hash = bytes => createHash('sha256').update(bytes).digest('hex')
  const ordinary = async credentials => {
    const c = createClient(API_ORIGIN, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
    expectSuccess(await c.auth.signInWithPassword(credentials)); return c
  }
  const login = async credentials => {
    const context = await browser.newContext({ ...devices['iPhone 13'] })
    await context.route('**/*', route => [APP_ORIGIN, API_ORIGIN].includes(new URL(route.request().url()).origin) ? route.continue() : route.abort('blockedbyclient'))
    const page = await context.newPage(); await page.goto(APP_ORIGIN + '/auth/login')
    await page.getByLabel('Email', { exact: true }).fill(credentials.email)
    await page.getByLabel('Password', { exact: true }).fill(credentials.password)
    await page.getByRole('button', { name: 'Sign In', exact: true }).click(); await page.waitForURL('**/dashboard')
    return { context, page }
  }
  const owner = await ordinary(f.owner), worker = await ordinary(f.worker), outsider = await ordinary(f.outsider)
  const member = expectSuccess(await worker.from('ts_members').select('role').eq('company_id', f.companyId).eq('user_id', (await worker.auth.getUser()).data.user.id).single())
  expect(member.role).toBe('worker')
  for (const [table, id, expected] of [['ts_reports', f.reportId, f.original], ['ts_reports', f.amendment.id, f.amendment], ['ts_reports', f.draft.id, f.draft], ['ts_actions', f.action.id, f.action]]) {
    expect(expectSuccess(await owner.from(table).select('*').eq('id', id).single())).toEqual(expected)
  }
  expect(expectSuccess(await owner.from('ts_events').select('*').eq('entity_id', f.action.id).order('id'))).toEqual(f.history)
  expect(f.history.filter(e => e.kind === 'action_updated')).toHaveLength(4)
  expect(f.action.state).toBe('closed'); expect(f.action.verified_by).toBeTruthy(); expect(f.action.verified_at).toBeTruthy()
  const base = APP_ORIGIN + '/api/reports/' + f.reportId
  const urls = [base + '/evidence/' + f.photoId, base + '/exports/' + f.exportId]
  for (const credentials of [f.owner, f.worker]) {
    const { context, page } = await login(credentials)
    try {
      expect((await page.goto(APP_ORIGIN + '/report/' + f.reportId)).status()).toBe(200)
      for (const [index, url] of urls.entries()) {
        const response = await context.request.get(url); expect(response.status()).toBe(200)
        expect(hash(await response.body())).toBe(index ? f.pdfHash : f.photoHash)
        if (index === 1) {
          writeFileSync('test-results/restored.pdf', await response.body())
          const text = execFileSync('pdftotext', ['test-results/restored.pdf', '-'], { encoding: 'utf8' })
          expect(text).toContain('SYNTHETIC WebKit local test site'); expect(text).toContain('SYNTHETIC orange cone - local WebKit')
        }
      }
      const photos = await (await context.request.get(base + '/evidence')).json()
      expect(photos[0].caption).toBe('SYNTHETIC orange cone - local WebKit')
      const immutable = await context.request.post(APP_ORIGIN + '/api/workspace', { headers: { origin: APP_ORIGIN }, data: { command: 'save_report', payload: { companyId: f.companyId, id: f.reportId, revision: f.original.revision, requestId: randomUUID(), document: f.original.document } } })
      expect([403, 409]).toContain(immutable.status())
      if (credentials === f.worker) {
        await page.goto(APP_ORIGIN + '/report/' + f.draft.id)
        await expect(page.getByLabel('Job address', { exact: true })).toHaveValue(f.draft.document.job.address)
        await page.getByLabel('Client or job reference (optional)', { exact: true }).fill('SYNTHETIC saved after restore')
        await expect(page.locator('.save-state')).toHaveText('Saved'); await page.reload()
        await expect(page.getByLabel('Client or job reference (optional)', { exact: true })).toHaveValue('SYNTHETIC saved after restore')
      }
    } finally { await context.close() }
  }
  // Restored RLS and immutable triggers are exercised, not merely catalog-inspected.
  expectDatabaseError(await owner.from('ts_reports').update({ lifecycle: 'draft' }).eq('id', f.reportId), '42501')
  expect(expectSuccess(await outsider.from('ts_reports').select('id').eq('company_id', f.companyId))).toEqual([])
  for (const credentials of [f.outsider, f.revoked]) {
    const { context, page } = await login(credentials)
    try {
      expect((await page.goto(APP_ORIGIN + '/report/' + f.reportId)).status()).toBe(404)
      for (const url of urls) expect((await context.request.get(url)).status()).toBe(404)
      const denied = await context.request.post(APP_ORIGIN + '/api/workspace', { headers: { origin: APP_ORIGIN }, data: { command: 'save_report', payload: { companyId: f.companyId, id: f.draft.id, revision: f.draft.revision, requestId: randomUUID(), document: f.draft.document } } })
      expect([403, 404]).toContain(denied.status())
    } finally { await context.close() }
  }
  const anonymous = await browser.newContext()
  try { for (const url of urls) expect((await anonymous.request.get(url)).status()).toBe(401) } finally { await anonymous.close() }
  const photo = expectSuccess(await owner.from('ts_evidence').select('*').eq('id', f.photoId).single())
  expect((await worker.storage.from('tradesafe-evidence').download(photo.object_path)).error).toBeTruthy()
  expect(expectSuccess(await owner.from('ts_reports').select('*').eq('id', f.reportId).single())).toEqual(f.original)
  expect(expectSuccess(await owner.from('ts_reports').select('*').eq('id', f.amendment.id).single())).toEqual(f.amendment)
})
