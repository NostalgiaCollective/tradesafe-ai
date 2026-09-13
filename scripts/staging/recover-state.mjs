import { createClient } from '@supabase/supabase-js'
import { createHash } from 'node:crypto'
import { writeFileSync } from 'node:fs'
import { requireStaging, roles } from './config.mjs'
import { getTemplate } from '../../lib/domain/templates.ts'
import { isDeepStrictEqual } from 'node:util'
import { gitIdentity } from './evidence.mjs'
const config = requireStaging()
if (!config || config.env.STAGING_ISOLATED_PROJECT_REF === 'flhsdtshwwuddzyguyhf') process.exit(2)
const { env } = config
const report = { ...gitIdentity(), timestamp: new Date().toISOString(), projectFingerprint: createHash('sha256').update(env.STAGING_ISOLATED_PROJECT_REF).digest('hex'), roles: [] }
for (const role of roles) {
  const row = { role }
  const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: async (...args) => { try { return await fetch(...args) } catch { throw new Error('Staging transport unavailable') } } } })
  try {
    const auth = await client.auth.signInWithPassword({ email: env['STAGING_' + role + '_EMAIL'], password: env['STAGING_' + role + '_PASSWORD'] })
    if (auth.error || !auth.data.session) throw new Error('Authentication unavailable')
    const verified = await client.auth.getUser()
    row.verified = Boolean(!verified.error && verified.data.user?.email_confirmed_at)
    row.counts = {}
    for (const table of ['ts_members','ts_companies','ts_invitations','ts_reports','ts_actions','ts_events']) {
      const r = await client.from(table).select(table === 'ts_members' ? 'company_id' : 'id', { count: 'exact', head: true })
      if (r.error) throw new Error('Inventory unavailable')
      row.counts[table] = r.count
    }
    row.templatesExact = true
    for (const trade of ['electrical','plumbing','roofing']) {
      const template = getTemplate(trade)
      const r = await client.from('ts_templates').select('snapshot').eq('id', template.id).single()
      row.templatesExact &&= !r.error && isDeepStrictEqual(r.data?.snapshot, template)
    }
    if (!row.verified || !row.templatesExact) throw new Error('Identity or template mismatch')
    row.status = 'PASS'
  } catch { row.status = 'BLOCKED'; process.exitCode = 2 }
  finally { await client.auth.signOut({ scope: 'local' }).catch(() => {}) }
  report.roles.push(row)
  console.log(JSON.stringify(row))
}
writeFileSync('.staging/recovered-ordinary-state.json', JSON.stringify(report, null, 2))
