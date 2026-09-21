import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { randomBytes, randomUUID, createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import sharp from 'sharp'
import { APP_ORIGIN, API_ORIGIN, localEnvironment } from '../../scripts/ci/local-environment.mjs'
import { expectSuccess, expectDatabaseError } from '../../scripts/staging/assertions.mjs'
import { getTemplate, buildChecklistState } from '../../lib/domain/templates.ts'
import { assertPhoneLayout, selectedPhotoNavigation } from '../fixtures/report-usability.mjs'

// No hosted credentials or configurable targets. All business writes use ordinary users.
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const saved = page => expect(page.locator('.save-state')).toHaveText('Saved')
const output = 'test-results/trade-journeys'
for (const trade of ['plumbing', 'roofing']) {
  test('WebKit ' + trade + ': saved observations, private photo/PDF, correction and verified follow-up', async ({ browser }) => {
    localEnvironment({ API_URL: process.env.NEXT_PUBLIC_SUPABASE_URL, ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY })
    const config = { auth: { persistSession: false, autoRefreshToken: false } }
    const client = key => createClient(API_ORIGIN, key, config)
    const admin = client(process.env.SUPABASE_SERVICE_ROLE_KEY), contexts = [], actors = {}
    const template = getTemplate(trade), companyId = randomUUID(), address = 'SYNTHETIC ' + trade + ' WebKit site'
    const receipt = { trade, commit: process.env.GITHUB_SHA, status: 'running', checks: [], startedAt: new Date().toISOString() }
    mkdirSync(output, { recursive: true })
    const record = name => { receipt.checks.push(name); writeFileSync(output + '/' + trade + '.json', JSON.stringify(receipt, null, 2)) }
    const cmd = async (actor, command, payload) => expectSuccess(await actor.client.rpc('ts_command', { command, p: { companyId, requestId: randomUUID(), ...payload } }))
    async function actor(role) {
      const credentials = { email: trade + '-' + role + '-' + randomUUID() + '@example.test', password: randomBytes(24).toString('base64url') }
      const user = expectSuccess(await admin.auth.admin.createUser({ ...credentials, email_confirm: true })).user
      const ordinary = client(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
      expectSuccess(await ordinary.auth.signInWithPassword(credentials))
      return { ...credentials, id: user.id, client: ordinary }
    }
    async function login(a) {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' })
      contexts.push(context)
      await context.route('**/*', route => [APP_ORIGIN, API_ORIGIN].includes(new URL(route.request().url()).origin) ? route.continue() : route.abort('blockedbyclient'))
      const page = await context.newPage()
      await page.goto(APP_ORIGIN + '/auth/login')
      await page.getByLabel('Email', { exact: true }).fill(a.email)
      await page.getByLabel('Password', { exact: true }).fill(a.password)
      await page.getByRole('button', { name: 'Sign In', exact: true }).click()
      await page.waitForURL('**/dashboard')
      return page
    }
    try {
      for (const role of ['owner', 'worker', 'supervisor', 'outsider']) actors[role] = await actor(role)
      const { owner, worker, supervisor, outsider } = actors
      await cmd(owner, 'create_company', { id: companyId, name: 'SYNTHETIC ' + trade + ' crew' })
      await cmd(outsider, 'create_company', { id: randomUUID(), name: 'SYNTHETIC other ' + trade + ' crew' })
      for (const role of ['worker', 'supervisor']) {
        const token = randomBytes(32).toString('hex')
        await cmd(owner, 'invite', { email: actors[role].email, role, token })
        await cmd(actors[role], 'accept_invitation', { token })
      }
      const page = await login(worker), context = page.context()
      await page.goto(APP_ORIGIN + '/dashboard?company=' + companyId)
      await page.getByRole('link', { name: 'Start new report', exact: true }).click()
      await page.getByLabel('Trade', { exact: true }).selectOption(trade)
      await page.getByRole('button', { name: 'Create saved draft', exact: true }).click()
      await page.waitForURL(/\/report\/[a-f0-9-]{36}$/)
      const reportId = new URL(page.url()).pathname.split('/').at(-1), base = APP_ORIGIN + '/api/reports/' + reportId
      const report = async (id = reportId) => expectSuccess(await worker.client.from('ts_reports').select('*').eq('id', id).single())
      expect((await report()).template_snapshot).toEqual(template)
      expect((await report()).document.answers).toEqual(buildChecklistState(trade))
      await expect(page.locator('.work-title .eyebrow')).toContainText(trade)
      await expect(page.getByText('Questions pending qualified review.', { exact: false })).toBeVisible()
      await page.getByLabel('Job address', { exact: true }).fill(address)
      await page.getByLabel('Work date', { exact: true }).fill('2026-09-20')
      await saved(page)
      await page.goto(APP_ORIGIN + '/dashboard?company=' + companyId)
      await page.locator('.report-rows a').filter({ hasText: address }).click()
      await expect(page.getByLabel('Job address', { exact: true })).toHaveValue(address)
      await expect(page.locator('.work-title .eyebrow')).toContainText(trade)
      await page.getByRole('button', { name: 'Continue to observations', exact: true }).click()
      const groups = page.locator('.observation-section h3 button'), answers = page.getByLabel('Observation', { exact: true })
      const categories = [...new Set(template.items.map(i => i.category))]
      await expect(answers).toHaveCount(template.items.length)
      await expect(groups).toHaveCount(categories.length)
      for (const [i, category] of categories.entries()) await expect(groups.nth(i)).toContainText(category)
      expect(await answers.evaluateAll(es => es.every(e => e.value === 'unanswered'))).toBe(true)
      await expect(page.getByRole('status').filter({ hasText: '0 of ' + template.items.length + ' answered' })).toBeVisible()
      await assertPhoneLayout(page)
      await page.screenshot({ path: output + '/' + trade + '-observations.png', fullPage: true })
      let current = await report()
      expectDatabaseError(await worker.client.rpc('ts_command', { command: 'finalize', p: { companyId, id: reportId, revision: current.revision, requestId: randomUUID(), acknowledged: true } }), 'TS_incomplete')
      // Exercise all supported states and required reasons; immediate controls remain optional.
      for (const [index, state] of ['attention', 'not_applicable', 'unable'].entries()) {
        const item = template.items[index], note = 'SYNTHETIC ' + trade + ' ' + state + ' explanation'
        await page.getByLabel('Unanswered only', { exact: true }).check()
        await page.locator('#answer-' + item.id).selectOption(state)
        await expect(page.locator('#note-' + item.id)).toBeVisible()
        await expect(page.locator('#controls-' + item.id)).toHaveCount(state === 'not_applicable' ? 0 : 1)
        await saved(page)
        current = await report()
        expectDatabaseError(await worker.client.rpc('ts_command', { command: 'finalize', p: { companyId, id: reportId, revision: current.revision, requestId: randomUUID(), acknowledged: true } }), 'TS_incomplete')
        await groups.first().click() // Review must reveal a field hidden by section AND filter.
        await page.getByRole('button', { name: 'Continue to review', exact: true }).click()
        await page.getByRole('link', { name: item.question + ': add an explanation.', exact: true }).click()
        await expect(page.getByLabel('Unanswered only', { exact: true })).not.toBeChecked()
        await expect(groups.first()).toHaveAttribute('aria-expanded', 'true')
        await expect(page.locator('#note-' + item.id)).toBeFocused()
        await page.locator('#note-' + item.id).fill(note)
        if (state === 'attention') await page.locator('#controls-' + item.id).fill('SYNTHETIC work paused for review')
      }
      await page.getByRole('button', { name: 'Continue to review', exact: true }).click()
      const last = template.items.at(-1)
      await page.getByRole('link', { name: last.question + ': record an observation.', exact: true }).click()
      await expect(page.locator('#answer-' + last.id)).toBeFocused()
      for (const group of await groups.all()) if (await group.getAttribute('aria-expanded') === 'false') await group.click()
      // Explicit UI input only in synthetic tests; the product never auto-answers.
      for (const item of template.items.slice(3)) await page.locator('#answer-' + item.id).selectOption('meets')
      await saved(page)
      // With every other requirement satisfied, each missing reason must independently
      // fail server finalization; optional controls are deliberately empty for unable.
      for (const item of template.items.slice(0, 3)) {
        const field = page.locator('#note-' + item.id), note = await field.inputValue()
        await field.fill(''); await saved(page)
        current = await report()
        expectDatabaseError(await worker.client.rpc('ts_command', { command: 'finalize', p: { companyId, id: reportId, revision: current.revision, requestId: randomUUID(), acknowledged: true } }), 'TS_incomplete')
        await field.fill(note); await saved(page)
      }
      await expect(page.getByRole('status').filter({ hasText: template.items.length + ' of ' + template.items.length + ' answered' })).toBeVisible()
      for (const [i, category] of categories.entries()) {
        const count = template.items.filter(item => item.category === category).length
        await expect(groups.nth(i)).toContainText(count + '/' + count + ' answered')
      }
      await page.getByLabel('Unanswered only', { exact: true }).check()
      expect(await answers.evaluateAll(es => es.every(e => !e.checkVisibility()))).toBe(true)
      await expect(page.getByText('All observations have an answer.', { exact: false })).toBeVisible()
      await page.getByLabel('Unanswered only', { exact: true }).uncheck()
      const completed = (await report()).document
      await page.getByRole('button', { name: 'Back to job', exact: true }).click()
      await page.getByRole('button', { name: 'Continue to observations', exact: true }).click()
      await saved(page); await page.reload()
      for (const item of template.items) await expect(page.locator('#answer-' + item.id)).toHaveValue(completed.answers[item.id].state)
      expect((await report()).document).toEqual(completed)
      record('selected template, untouched unanswered defaults, all states, reasons, section/filter counts, review focus, navigation and saved reload PASS')

      const caption = 'SYNTHETIC ' + trade + ' orange cone'
      const jpeg = await sharp(Buffer.from('<svg width="800" height="600"><rect width="800" height="600" fill="#173d5a"/><path d="M400 60L210 500H590Z" fill="#ff8800"/><text x="30" y="560" fill="white" font-size="26">SYNTHETIC ' + trade.toUpperCase() + ' TEST</text></svg>')).jpeg().toBuffer()
      async function upload(text) {
        await page.getByLabel('Photo file', { exact: true }).setInputFiles({ name: 'SYNTHETIC-' + trade + '.jpg', mimeType: 'image/jpeg', buffer: jpeg })
        await page.getByLabel('Photo caption', { exact: true }).fill(text)
        await selectedPhotoNavigation(page, text, jpeg.length)
        await page.getByRole('button', { name: 'Upload photo', exact: true }).click()
        await expect(page.getByRole('status').filter({ hasText: 'Photo saved and retained.' })).toBeVisible()
        await expect(page.locator('.photo-feedback')).toHaveAttribute('aria-busy', 'false')
        await page.reload()
        await expect.poll(() => page.getByRole('img', { name: text, exact: true }).evaluate(e => e.complete && e.naturalWidth > 0)).toBe(true)
        await expect(page.getByText(text, { exact: true })).toBeVisible()
      }
      await upload(caption)
      const photos = await (await context.request.get(base + '/evidence')).json()
      expect(photos).toHaveLength(1); expect(photos[0].caption).toBe(caption)
      const photoUrl = base + '/evidence/' + photos[0].id, photo = await context.request.get(photoUrl)
      expect(photo.status()).toBe(200)
      const photoHash = hash(await photo.body())
      expect((await sharp(await photo.body()).metadata()).exif).toBeUndefined()
      await page.getByRole('button', { name: 'Continue to review', exact: true }).click()
      // Next's route announcer also has role=alert; only report validation is relevant.
      await expect(page.locator('.report-journey [role="alert"]')).toHaveCount(0)
      await page.getByRole('button', { name: 'Continue to finalize', exact: true }).click()
      await page.getByRole('checkbox').check()
      await page.getByRole('button', { name: 'Finalize report', exact: true }).click()
      await expect(page.getByRole('button', { name: 'Open PDF', exact: true })).toBeEnabled()
      const original = await report()
      expect(original.lifecycle).toBe('finalized'); expect(original.template_snapshot).toEqual(template)
      const popup = page.waitForEvent('popup')
      await page.getByRole('button', { name: 'Open PDF', exact: true }).click()
      const viewer = await popup
      await expect(page.getByRole('link', { name: 'Open prepared PDF', exact: true })).toHaveAttribute('href', /^blob:/)
      await viewer.close()
      const downloading = page.waitForEvent('download')
      await page.getByRole('button', { name: 'Download PDF', exact: true }).click()
      const path = 'test-results/' + trade + '-report.pdf'
      await (await downloading).saveAs(path)
      const text = execFileSync('pdftotext', [path, '-'], { encoding: 'utf8' }).replace(/\s+/g, ' ')
      expect(text.toLowerCase()).toContain(trade); expect(text).toContain(address); expect(text).toContain(caption)
      for (const item of template.items) expect(text).toContain(item.question)
      for (const state of ['attention', 'not_applicable', 'unable']) expect(text).toContain('SYNTHETIC ' + trade + ' ' + state + ' explanation')
      expect(text).toContain('pending qualified review')
      const exportJob = await (await context.request.get(base + '/exports')).json()
      const pdfUrl = base + '/exports/' + exportJob.id, pdf = await context.request.get(pdfUrl)
      expect(pdf.status()).toBe(200); expect(await pdf.body()).toEqual(readFileSync(path))
      const pdfHash = hash(await pdf.body())
      await page.screenshot({ path: output + '/' + trade + '-finalized.png', fullPage: true })
      record('captioned upload/navigation/reload, normalized bytes, immutable finalization and actual downloaded PDF trade/questions/reasons/caption PASS')

      await page.getByRole('link', { name: 'Make a correction', exact: true }).click()
      await expect(page.getByLabel('Reason for correction', { exact: true })).toBeFocused()
      await page.getByLabel('Reason for correction', { exact: true }).fill('SYNTHETIC ' + trade + ' correction')
      await page.getByRole('button', { name: 'Create correction draft', exact: true }).click()
      await page.waitForURL(u => u.pathname.startsWith('/report/') && u.pathname !== '/report/' + reportId)
      const amendmentId = new URL(page.url()).pathname.split('/').at(-1)
      let amendment = await report(amendmentId)
      expect(amendment.amendment_of).toBe(reportId); expect(amendment.template_id).toBe(original.template_id)
      expect(amendment.template_snapshot).toEqual(original.template_snapshot); expect(amendment.document).toEqual(original.document)
      await page.getByRole('button', { name: 'Continue to observations', exact: true }).click()
      await page.locator('#note-' + template.items[0].id).fill('SYNTHETIC ' + trade + ' corrected observation')
      await saved(page); await page.reload()
      await expect(page.locator('#note-' + template.items[0].id)).toHaveValue('SYNTHETIC ' + trade + ' corrected observation')
      await upload('SYNTHETIC ' + trade + ' separate correction photo')
      amendment = await report(amendmentId)
      expect(amendment.document.answers[template.items[0].id].note).toBe('SYNTHETIC ' + trade + ' corrected observation')
      await page.screenshot({ path: output + '/' + trade + '-correction.png', fullPage: true })

      const actions = expectSuccess(await worker.client.from('ts_actions').select('*').eq('report_id', reportId))
      expect(actions.map(a => a.item_id).sort()).toEqual([template.items[0].id, template.items[2].id].sort())
      for (const a of actions) expect(a.observation).toBe(template.items.find(i => i.id === a.item_id).question)
      const action = actions.find(a => a.item_id === template.items[0].id)
      await page.goto(APP_ORIGIN + '/actions?company=' + companyId + '&focus=' + action.id)
      const card = page.locator('#action-' + action.id)
      await expect(card).toBeFocused(); await expect(card).toContainText(action.observation)
      await card.getByLabel('Status after saving', { exact: true }).selectOption('in_progress')
      await card.getByLabel('Progress or resolution notes', { exact: true }).fill('SYNTHETIC ' + trade + ' progress')
      await card.getByRole('button', { name: 'Save progress', exact: true }).click()
      await expect(card.getByRole('status')).toContainText('Action update saved.')
      await page.reload(); await expect(card.locator('.action-progress')).toContainText('SYNTHETIC ' + trade + ' progress')
      await card.getByLabel('Status after saving', { exact: true }).selectOption('awaiting_verification')
      await card.getByRole('button', { name: 'Request verification', exact: true }).click()
      await expect(card.getByRole('status')).toContainText('Action update saved.')
      let latest = expectSuccess(await worker.client.from('ts_actions').select('*').eq('id', action.id).single())
      const actionPayload = { companyId, id: latest.id, revision: latest.revision, requestId: randomUUID(), state: 'closed', controls: latest.controls, responsibleId: worker.id, targetDate: '', resolution: latest.resolution }
      const deniedClosure = await context.request.post(APP_ORIGIN + '/api/workspace', { headers: { origin: APP_ORIGIN }, data: { command: 'update_action', payload: actionPayload } })
      expect(deniedClosure.status()).toBe(403); expect((await deniedClosure.json()).code).toBe('denied')
      const supervisorPage = await login(supervisor)
      await supervisorPage.goto(APP_ORIGIN + '/actions?company=' + companyId + '&mine=0&status=awaiting_verification&focus=' + action.id)
      const review = supervisorPage.locator('#action-' + action.id)
      await review.getByLabel('Status after saving', { exact: true }).selectOption('closed')
      await review.getByRole('button', { name: 'Verify and close', exact: true }).click()
      await expect(review.getByRole('status')).toContainText('Action update saved.')
      await supervisorPage.reload(); await expect(review).toContainText('Verified by')
      latest = expectSuccess(await worker.client.from('ts_actions').select('*').eq('id', action.id).single())
      expect(latest.state).toBe('closed'); expect(latest.verified_by).toBe(supervisor.id); expect(latest.verified_at).toBeTruthy()
      expect(expectSuccess(await worker.client.from('ts_events').select('id').eq('entity_id', action.id).eq('kind', 'action_updated'))).toHaveLength(3)
      expect(await report()).toEqual(original)
      expect(hash(await (await context.request.get(photoUrl)).body())).toBe(photoHash)
      expect(hash(await (await context.request.get(pdfUrl)).body())).toBe(pdfHash)
      const immutable = await context.request.post(APP_ORIGIN + '/api/workspace', { headers: { origin: APP_ORIGIN }, data: { command: 'save_report', payload: { companyId, id: reportId, revision: original.revision, requestId: randomUUID(), document: original.document } } })
      expect(immutable.status()).toBe(409); expect((await immutable.json()).code).toBe('immutable')
      record('separate template-preserving correction/evidence, action origin/progress/reload, denied worker closure, supervisor verification/history and unchanged original/photo/PDF PASS')

      const stranger = await login(outsider)
      expect((await stranger.goto(APP_ORIGIN + '/report/' + reportId)).status()).toBe(404)
      expect(expectSuccess(await outsider.client.from('ts_reports').select('id').eq('company_id', companyId))).toEqual([])
      for (const url of [photoUrl, pdfUrl]) expect((await stranger.context().request.get(url)).status()).toBe(404)
      await cmd(owner, 'member', { userId: worker.id, role: 'remove' })
      expect((await page.goto(APP_ORIGIN + '/report/' + amendmentId)).status()).toBe(404)
      for (const url of [photoUrl, pdfUrl]) expect((await context.request.get(url)).status()).toBe(404)
      expect((await context.request.post(base + '/exports', { headers: { origin: APP_ORIGIN } })).status()).toBe(404)
      expectDatabaseError(await worker.client.rpc('ts_command', { command: 'update_action', p: { ...actionPayload, revision: latest.revision, state: 'open', requestId: randomUUID() } }), 'TS_denied')
      record('cross-company and revoked private report/evidence/PDF generation/read/action denial PASS')
      Object.assign(receipt, { status: 'passed', reportId, amendmentId, companyId, photoHash, pdfHash, templateId: template.id, observationCount: template.items.length, finishedAt: new Date().toISOString() })
      writeFileSync(output + '/' + trade + '.json', JSON.stringify(receipt, null, 2))
    } finally {
      for (const context of contexts) await context.close()
    }
  })
}
