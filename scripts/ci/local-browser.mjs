import { mkdirSync, copyFileSync, cpSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { execFileSync, spawn } from 'node:child_process'
import { parseEnv } from 'node:util'
import assert from 'node:assert/strict'
import { APP_ORIGIN, localEnvironment } from './local-environment.mjs'

let stage = 'runner guard', server
const run = (file, args, env = process.env) => execFileSync(file, args, { env, stdio: 'pipe', timeout: 600000, maxBuffer: 20 * 1024 * 1024 })
try {
  assert.equal(process.platform, 'linux')
  assert.equal(process.env.GITHUB_ACTIONS, 'true')
  assert.equal(process.env.GITHUB_REPOSITORY, 'NostalgiaCollective/tradesafe-ai')
  assert.ok(!existsSync('.ci-local'), 'Refuse to reuse any local database')
  for (const file of ['.env', '.env.local', '.env.production', '.env.production.local', '.env.staging.local']) assert.ok(!existsSync(file), 'No existing environment permitted')
  mkdirSync('.ci-local/supabase', { recursive: true })
  mkdirSync('test-results', { recursive: true })
  copyFileSync('scripts/ci/local-config.toml', '.ci-local/supabase/config.toml')
  cpSync('supabase/migrations', '.ci-local/supabase/migrations', { recursive: true })
  stage = 'fresh local Supabase startup and migrations'
  run('supabase', ['start', '--workdir', '.ci-local'])
  stage = 'loopback identity guard'
  const status = parseEnv(run('supabase', ['status', '--workdir', '.ci-local', '-o', 'env']).toString())
  const env = { ...process.env, ...localEnvironment(status) }
  stage = 'configured application build'
  run(process.execPath, ['node_modules/next/dist/bin/next', 'build'], env)
  stage = 'local application startup'
  server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', '3000'], { env, stdio: 'ignore' })
  let ready = false
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(APP_ORIGIN + '/auth/login', { signal: AbortSignal.timeout(1000) })).ok) { ready = true; break } } catch { /* bounded startup */ }
    await new Promise(resolve => setTimeout(resolve, 500))
  }
  assert.ok(ready, 'Local app did not become ready')
  stage = 'executed WebKit workflows'
  // Safe reporter suppresses fill arguments, captured emails, tokens and provider errors.
  const child = spawn(process.execPath, ['node_modules/@playwright/test/cli.js', 'test', '--config=playwright.local.config.mjs'], { env, stdio: 'inherit' })
  const code = await new Promise(resolve => { child.on('error', () => resolve(1)); child.on('exit', resolve) })
  assert.equal(code, 0, 'WebKit checks did not pass')
  const result = JSON.parse(readFileSync('test-results/local-webkit.json', 'utf8'))
  assert.equal(result.status, 'passed'); assert.equal(result.executed, 3); assert.equal(result.skipped, 0)
  console.log('PASS: 3 executed WebKit local-integration tests; zero skipped. No hosted/email-delivery/physical-device claim.')
} catch (error) {
  console.error('FAIL: ' + stage + ' (' + error.name + '). No raw provider/token diagnostics printed.')
  process.exitCode = 1
} finally {
  server?.kill('SIGTERM')
  // Runner destruction removes the disposable stack. Never run remote reset/push/cleanup.
  if (process.env.GITHUB_STEP_SUMMARY && existsSync('test-results/local-webkit.json')) {
    const result = JSON.parse(readFileSync('test-results/local-webkit.json', 'utf8'))
    writeFileSync(process.env.GITHUB_STEP_SUMMARY, '## Disposable local WebKit\n\n```json\n' + JSON.stringify(result, null, 2) + '\n```\n', { flag: 'a' })
  }
}
