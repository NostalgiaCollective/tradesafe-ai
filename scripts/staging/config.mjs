import { existsSync, readFileSync } from 'node:fs'
import { parseEnv } from 'node:util'
import { validOrigin, validPublicKey } from '../../lib/domain/config.ts'

export const roles = ['OWNER', 'SUPERVISOR', 'WORKER', 'OUTSIDER']
export const required = ['APP_ENV', 'NEXT_PUBLIC_APP_URL', 'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'STAGING_ISOLATED_PROJECT_REF', 'STAGING_ALLOW_SYNTHETIC_WRITES',
  ...roles.flatMap(role => ['STAGING_' + role + '_EMAIL', 'STAGING_' + role + '_PASSWORD'])]

// This file is deliberately separate from Next's .env/.env.local discovery.
export function loadStagingEnvironment() {
  return { ...(existsSync('.env.staging.local') ? parseEnv(readFileSync('.env.staging.local', 'utf8')) : {}), ...process.env }
}

export function stagingIssues(env, isolation) {
  const issues = required.filter(name => !env[name]?.trim()).map(name => name + ': missing')
  if (env.APP_ENV !== 'staging') issues.push('APP_ENV: must be staging')
  if (env.STAGING_ALLOW_SYNTHETIC_WRITES !== 'yes') issues.push('STAGING_ALLOW_SYNTHETIC_WRITES: explicit opt-in required')
  if (!validOrigin(env.NEXT_PUBLIC_APP_URL, false)) issues.push('NEXT_PUBLIC_APP_URL: HTTPS origin required')
  const ref = env.STAGING_ISOLATED_PROJECT_REF
  if (!/^[a-z0-9]{20}$/.test(ref || '') || env.NEXT_PUBLIC_SUPABASE_URL !== 'https://' + ref + '.supabase.co') {
    issues.push('NEXT_PUBLIC_SUPABASE_URL: exact isolated project origin required')
  }
  if (!validPublicKey(env.NEXT_PUBLIC_SUPABASE_ANON_KEY)) issues.push('NEXT_PUBLIC_SUPABASE_ANON_KEY: public key required')
  const emails = roles.map(role => env['STAGING_' + role + '_EMAIL']?.trim().toLowerCase())
  if (new Set(emails.filter(Boolean)).size !== roles.length) issues.push('STAGING_*_EMAIL: four distinct identities required')
  // An explicit console inventory/attestation is required; a staging-looking name proves nothing.
  if (!isolation || isolation.projectRef !== ref || isolation.appOrigin !== env.NEXT_PUBLIC_APP_URL || isolation.syntheticOnly !== true ||
      isolation.noProductionConnections !== true || !isolation.verifiedBy?.trim() ||
      !Number.isFinite(Date.parse(isolation.verifiedAt)) || isolation.inventoryReviewed !== true) {
    issues.push('.staging/isolation.json: matching operator-verified isolation inventory required')
  }
  return [...new Set(issues)]
}

export function requireStaging() {
  const env = loadStagingEnvironment()
  let isolation
  try { isolation = JSON.parse(readFileSync('.staging/isolation.json', 'utf8')) } catch { /* Report missing/invalid evidence by name only. */ }
  const issues = stagingIssues(env, isolation)
  if (issues.length) {
    console.error('BLOCKED: ' + issues.join('; '))
    return null
  }
  return { env, isolation }
}
