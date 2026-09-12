// Real Supabase Auth/PostgREST tests. No privileged client, migration execution or cleanup.
import { createClient } from '@supabase/supabase-js'
import { randomUUID, randomBytes, createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { getTemplate } from '../lib/domain/templates.ts'
import { roles, requireStaging } from './staging/config.mjs'
import { expectSuccess, expectDatabaseError } from './staging/assertions.mjs'
import { gitIdentity } from './staging/evidence.mjs'

const scenarios = [], clients = []
const config = requireStaging()
const evidence = { ...gitIdentity(),
  timestamp: new Date().toISOString(), environment: 'operator-verified isolated Supabase', scenarios }
function record(name, status) { scenarios.push({ name, status }); console.log(status + ': ' + name) }
async function check(name, run) {
  try { await run(); record(name, 'PASS') } catch { record(name, 'FAIL'); throw new Error('Staging assertion failed') }
}
const ok = async result => expectSuccess(await result)
const denied = async (result, code = 'TS_denied') => expectDatabaseError(await result, code)
function saveEvidence() {
  mkdirSync('test-results', { recursive: true })
  writeFileSync('test-results/staging-integration.json', JSON.stringify(evidence, null, 2))
}
if (!config) {
  record('Real Auth, PostgreSQL and PostgREST suite: isolation/configuration unavailable', 'BLOCKED')
  saveEvidence()
  process.exitCode = 2
} else {
  const { env } = config
  evidence.projectFingerprint = createHash('sha256').update(env.STAGING_ISOLATED_PROJECT_REF).digest('hex')
  try {
    await check('Four distinct verified synthetic Auth identities', async () => {
      for (const role of roles) {
        const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
          { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })
        clients.push({ client, role })
        const auth = await client.auth.signInWithPassword({
          email: env['STAGING_' + role + '_EMAIL'], password: env['STAGING_' + role + '_PASSWORD'],
        })
        assert.ok(!auth.error && auth.data.session)
        const verified = await client.auth.getUser(auth.data.session.access_token)
        assert.ok(!verified.error && verified.data.user?.email_confirmed_at)
        Object.assign(clients.at(-1), { user: verified.data.user, issuedToken: auth.data.session.access_token })
      }
      assert.equal(new Set(clients.map(c => c.user.id)).size, 4)
    })
    const [owner, supervisor, worker, outsider] = clients
    const companyId = randomUUID(), reportId = randomUUID(), otherId = randomUUID(), template = getTemplate('electrical')
    const rpc = (who, command, p = {}) => who.client.rpc('ts_command', {
      command, p: { companyId, requestId: randomUUID(), ...p },
    })
    const read = (who, table, id) => ok(who.client.from(table).select('*').eq('id', id).single())
    let company, report, workerToken
    await check('Database templates match all three published versions before writes', async () => {
      for (const trade of ['electrical', 'plumbing', 'roofing']) {
        const expected = getTemplate(trade)
        const stored = await ok(owner.client.from('ts_templates').select('snapshot').eq('id', expected.id).single())
        assert.deepEqual(stored.snapshot, expected)
      }
    })
    await check('Company creation retries, settings and isolated outsider company', async () => {
      company = await ok(rpc(owner, 'create_company', { id: companyId, name: 'SYNTHETIC staging verification' }))
      assert.equal((await ok(rpc(owner, 'create_company', { id: companyId, name: company.name }))).id, companyId)
      company = await ok(rpc(owner, 'save_company', { revision: company.revision, name: company.name, business: { contact_phone: '555-0101' } }))
      await ok(rpc(outsider, 'create_company', { id: otherId, name: 'SYNTHETIC outsider company' }))
    })
    await check('Intended invitation, wrong account, revoked invitation and acceptance retry', async () => {
      const revoked = randomBytes(32).toString('hex')
      const invitation = await ok(rpc(owner, 'invite', { email: outsider.user.email, role: 'worker', token: revoked }))
      await ok(rpc(owner, 'revoke_invitation', { id: invitation.id }))
      await denied(rpc(outsider, 'accept_invitation', { token: revoked }), 'TS_invitation')
      for (const [person, role] of [[worker, 'worker'], [supervisor, 'supervisor']]) {
        const token = randomBytes(32).toString('hex')
        if (role === 'worker') workerToken = token
        await ok(rpc(owner, 'invite', { email: person.user.email, role, token }))
        await denied(rpc(outsider, 'accept_invitation', { token }), 'TS_invitation')
        assert.equal((await ok(rpc(person, 'accept_invitation', { token }))).company_id, companyId)
        assert.equal((await ok(rpc(person, 'accept_invitation', { token }))).company_id, companyId)
      }
    })
    await check('Worker and supervisor cannot manage settings, invitations or ownership', async () => {
      for (const person of [worker, supervisor]) {
        await denied(rpc(person, 'save_company', { revision: company.revision, name: 'Forbidden', business: {} }))
        await denied(rpc(person, 'invite', { email: outsider.user.email, role: 'owner', token: randomBytes(32).toString('hex') }))
        await denied(rpc(person, 'member', { userId: person.user.id, role: 'owner' }))
      }
      await denied(rpc(owner, 'member', { userId: owner.user.id, role: 'remove' }), 'TS_last_owner')
      await denied(rpc(owner, 'member', { userId: owner.user.id, role: 'worker' }), 'TS_last_owner')
    })
    await check('Unanswered draft, duplicate-safe creation and immutable business prefill', async () => {
      report = await ok(rpc(worker, 'create_report', { id: reportId, templateId: template.id }))
      const retry = await ok(rpc(worker, 'create_report', { id: reportId, templateId: template.id }))
      assert.equal(retry.id, report.id)
      assert.equal(report.business_snapshot.details.contact_phone, '555-0101')
      assert.equal(Object.keys(report.document.answers).length, template.items.length)
      assert.ok(Object.values(report.document.answers).every(a => a.state === 'unanswered'))
      await ok(rpc(owner, 'save_company', { revision: company.revision, name: company.name, business: { contact_phone: '555-0199' } }))
      assert.equal((await read(worker, 'ts_reports', reportId)).business_snapshot.details.contact_phone, '555-0101')
    })
    await check('Cross-company reads and RPC mutations denied', async () => {
      for (const [table, column, value] of [['ts_companies', 'id', companyId], ['ts_members', 'company_id', companyId],
        ['ts_reports', 'id', reportId], ['ts_events', 'company_id', companyId], ['ts_invitations', 'company_id', companyId]]) {
        assert.deepEqual(await ok(outsider.client.from(table).select('*').eq(column, value)), [])
      }
      await denied(rpc(outsider, 'save_report', { id: reportId, revision: 1, document: report.document }))
      await denied(rpc(outsider, 'create_report', { id: randomUUID(), templateId: template.id }))
      const owned = await ok(rpc(owner, 'create_report', { id: randomUUID(), templateId: template.id }))
      await denied(rpc(worker, 'save_report', { id: owned.id, revision: 1, document: owned.document }))
      await ok(rpc(supervisor, 'save_report', { id: owned.id, revision: 1, document: owned.document }))
    })
    await check('Direct Data API writes cannot set trusted fields, ownership, roles or history', async () => {
      for (const person of [worker, outsider]) {
        for (const patch of [{ lifecycle: 'finalized', finalized_by: person.user.id, finalized_at: new Date().toISOString(), snapshot_version: 1 },
          { company_id: otherId }, { author_id: outsider.user.id }, { template_snapshot: {} }, { business_snapshot: {} }]) {
          await denied(person.client.from('ts_reports').update(patch).eq('id', reportId), '42501')
        }
        await denied(person.client.from('ts_reports').delete().eq('id', reportId), '42501')
        await denied(person.client.from('ts_members').update({ role: 'owner' }).eq('company_id', companyId), '42501')
        await denied(person.client.from('ts_companies').update({ created_by: person.user.id }).eq('id', companyId), '42501')
        await denied(person.client.from('ts_events').insert({ company_id: companyId, actor_id: person.user.id, kind: 'forged', entity_id: reportId }), '42501')
        await denied(person.client.from('reports').update({ status: 'completed' }).eq('user_id', person.user.id), '42501')
      }
    })
    const document = { job: { address: 'SYNTHETIC test site', client: 'Synthetic fixture', date: '2026-09-12' },
      answers: Object.fromEntries(template.items.map(i => [i.id, { state: 'meets', note: '', controls: '' }])) }
    document.answers[template.items[0].id] = { state: 'attention', note: 'Synthetic unresolved concern', controls: 'Synthetic control' }
    await check('Incomplete/invalid finalization rejected; retry and refresh preserve saved document', async () => {
      await denied(rpc(worker, 'finalize', { id: reportId, revision: 1, acknowledged: true }), 'TS_incomplete')
      const invalid = structuredClone(document); invalid.answers[template.items[1].id].state = 'pass'
      await denied(rpc(worker, 'save_report', { id: reportId, revision: 1, document: invalid }), 'TS_invalid')
      const missingReason = structuredClone(document); missingReason.answers[template.items[0].id].note = ''
      report = await ok(rpc(worker, 'save_report', { id: reportId, revision: 1, document: missingReason }))
      await denied(rpc(worker, 'finalize', { id: reportId, revision: report.revision, acknowledged: true }), 'TS_incomplete')
      const payload = { id: reportId, revision: report.revision, document, requestId: randomUUID() }
      report = await ok(rpc(worker, 'save_report', payload))
      assert.equal((await ok(rpc(worker, 'save_report', payload))).revision, report.revision)
      assert.deepEqual((await read(worker, 'ts_reports', reportId)).document, document)
      await denied(rpc(worker, 'finalize', { id: reportId, revision: report.revision, acknowledged: false }), 'TS_incomplete')
    })
    await check('Concurrent PostgREST saves yield one winner and an explicit stale-write conflict', async () => {
      const payload = { id: reportId, revision: report.revision, document }
      const results = await Promise.all([rpc(worker, 'save_report', payload), rpc(worker, 'save_report', payload)])
      assert.equal(results.filter(r => !r.error).length, 1)
      expectDatabaseError(results.find(r => r.error), 'TS_conflict')
      report = await read(worker, 'ts_reports', reportId)
    })
    await check('Finalization with unresolved concern is immutable and creates an attributable amendment', async () => {
      const payload = { id: reportId, revision: report.revision, acknowledged: true, requestId: randomUUID() }
      report = await ok(rpc(worker, 'finalize', payload))
      assert.equal((await ok(rpc(worker, 'finalize', payload))).revision, report.revision)
      assert.equal(report.lifecycle, 'finalized'); assert.equal(report.finalized_by, worker.user.id)
      assert.ok(report.finalized_at); assert.equal(report.snapshot_version, 1)
      await denied(rpc(worker, 'save_report', { id: reportId, revision: report.revision, document }), 'TS_immutable')
      await denied(rpc(outsider, 'amend', { id: randomUUID(), amendmentOf: reportId, reason: 'Forbidden' }))
      const amendment = await ok(rpc(worker, 'amend', { id: randomUUID(), amendmentOf: reportId, reason: 'Synthetic correction' }))
      assert.equal(amendment.amendment_of, reportId); assert.equal(amendment.author_id, worker.user.id)
      assert.deepEqual(amendment.template_snapshot, report.template_snapshot)
      const changed = structuredClone(amendment.document); changed.job.client = 'Amended synthetic reference'
      await ok(rpc(worker, 'save_report', { id: amendment.id, revision: amendment.revision, document: changed }))
      assert.deepEqual((await read(worker, 'ts_reports', reportId)).document, document)
    })
    await check('Actions: assignment, resolution, authorized verification, reopen history and snapshot separation', async () => {
      let action = (await ok(worker.client.from('ts_actions').select('*').eq('report_id', reportId)))[0]
      assert.equal(action.state, 'open'); assert.equal(action.responsible_id, worker.user.id)
      const update = state => ({ id: action.id, revision: action.revision, state, responsibleId: worker.user.id,
        controls: 'Synthetic controls', resolution: 'Synthetic resolution reviewed', targetDate: '2026-09-20' })
      await denied(rpc(worker, 'update_action', update('closed')))
      await denied(rpc(outsider, 'update_action', update('in_progress')))
      await denied(worker.client.from('ts_actions').update({ state: 'closed', verified_by: worker.user.id }).eq('id', action.id), '42501')
      action = await ok(rpc(worker, 'update_action', update('in_progress')))
      action = await ok(rpc(worker, 'update_action', update('awaiting_verification')))
      action = await ok(rpc(supervisor, 'update_action', update('closed')))
      assert.equal(action.verified_by, supervisor.user.id); assert.ok(action.verified_at)
      action = await ok(rpc(owner, 'update_action', update('open')))
      assert.equal(action.verified_by, null)
      const history = await ok(owner.client.from('ts_events').select('*').eq('entity_id', action.id))
      assert.ok(history.some(e => e.before_value?.verified_by === supervisor.user.id && e.after_value?.state === 'open' && e.actor_id === owner.user.id))
      assert.deepEqual((await read(owner, 'ts_reports', reportId)).document, document)
      action = await ok(rpc(owner, 'update_action', { ...update('in_progress'), responsibleId: supervisor.user.id }))
      await denied(rpc(worker, 'update_action', update('in_progress')))
    })
    await check('Payment RPC cannot grant entitlement or alter safety lifecycle', async () => {
      await denied(rpc(owner, 'grant_payment', { id: reportId }), 'TS_invalid')
      assert.equal((await read(owner, 'ts_reports', reportId)).lifecycle, 'finalized')
    })
    await check('Removal revokes reads/writes with the exact previously-issued JWT; consumed invite cannot restore access', async () => {
      await ok(rpc(owner, 'member', { userId: worker.user.id, role: 'remove' }))
      const headers = { apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY, Authorization: 'Bearer ' + worker.issuedToken }
      const response = await fetch(env.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1/ts_reports?id=eq.' + reportId + '&select=id', { headers })
      assert.equal(response.status, 200); assert.deepEqual(await response.json(), [])
      const mutation = await fetch(env.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1/rpc/ts_command', {
        method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: 'create_report', p: { companyId, id: randomUUID(), templateId: template.id } }),
      })
      assert.equal(mutation.status, 400)
      expectDatabaseError({ error: await mutation.json() }, 'TS_denied')
      await denied(rpc(worker, 'accept_invitation', { token: workerToken }), 'TS_invitation')
      assert.ok(!(await worker.client.auth.getUser(worker.issuedToken)).error, 'Auth identity remains valid; company membership must revoke access')
    })
    let fixture
    try { fixture = JSON.parse(readFileSync('.staging/expired-invitation.json', 'utf8')) } catch { /* Explicit blocked case below. */ }
    if (!fixture) {
      record('Expired invitation using operator-applied isolated fixture', 'BLOCKED')
      process.exitCode = 2
    } else await check('Expired invitation rejected for its intended authenticated account', async () => {
      assert.equal(fixture.projectFingerprint, evidence.projectFingerprint)
      assert.equal(fixture.ownerId, owner.user.id); assert.equal(fixture.workerId, worker.user.id)
      const stored = await read(owner, 'ts_invitations', fixture.invitationId)
      assert.ok(new Date(stored.expires_at).getTime() < Date.now())
      assert.equal(stored.revoked, false); assert.equal(stored.accepted_by, null)
      await denied(rpc(worker, 'accept_invitation', { token: fixture.token }), 'TS_invitation')
    })
  } catch {
    process.exitCode = 1
    console.error('FAIL: suite stopped. See scenario names in test-results/staging-integration.json; provider diagnostics are deliberately omitted.')
  } finally {
    for (const entry of clients) {
      try { await entry.client.auth.signOut({ scope: 'local' }) } catch { /* No credentials or raw transport diagnostics printed. */ }
    }
    saveEvidence()
  }
}
