// Prepares local fixture files; NEVER executes SQL or uses privileged credentials.
import { createClient } from '@supabase/supabase-js'
import { randomUUID, randomBytes, createHash } from 'node:crypto'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { requireStaging } from './config.mjs'
const config = requireStaging()
if (!config) process.exitCode = 2
else if (existsSync('.staging/expired-invitation.json') || existsSync('.staging/expired-invitation.sql')) {
  console.error('BLOCKED: expiry fixture files already exist. Review them; do not overwrite or execute twice.')
  process.exitCode = 2
} else {
  const clients = []
  try {
    const { env } = config, users = []
    for (const role of ['OWNER', 'WORKER']) {
      const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        { auth: { persistSession: false, autoRefreshToken: false } })
      clients.push(client)
      const signed = await client.auth.signInWithPassword({ email: env['STAGING_' + role + '_EMAIL'], password: env['STAGING_' + role + '_PASSWORD'] })
      if (signed.error) throw new Error('Sign-in failed')
      const verified = await client.auth.getUser()
      if (verified.error || !verified.data.user?.email_confirmed_at) throw new Error('Verified identity required')
      users.push(verified.data.user)
    }
    const [owner, worker] = users
    if (owner.id === worker.id) throw new Error('Distinct identities required')
    const companyId = randomUUID(), invitationId = randomUUID(), token = randomBytes(32).toString('hex')
    const hash = createHash('sha256').update(token).digest('hex')
    const sqlString = value => "'" + value.replaceAll("'", "''") + "'"
    const sql = `-- Isolated synthetic expiry fixture ONLY. Review project and identities before execution.
-- Run ONCE after all reviewed migrations. No application expiry bypass or privileged test client.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
INSERT INTO public.ts_companies(id,name,created_by) VALUES('${companyId}','SYNTHETIC expiry fixture','${owner.id}');
INSERT INTO public.ts_members(company_id,user_id,role,display_name) VALUES('${companyId}','${owner.id}','owner','Synthetic expiry fixture owner');
INSERT INTO public.ts_invitations(id,company_id,email,role,token_hash,expires_at,created_by)
VALUES('${invitationId}','${companyId}',${sqlString(worker.email.toLowerCase())},'worker','${hash}','2020-01-01T00:00:00Z','${owner.id}');
COMMIT;
`
    mkdirSync('.staging', { recursive: true })
    writeFileSync('.staging/expired-invitation.sql', sql, { flag: 'wx', mode: 0o600 })
    writeFileSync('.staging/expired-invitation.json', JSON.stringify({ ownerId: owner.id, workerId: worker.id,
      invitationId, token, projectFingerprint: createHash('sha256').update(env.STAGING_ISOLATED_PROJECT_REF).digest('hex') }), { flag: 'wx', mode: 0o600 })
    console.log('PREPARED only: .staging/expired-invitation.sql for isolated console review; private companion JSON retained locally. No SQL executed. Do not print or share companion JSON.')
  } catch {
    console.error('FAIL: fixture preparation. No raw Auth/provider diagnostics printed. Inspect whether partial local fixture files need review.')
    process.exitCode = 1
  } finally {
    for (const client of clients) { try { await client.auth.signOut({ scope: 'local' }) } catch { /* No sensitive diagnostics. */ } }
  }
}
