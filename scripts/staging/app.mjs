import { spawn } from 'node:child_process'
import { requireStaging } from './config.mjs'
import { existsSync, readFileSync } from 'node:fs'
import { parseEnv } from 'node:util'
const config = requireStaging()
if (!config) process.exitCode = 2
else if (config.env.NEXT_PUBLIC_APP_URL !== 'https://localhost:3000') {
  console.error('BLOCKED: this local launcher requires NEXT_PUBLIC_APP_URL=https://localhost:3000.')
  process.exitCode = 2
} else {
  let serverKey=''
  if(existsSync('.staging/server.env')){
    serverKey=parseEnv(readFileSync('.staging/server.env','utf8')).SUPABASE_SERVICE_ROLE_KEY||''
    let claims
    try{claims=JSON.parse(Buffer.from(serverKey.split('.')[1],'base64url').toString('utf8'))}catch{/* No secret in diagnostics. */}
    if(claims?.role!=='service_role'||claims?.ref!==config.env.STAGING_ISOLATED_PROJECT_REF)throw new Error('Server credential does not match the isolated staging project.')
  }
  const env = { ...process.env, APP_ENV: 'staging', NEXT_TELEMETRY_DISABLED: '1', TRADESAFE_STAGING_ARTIFACT: '1',
    SUPABASE_SERVICE_ROLE_KEY: serverKey,
    NEXT_PUBLIC_APP_URL: config.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_SUPABASE_URL: config.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: config.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    STRIPE_SECRET_KEY: '', ANTHROPIC_API_KEY: '' }
  // Synthetic passwords stay in the test runner, never in the Next child environment.
  for (const name of Object.keys(env)) if (name.startsWith('STAGING_')) delete env[name]
  const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--hostname', 'localhost', '--port', '3000', '--experimental-https'],
    { env, stdio: 'inherit', windowsHide: true })
  child.on('error', () => { console.error('FAIL: isolated app launch failed.'); process.exitCode = 1 })
  child.on('exit', code => { process.exitCode = code ?? 1 })
}
