import { spawn } from 'node:child_process'
import { resolve } from 'node:path'
// Local test tooling only; no Supabase connection or cloud resource creation.
const child = spawn(process.execPath, ['node_modules/@playwright/test/cli.js', 'install', 'chromium'], {
  env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: resolve('.staging/browsers') }, stdio: 'inherit', windowsHide: true,
})
child.on('error', () => { console.error('FAIL: local browser installation unavailable.'); process.exitCode = 1 })
child.on('exit', code => { process.exitCode = code ?? 1 })
