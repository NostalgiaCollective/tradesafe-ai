import { spawn } from 'node:child_process'
import { requireStaging } from './config.mjs'
const config = requireStaging()
if (!config) process.exitCode = 2
else if (config.env.NEXT_PUBLIC_APP_URL !== 'https://localhost:3000') {
  console.error('BLOCKED: this local launcher requires NEXT_PUBLIC_APP_URL=https://localhost:3000.')
  process.exitCode = 2
} else {
  const env = { ...process.env, APP_ENV: 'staging', NEXT_TELEMETRY_DISABLED: '1', TRADESAFE_STAGING_ARTIFACT: '1',
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
