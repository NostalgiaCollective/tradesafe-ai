import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { randomUUID, randomBytes } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { requireStaging } from '../../scripts/staging/config.mjs'
import { expectSuccess } from '../../scripts/staging/assertions.mjs'
import { getTemplate } from '../../lib/domain/templates.ts'

let env
test.beforeEach(() => {
  const config = requireStaging()
  if (!config) throw new Error('BLOCKED: verified isolated configuration required')
  env = config.env
})
async function login(page, role) {
  await page.goto('/auth/login')
  await page.getByLabel('Email', { exact: true }).fill(env['STAGING_' + role + '_EMAIL'])
  await page.getByLabel('Password', { exact: true }).fill(env['STAGING_' + role + '_PASSWORD'])
  await page.getByRole('button', { name: 'Sign In', exact: true }).click()
  await page.waitForURL('**/dashboard')
}
async function fixture() {
  const clients = {}
  try {
    for (const role of ['OWNER', 'WORKER', 'SUPERVISOR']) {
      const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        { auth: { persistSession: false, autoRefreshToken: false } })
      clients[role] = { client }
      const auth = await client.auth.signInWithPassword({ email: env['STAGING_' + role + '_EMAIL'], password: env['STAGING_' + role + '_PASSWORD'] })
      if (auth.error) throw new Error('Synthetic fixture authentication failed')
      const verified = await client.auth.getUser()
      if (verified.error || !verified.data.user?.email_confirmed_at) throw new Error('Verified synthetic identity required')
      clients[role].user = verified.data.user
    }
    const companyId = randomUUID()
    const command = async (role, command, p = {}) => expectSuccess(await clients[role].client.rpc('ts_command', {
      command, p: { companyId, requestId: randomUUID(), ...p },
    }))
    await command('OWNER', 'create_company', { id: companyId, name: 'SYNTHETIC browser company' })
    for (const role of ['WORKER', 'SUPERVISOR']) {
      const token = randomBytes(32).toString('hex')
      await command('OWNER', 'invite', { email: clients[role].user.email, role: role.toLowerCase(), token })
      await command(role, 'accept_invitation', { token })
    }
    return { clients, companyId, command, close: async () => {
      for (const { client } of Object.values(clients)) await client.auth.signOut({ scope: 'local' })
    } }
  } catch (error) {
    for (const { client } of Object.values(clients)) await client.auth.signOut({ scope: 'local' }).catch(() => {})
    throw error
  }
}
const saved = page => expect(page.locator('.save-state')).toHaveText('Saved')
async function draft(page, companyId) {
  await page.goto('/report/new?company=' + companyId)
  await page.getByRole('button', { name: 'Create saved draft', exact: true }).click()
  await page.waitForURL(/\/report\/[a-f0-9-]{36}$/)
  return new URL(page.url()).pathname.split('/').at(-1)
}
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done }); return { promise, resolve } }

