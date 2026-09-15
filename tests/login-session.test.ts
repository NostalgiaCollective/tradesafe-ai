import test from 'node:test'
import assert from 'node:assert/strict'
import { confirmBrowserSession, SESSION_MESSAGES } from '../lib/client/login-session.ts'

test('login confirmation uses same-origin cookies, no cache or redirects, and requires explicit server authentication', async () => {
  const fetcher: typeof fetch = async (url, options) => {
    assert.equal(url, '/api/auth/session')
    assert.equal(options?.credentials, 'same-origin')
    assert.equal(options?.cache, 'no-store')
    assert.equal(options?.redirect, 'error')
    assert.equal(options?.body, undefined)
    assert.equal(options?.headers, undefined)
    assert.ok(options?.signal)
    return Response.json({ authenticated: true })
  }
  assert.equal(await confirmBrowserSession(fetcher), null)
  for (const response of [Response.json({}), Response.json({ authenticated: false }), Response.json({ authenticated: 'true' }), new Response('<html>Welcome Back</html>')]) {
    assert.equal(await confirmBrowserSession(async () => response), SESSION_MESSAGES.unavailable)
  }
})

test('accepted credentials with a missing session or rejected staging gate produce distinct actionable errors', async () => {
  assert.equal(await confirmBrowserSession(async () => Response.json({ code: 'unauthorized' }, { status: 401 })), SESSION_MESSAGES.missing)
  assert.equal(await confirmBrowserSession(async () => new Response('Staging access', { status: 401, headers: { 'WWW-Authenticate': 'Basic realm="TradeSafe staging"' } })), SESSION_MESSAGES.gate)
})

test('network, service, unexpected redirects and malformed responses fail closed without leaking diagnostics', async () => {
  for (const response of [new Response('Internal details', { status: 503 }), new Response(null, { status: 307, headers: { location: '/auth/login' } }), new Response('invalid JSON', { headers: { 'Content-Type': 'application/json' } })]) {
    assert.equal(await confirmBrowserSession(async () => response), SESSION_MESSAGES.unavailable)
  }
  assert.equal(await confirmBrowserSession(async () => { throw Error('private diagnostic') }), SESSION_MESSAGES.unavailable)
})
