import { createClient } from '@supabase/supabase-js'
import { randomBytes, randomUUID } from 'node:crypto'
import { writeFileSync } from 'node:fs'
import { API_ORIGIN } from './local-environment.mjs'
import { expectSuccess } from '../staging/assertions.mjs'

// Provider-assisted synthetic identities; all business writes use ordinary-user RPCs.
export async function prepareRecoveryFixtures(f) {
  const cmd = async (client, command, p) => expectSuccess(await client.rpc('ts_command', { command, p }))
  async function actor(prefix) {
    const credentials = { email: prefix + '-' + randomUUID() + '@example.test', password: randomBytes(24).toString('base64url') }
    const user = expectSuccess(await f.admin.auth.admin.createUser({ ...credentials, email_confirm: true })).user
    const client = createClient(API_ORIGIN, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
    expectSuccess(await client.auth.signInWithPassword(credentials))
    return { credentials, user, client }
  }
  const worker = await actor('recovery-worker'), outsider = await actor('recovery-outsider')
  const token = randomBytes(32).toString('hex')
  await cmd(f.owner, 'invite', { companyId: f.companyId, email: worker.credentials.email, role: 'worker', token })
  await cmd(worker.client, 'accept_invitation', { token })
  await cmd(outsider.client, 'create_company', { id: randomUUID(), name: 'SYNTHETIC recovery other company' })
  let draft = await cmd(worker.client, 'create_report', { companyId: f.companyId, id: randomUUID(), templateId: f.original.template_id })
  draft.document.job = { address: 'SYNTHETIC recovery saved worker draft', client: 'Recovery rehearsal', date: '2026-09-20' }
  draft = await cmd(worker.client, 'save_report', { companyId: f.companyId, id: draft.id, revision: draft.revision, requestId: randomUUID(), document: draft.document })
  let action = expectSuccess(await f.owner.from('ts_actions').select('*').eq('report_id', f.reportId).single())
  const update = async (client, state) => {
    action = await cmd(client, 'update_action', { companyId: f.companyId, id: action.id, revision: action.revision, requestId: randomUUID(), responsibleId: worker.user.id, controls: 'SYNTHETIC area isolated', resolution: 'SYNTHETIC cover replaced and checked', targetDate: '2026-09-21', state })
  }
  await update(f.owner, 'open'); await update(worker.client, 'in_progress')
  await update(worker.client, 'awaiting_verification'); await update(f.owner, 'closed')
  const history = expectSuccess(await f.owner.from('ts_events').select('*').eq('entity_id', action.id).order('id'))
  const amendment = expectSuccess(await f.owner.from('ts_reports').select('*').eq('amendment_of', f.reportId).single())
  // Login secrets remain outside the backup archive, in the ephemeral runner only.
  writeFileSync('.ci-local/recovery-fixture.json', JSON.stringify({
    owner: f.credentials, worker: worker.credentials, outsider: outsider.credentials, revoked: f.revoked,
    companyId: f.companyId, reportId: f.reportId, photoId: f.photoId, exportId: f.exportId,
    original: f.original, photoHash: f.photoHash, pdfHash: f.pdfHash, draft, action, history, amendment,
  }), { mode: 0o600 })
}