test('Fresh company onboarding through the interface', async ({ page }, info) => {
  // Run this first with unused identities. Repeated runs do not delete prior companies.
  await login(page, info.project.name === 'phone' ? 'OUTSIDER' : 'OWNER')
  test.skip(!await page.getByRole('heading', { name: 'Start your company workspace' }).count(),
    'BLOCKED: this scenario needs an unused synthetic identity; existing records are preserved')
  await page.getByLabel('Business name', { exact: true }).fill('SYNTHETIC first company')
  await page.getByRole('button', { name: 'Create company', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Reports', exact: true })).toBeVisible()
  await expect(page.locator('#company-switch option:checked')).toHaveText('SYNTHETIC first company')
})

test('Durable drafts: lost responses, queued edits, network retry, refresh and concurrent tabs', async ({ page, context }) => {
  const f = await fixture()
  try {
    await login(page, 'WORKER')
    let createdId, loseCreation = true
    await page.route('**/api/workspace', async route => {
      if (route.request().postDataJSON().command === 'create_report' && loseCreation) {
        loseCreation = false
        const response = await route.fetch()
        expect(response.status()).toBe(200)
        createdId = (await response.json()).id
        await route.abort('failed') // Real commit, deliberately lost response.
      } else await route.continue()
    })
    await page.goto('/report/new?company=' + f.companyId)
    await page.getByRole('button', { name: 'Create saved draft', exact: true }).click()
    await expect(page.getByRole('alert')).toContainText('Not saved')
    await page.getByRole('button', { name: 'Retry creating draft', exact: true }).click()
    await page.waitForURL('**/report/' + createdId)
    await page.unrouteAll({ behavior: 'wait' })
    const record = () => f.clients.WORKER.client.from('ts_reports').select('*').eq('id', createdId).single()
    const commit = deferred(), release = deferred()
    let held = false
    await page.route('**/api/workspace', async route => {
      if (route.request().postDataJSON().command === 'save_report' && !held) {
        held = true
        const response = await route.fetch()
        expect(response.status()).toBe(200)
        commit.resolve()
        await release.promise
        await route.fulfill({ response })
      } else await route.continue()
    })
    await page.getByLabel('Job address', { exact: true }).fill('SYNTHETIC earlier edit')
    await commit.promise
    await expect(page.locator('.save-state')).toHaveText('Saving')
    await page.getByLabel('Job address', { exact: true }).fill('SYNTHETIC queued edit')
    release.resolve()
    await saved(page)
    expect(expectSuccess(await record()).document.job.address).toBe('SYNTHETIC queued edit')
    await page.unrouteAll({ behavior: 'wait' })
    await page.reload()
    await expect(page.getByLabel('Job address', { exact: true })).toHaveValue('SYNTHETIC queued edit')
    let lost = false
    await page.route('**/api/workspace', async route => {
      if (route.request().postDataJSON().command === 'save_report' && !lost) {
        lost = true
        expect((await route.fetch()).status()).toBe(200)
        await route.abort('failed')
      } else await route.continue()
    })
    await page.getByLabel('Job address', { exact: true }).fill('SYNTHETIC lost save response')
    await expect(page.getByRole('alert')).toContainText('Not saved')
    const revision = expectSuccess(await record()).revision
    await page.getByRole('button', { name: 'Retry saving', exact: true }).click()
    await saved(page)
    expect(expectSuccess(await record()).revision).toBe(revision)
    await page.unrouteAll({ behavior: 'wait' })
    await context.setOffline(true)
    await page.getByLabel('Job address', { exact: true }).fill('SYNTHETIC network retry')
    await expect(page.getByRole('alert')).toContainText('Keep this page open')
    await expect(page.locator('.work-footnote')).toContainText('offline persistence is not provided')
    await context.setOffline(false)
    await page.getByRole('button', { name: 'Retry saving', exact: true }).click()
    await saved(page)
    const other = await context.newPage()
    await other.goto('/report/' + createdId)
    await expect(other.getByLabel('Job address', { exact: true })).toHaveValue('SYNTHETIC network retry')
    await page.getByLabel('Job address', { exact: true }).fill('SYNTHETIC winning edit')
    await saved(page)
    await other.getByLabel('Job address', { exact: true }).fill('SYNTHETIC stale edit')
    await expect(other.getByRole('alert')).toContainText('newer version')
    await expect(other.getByLabel('Job address', { exact: true })).toHaveValue('SYNTHETIC stale edit')
    expect(expectSuccess(await record()).document.job.address).toBe('SYNTHETIC winning edit')
    await other.close()
    await page.goto('/dashboard?company=' + f.companyId)
    await page.getByRole('link', { name: /SYNTHETIC winning edit/ }).click()
    await expect(page.getByLabel('Job address', { exact: true })).toHaveValue('SYNTHETIC winning edit')
  } finally { await context.setOffline(false); await f.close() }
})

test('Truthful review, immutable amendment, payment endpoints, action verification and membership removal', async ({ page, browser }, info) => {
  const f = await fixture(), extra = []
  try {
    await login(page, 'OWNER')
    await page.goto('/settings?company=' + f.companyId)
    await page.getByLabel('Contact phone (optional)', { exact: true }).fill('555-0105')
    await page.getByRole('button', { name: 'Save business details', exact: true }).click()
    await expect(page.getByRole('status')).toContainText('Company details saved')
    await page.getByRole('button', { name: 'Sign out', exact: true }).click()
    await page.waitForURL('/')
    await login(page, 'WORKER')
    const id = await draft(page, f.companyId)
    await expect(page.getByText('contact phone: 555-0105')).toBeVisible()
    await page.getByLabel('Job address', { exact: true }).fill('SYNTHETIC unresolved site')
    await page.getByLabel('Work date', { exact: true }).fill('2026-09-12')
    await page.getByRole('button', { name: /3.*Observations/ }).click()
    const answers = page.locator('select[id^="answer-"]')
    await expect(answers).toHaveCount(getTemplate('electrical').items.length)
    expect(await answers.evaluateAll(nodes => nodes.every(node => node.value === 'unanswered'))).toBe(true)
    await page.getByRole('button', { name: /4.*Review/ }).click()
    await expect(page.getByRole('button', { name: 'Finalize observations', exact: true })).toBeDisabled()
    await page.getByRole('button', { name: /3.*Observations/ }).click()
    for (const answer of await answers.all()) await answer.selectOption('meets')
    await answers.first().selectOption('attention')
    await page.getByLabel('Explanation (required)', { exact: true }).fill('SYNTHETIC damaged enclosure')
    await page.getByLabel('Immediate controls or action taken (if any)', { exact: true }).fill('SYNTHETIC area kept clear')
    await saved(page)
    mkdirSync('test-results/staging-evidence', { recursive: true })
    await page.screenshot({ path: 'test-results/staging-evidence/' + info.project.name + '-observations.png', fullPage: false })
    const accessibility = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth > innerWidth,
      unlabelled: [...document.querySelectorAll('input:not([type=hidden]),select,textarea')].filter(e => !e.labels?.length && !e.getAttribute('aria-label')).length,
      shortButtons: [...document.querySelectorAll('button')].filter(e => e.getBoundingClientRect().height > 0 && e.getBoundingClientRect().height < 48).length,
    }))
    expect(accessibility).toEqual({ overflow: false, unlabelled: 0, shortButtons: 0 })
    await page.keyboard.press('Tab')
    expect(await page.evaluate(() => document.activeElement.matches(':focus-visible'))).toBe(true)
    await page.getByRole('button', { name: /4.*Review/ }).click()
    await expect(page.getByRole('heading', { name: '1 unresolved concerns' })).toBeVisible()
    await page.getByRole('checkbox').check()
    await page.getByRole('button', { name: 'Finalize observations', exact: true }).click()
    await expect(page.getByRole('heading', { name: '1 concerns recorded at finalization' })).toBeVisible()
    const original = expectSuccess(await f.clients.WORKER.client.from('ts_reports').select('*').eq('id', id).single())
    for (const endpoint of ['/api/checkout', '/api/checkout/verify']) {
      const result = await page.evaluate(async endpoint => {
        const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
        return { status: response.status, body: await response.json() }
      }, endpoint)
      expect(result.status).toBe(503); expect(result.body.code).toBe('deferred')
    }
    await page.emulateMedia({ media: 'print' })
    await expect(page.locator('.inspection-print')).toBeVisible()
    expect(await page.locator('.no-print').evaluateAll(nodes => nodes.every(node => getComputedStyle(node).display === 'none'))).toBe(true)
    await expect(page.locator('.inspection-print')).toContainText('does not certify compliance')
    await page.emulateMedia({ media: 'screen' })
    await page.getByLabel('Reason for amendment', { exact: true }).fill('SYNTHETIC correction')
    await page.getByRole('button', { name: 'Create amendment', exact: true }).click()
    await page.waitForURL(url => /\/report\/[a-f0-9-]{36}$/.test(url.pathname) && !url.pathname.endsWith(id))
    expect(expectSuccess(await f.clients.WORKER.client.from('ts_reports').select('*').eq('id', id).single())).toEqual(original)
    const supervisorContext = await browser.newContext({ baseURL: env.NEXT_PUBLIC_APP_URL, viewport: info.project.use.viewport })
    extra.push(supervisorContext)
    const supervisorPage = await supervisorContext.newPage()
    await login(supervisorPage, 'SUPERVISOR')
    await supervisorPage.goto('/actions?company=' + f.companyId)
    await supervisorPage.getByLabel('Assigned to me', { exact: true }).uncheck()
    await supervisorPage.getByLabel('Responsible member', { exact: true }).selectOption(f.clients.SUPERVISOR.user.id)
    await supervisorPage.getByLabel('Resolution notes (required for verification)', { exact: true }).fill('SYNTHETIC repair checked')
    await supervisorPage.getByLabel('Action state', { exact: true }).selectOption('closed')
    await supervisorPage.getByRole('button', { name: 'Save action update', exact: true }).click()
    await expect(supervisorPage.getByRole('status')).toContainText('saved')
    await supervisorPage.getByLabel('Include closed actions', { exact: true }).check()
    await supervisorPage.getByLabel('Action state', { exact: true }).selectOption('open')
    await supervisorPage.getByRole('button', { name: 'Reopen action', exact: true }).click()
    await expect(supervisorPage.getByRole('status')).toContainText('saved')
    const actions = expectSuccess(await f.clients.OWNER.client.from('ts_actions').select('*').eq('report_id', id))
    expect(actions[0].state).toBe('open')
    const history = expectSuccess(await f.clients.OWNER.client.from('ts_events').select('*').eq('entity_id', actions[0].id))
    expect(history.some(e => e.before_value?.verified_by === f.clients.SUPERVISOR.user.id)).toBe(true)
    await f.command('OWNER', 'member', { userId: f.clients.WORKER.user.id, role: 'remove' })
    const inaccessible = await page.goto('/report/' + id)
    expect(inaccessible.status()).toBe(404)
  } finally { for (const context of extra) await context.close(); await f.close() }
})

