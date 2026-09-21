import { mkdirSync, copyFileSync, cpSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { execFileSync, spawn } from 'node:child_process'
import { parseEnv } from 'node:util'
import assert from 'node:assert/strict'
import { APP_ORIGIN, localEnvironment } from './local-environment.mjs'
import { capture, negativeArchiveChecks, restore, identity, assertIdentity, TARGET } from '../operations/local-rehearsal.mjs'

let stage = 'runner guard', server
const run = (file, args, env = process.env) => execFileSync(file, args, { env, stdio: 'pipe', timeout: 600000, maxBuffer: 20 * 1024 * 1024 })
async function startApp(env) {
  server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', '3000'], { env, stdio: 'ignore' })
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(APP_ORIGIN + '/auth/login', { signal: AbortSignal.timeout(1000) })).ok) return } catch { /* bounded startup */ }
    await new Promise(resolve => setTimeout(resolve, 500))
  }
  assert.fail('Local app did not become ready')
}
async function stopApp() {
  if (!server || server.exitCode !== null) return
  const exited = new Promise(resolve => server.once('exit', resolve))
  server.kill('SIGTERM'); await exited; server = undefined
}
async function browser(config, env) {
  const child = spawn(process.execPath, ['node_modules/@playwright/test/cli.js', 'test', '--config=' + config], { env, stdio: 'inherit' })
  const code = await new Promise(resolve => { child.on('error', () => resolve(1)); child.on('exit', resolve) })
  assert.equal(code, 0, 'WebKit checks did not pass')
}
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
  const env = { ...process.env, ...localEnvironment(status), RECOVERY_REHEARSAL: '1' }
  stage = 'configured application build'
  run(process.execPath, ['node_modules/next/dist/bin/next', 'build'], env)
  stage = 'local application startup'
  await startApp(env)
  stage = 'executed WebKit workflows'
  // Safe reporter suppresses fill arguments, captured emails, tokens and provider errors.
  await browser('playwright.local.config.mjs', env)
  const result = JSON.parse(readFileSync('test-results/local-webkit.json', 'utf8'))
  assert.equal(result.status, 'passed'); assert.equal(result.executed, 7); assert.equal(result.skipped, 0)
  console.log('PASS: 7 executed WebKit local-integration tests; zero skipped. No hosted/email-delivery/physical-device claim.')
  stage = 'quiesced synthetic backup'
  await stopApp()
  const source = identity('tradesafe-ci')
  const { manifest, backupMs } = await capture(source, status)
  stage = 'incomplete and corrupt archive rejection'
  const negativeChecks = await negativeArchiveChecks(manifest)
  stage = 'stop task-owned source, preserve source volumes'
  assertIdentity(source)
  run('supabase', ['stop', '--workdir', '.ci-local']) // No --no-backup: retain source until runner destruction.
  stage = 'distinct empty target startup'
  mkdirSync('.ci-local/restore/supabase', { recursive: true })
  writeFileSync('.ci-local/restore/supabase/config.toml', readFileSync('scripts/ci/local-config.toml', 'utf8').replace('project_id = "tradesafe-ci"', 'project_id = "' + TARGET + '"'))
  // No application migrations here: schema, ACLs, policies and ledger come from the archive.
  const targetStart = performance.now()
  run('supabase', ['start', '--workdir', '.ci-local/restore'])
  const targetStartupMs = Math.round(performance.now() - targetStart)
  const target = identity(TARGET)
  const targetStatus = parseEnv(run('supabase', ['status', '--workdir', '.ci-local/restore', '-o', 'env']).toString())
  stage = 'restore records, protections and private bytes'
  const recovery = await restore(target, source, targetStatus, manifest)
  stage = 'restored application WebKit acceptance'
  const restoredEnv = { ...process.env, ...localEnvironment(targetStatus), RECOVERY_VALIDATION: '1' }
  if (status.ANON_KEY !== targetStatus.ANON_KEY) run(process.execPath, ['node_modules/next/dist/bin/next', 'build'], restoredEnv)
  await startApp(restoredEnv)
  const validationStart = performance.now()
  await browser('playwright.recovery.config.mjs', restoredEnv)
  const validationMs = Math.round(performance.now() - validationStart)
  const restoredResult = JSON.parse(readFileSync('test-results/local-recovery-browser.json', 'utf8'))
  assert.equal(restoredResult.status, 'passed'); assert.equal(restoredResult.executed, 1); assert.equal(restoredResult.skipped, 0)
  const receipt = { status: 'SYNTHETIC_LOCAL_REHEARSAL_PASSED', commit: process.env.GITHUB_SHA, at: new Date().toISOString(),
    source, target, backupMs, targetStartupMs, ...recovery, validationMs, negativeChecks,
    archiveBytes: manifest.artifacts.reduce((n,a) => n + a.bytes, 0), artifactCount: manifest.artifacts.length,
    tableRows: manifest.beforeInventory.tables.map(({table,rows}) => ({table,rows})),
    restoredWebkit: restoredResult, browserVersions: JSON.parse(readFileSync('test-results/local-recovery-runtime.json', 'utf8')),
    limitations: ['Synthetic local data only; not hosted recovery or production RPO/RTO', 'Password identities recovered; sessions, MFA/SSO, provider configuration and secrets not recovered', 'Archive stays on ephemeral runner; no independent durable/offsite backup coverage'],
  }
  writeFileSync('test-results/local-recovery.json', JSON.stringify(receipt, null, 2))
  console.log(JSON.stringify(receipt)) // Sanitized counts, versions, hashes and test outcomes only.
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
  if (process.env.GITHUB_STEP_SUMMARY && existsSync('test-results/local-recovery.json')) writeFileSync(process.env.GITHUB_STEP_SUMMARY, '\n## Synthetic recovery rehearsal\n\n```json\n' + readFileSync('test-results/local-recovery.json', 'utf8') + '\n```\n', { flag: 'a' })
}
