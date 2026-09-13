import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { requireStaging } from './config.mjs'
import { gitIdentity } from './evidence.mjs'
const args = process.argv.slice(2)
if (args.some(value => !['--project=desktop', '--project=phone', '--phase=onboarding', '--phase=workflows'].includes(value)) ||
    args.filter(value => value.startsWith('--phase=')).length > 1) {
  console.error('BLOCKED: supported options are --project=desktop/phone and --phase=onboarding/workflows; safe reporting must remain enabled.')
  process.exitCode = 2
} else if (!requireStaging()) {
  mkdirSync('test-results', { recursive: true })
  writeFileSync('test-results/staging-browser.json', JSON.stringify({ ...gitIdentity(), status: 'BLOCKED', reason: 'Isolated configuration unavailable', timestamp: new Date().toISOString() }))
  process.exitCode = 2
} else {
  const phase = args.find(value => value.startsWith('--phase='))
  const selection = phase ? [phase === '--phase=onboarding' ? '--grep' : '--grep-invert', 'Fresh company onboarding through the interface'] : []
  const child = spawn(process.execPath, ['node_modules/@playwright/test/cli.js', 'test', '--config=playwright.staging.config.mjs', ...args.filter(value => !value.startsWith('--phase=')), ...selection],
    { env: { ...process.env, NODE_USE_SYSTEM_CA: '1', PLAYWRIGHT_BROWSERS_PATH: resolve('.staging/browsers') }, stdio: 'inherit', windowsHide: true })
  child.on('error', () => { console.error('FAIL: browser runner unavailable.'); process.exitCode = 1 })
  child.on('exit', code => { process.exitCode = code ?? 1 })
}