test('Session loss preserves in-memory edits; a different account does not inherit the editor', async ({ page, context }) => {
  const f = await fixture()
  try {
    await login(page, 'WORKER')
    await draft(page, f.companyId)
    await page.getByLabel('Job address', { exact: true }).fill('SYNTHETIC saved before session loss')
    await saved(page)
    await context.clearCookies() // Session-loss recovery, not a claim of timed JWT-expiry verification.
    await page.getByLabel('Job address', { exact: true }).fill('SYNTHETIC recoverable edit')
    await expect(page.getByRole('alert')).toContainText('sign in')
    await expect(page.getByLabel('Job address', { exact: true })).toHaveValue('SYNTHETIC recoverable edit')
    const signIn = await context.newPage()
    await login(signIn, 'WORKER')
    await page.getByRole('button', { name: 'Retry saving', exact: true }).click()
    await saved(page)
    await login(signIn, 'OUTSIDER')
    await page.waitForURL('**/dashboard')
    await expect(page.locator('#job-address')).toHaveCount(0)
    await signIn.getByRole('button', { name: 'Sign out', exact: true }).click()
    await signIn.waitForURL('/')
    await signIn.goto('/dashboard')
    await signIn.waitForURL('**/auth/login?**')
  } finally { await f.close() }
})
test('Owner invitation UI, intended acceptance, company switching and removal with an existing browser session', async ({ page, browser }, info) => {
  const f = await fixture(), extra = []
  try {
    await login(page, 'OWNER')
    await page.goto('/settings?company=' + f.companyId)
    const ownRow = page.locator('li').filter({ has: page.locator('#role-' + f.clients.OWNER.user.id) })
    page.once('dialog', dialog => dialog.accept())
    await ownRow.getByRole('button', { name: 'Remove access', exact: true }).click()
    await expect(page.getByRole('status')).toContainText('last owner')
    await page.getByLabel('Their sign-in email', { exact: true }).fill(env.STAGING_OUTSIDER_EMAIL)
    await page.getByLabel('Access role', { exact: true }).last().selectOption('worker')
    await page.getByRole('button', { name: 'Create invitation link', exact: true }).click()
    const linkField = page.getByLabel('Private invitation link', { exact: true })
    await expect(linkField).toBeVisible()
    const privateLink = await linkField.inputValue() // Never log, trace or screenshot this value.
    const context = await browser.newContext({ baseURL: env.NEXT_PUBLIC_APP_URL, viewport: info.project.use.viewport })
    extra.push(context)
    const invited = await context.newPage()
    await login(invited, 'SUPERVISOR')
    await invited.goto(privateLink)
    await invited.getByRole('button', { name: 'Accept invitation', exact: true }).click()
    await expect(invited.getByRole('alert')).toContainText('different verified email')
    await login(invited, 'OUTSIDER')
    await invited.goto(privateLink)
    await invited.getByRole('button', { name: 'Accept invitation', exact: true }).click()
    await invited.waitForURL('**/dashboard?company=' + f.companyId)
    const switcher = invited.locator('#company-switch')
    await expect(switcher).toHaveValue(f.companyId)
    let previous = await switcher.locator('option').evaluateAll((options, current) => options.map(o => o.value).find(id => id !== current), f.companyId)
    if (!previous) {
      // A second synthetic company is fixture setup through the real authenticated API.
      previous = randomUUID()
      const result = await invited.evaluate(async id => {
        const response = await fetch('/api/workspace', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ command: 'create_company', payload: { id, name: 'SYNTHETIC switch destination' } }) })
        return { status: response.status, body: await response.json() }
      }, previous)
      expect(result.status).toBe(200); expect(result.body.id).toBe(previous)
      await invited.reload()
    }
    await switcher.selectOption(previous)
    await invited.getByRole('button', { name: 'Switch company', exact: true }).click()
    await expect(invited.locator('#company-switch')).toHaveValue(previous)
    await invited.locator('#company-switch').selectOption(f.companyId)
    await invited.getByRole('button', { name: 'Switch company', exact: true }).click()
    await page.reload()
    const member = expectSuccess(await f.clients.OWNER.client.from('ts_members').select('user_id')
      .eq('company_id', f.companyId).eq('display_name', env.STAGING_OUTSIDER_EMAIL.toLowerCase()).single())
    const row = page.locator('li').filter({ has: page.locator('#role-' + member.user_id) })
    page.once('dialog', dialog => dialog.accept())
    await row.getByRole('button', { name: 'Remove access', exact: true }).click()
    await expect(row).toHaveCount(0)
    await invited.reload()
    await invited.waitForURL('**/access-denied')
  } finally { for (const context of extra) await context.close(); await f.close() }
})
