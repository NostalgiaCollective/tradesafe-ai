// Local HTTP checks against the production build. No remote services or real credentials.
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { setTimeout as delay } from 'node:timers/promises'

const port = 3107
const origin = `http://127.0.0.1:${port}`
const env = {
  ...process.env, APP_ENV: 'local', NEXT_TELEMETRY_DISABLED: '1',
  NEXT_PUBLIC_APP_URL: '', NEXT_PUBLIC_SUPABASE_URL: '',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: '', STRIPE_SECRET_KEY: '', ANTHROPIC_API_KEY: '',
}
const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', String(port)], {
  env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
})
// Drain output without printing environment/provider diagnostics.
child.stdout.resume()
child.stderr.resume()
let launchError
child.on('error', error => { launchError = error })
let checks = 0
try {
  let ready = false
  for (let attempt = 0; attempt < 100; attempt++) {
    if (launchError || child.exitCode !== null) throw new Error('Smoke server could not start; check build and port 3107.')
    try {
      const response = await fetch(origin, { signal: AbortSignal.timeout(1000) })
      if (response.status === 200) { ready = true; break }
    } catch { /* Startup only; fail below if never ready. */ }
    await delay(300)
  }
  assert.ok(ready, 'Production server must become ready')
  async function request(path, options = {}) {
    return fetch(origin + path, { redirect: 'manual', signal: AbortSignal.timeout(10000), ...options })
  }
  for (const path of ['/', '/electrical', '/plumbing', '/roofing', '/auth/login']) {
    const response = await request(path)
    assert.equal(response.status, 200, path)
    assert.match(await response.text(), /setup|configured/i, path + ' explains unavailable configuration')
    checks++
  }
  for (const path of ['/dashboard', '/report/new', '/report/11111111-1111-4111-8111-111111111111', '/settings', '/actions', '/reports']) {
    const response = await request(path)
    assert.equal(response.status, 503, path)
    assert.match(response.headers.get('cache-control'), /no-store/)
    assert.match(await response.text(), /Account services|not configured/i)
    checks++
  }
  for (const path of ['/api/checkout', '/api/checkout/verify', '/api/analyze-photo', '/api/workspace']) {
    const response = await request(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
    assert.equal(response.status, 503, path)
    assert.equal((await response.json()).code, 'configuration', path)
    checks++
  }
  const callback = await request('/auth/callback?redirect=https%3A%2F%2Fexample.com')
  assert.equal(callback.status, 503)
  assert.equal(callback.headers.get('location'), null)
  assert.match(await callback.text(), /not configured/)
  checks++
  assert.equal((await request('/does-not-exist')).status, 404)
  checks++
  console.log(`PASS: ${checks} local HTTP smoke checks; no configured external services.`)
} finally {
  if (child.exitCode === null && !launchError) {
    const exited = once(child, 'exit')
    child.kill()
    await exited
  }
}
