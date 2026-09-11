import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { safeRedirect, readObject, requireString, UUID } from '../lib/domain/validation.ts'
import { validateEnvironment, validOrigin, validPublicKey } from '../lib/domain/config.ts'
import { CHECKLISTS, buildChecklistState, marketingChecklist } from '../lib/domain/templates.ts'
import { withPayment, withWorkStatus, isLegacyPaid } from '../lib/domain/reports.ts'
import { ownsRecord, requireOwner, isProtectedPath, isAnonymousError } from '../lib/domain/authorization.ts'
import { AppError, errorResponse } from '../lib/domain/errors.ts'

test('internal redirects preserve only the approved report step', () => {
  for (const path of ['/dashboard', '/report/new', '/report/123?step=2']) assert.equal(safeRedirect(path), path)
  assert.equal(safeRedirect('/report/123?step=2&redirect=https://example.com&token=secret'), '/report/123?step=2')
  assert.equal(safeRedirect('/report/new?step=2&step=3'), '/report/new')
  assert.equal(safeRedirect('/dashboard?step=2'), '/dashboard')
})
test('unsafe, encoded, malformed and missing redirects fall back', () => {
  for (const value of [undefined, null, '', 42, {}, [], 'https://example.com', '//example.com', '/\\example.com', 'javascript:alert(1)', '/%2f%2fexample.com', '/%252fexample.com', '/a/../dashboard', '/a//b', ' /dashboard', '/dashboard\n', '/dashboard#x', '/%zz', '/@example.com', 'https://internal.invalid/dashboard']) {
    assert.equal(safeRedirect(value), '/dashboard', String(value))
  }
})
const core = { APP_ENV: 'local', NEXT_PUBLIC_APP_URL: 'http://localhost:3000', NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'sb_publishable_test_fixture_not_a_credential' }
test('missing configuration disables services without values in diagnostics', () => {
  const result = validateEnvironment({})
  assert.deepEqual(result.services, { supabase: false, stripe: false, anthropic: false })
  assert.ok(result.issues.some(i => i.variable === 'NEXT_PUBLIC_SUPABASE_URL'))
  const unsafe = 'https://person:private-value@example.com'
  assert.ok(!JSON.stringify(validateEnvironment({ ...core, NEXT_PUBLIC_SUPABASE_URL: unsafe })).includes('private-value'))
})
test('core setup enables auth while optional integrations stay unavailable', () => {
  assert.deepEqual(validateEnvironment(core).services, { supabase: true, stripe: false, anthropic: false })
  assert.ok(validateEnvironment({ ...core, APP_ENV: 'unknown' }).issues.some(i => i.variable === 'APP_ENV'))
})
test('URLs and public keys reject privileged or insecure configuration', () => {
  for (const origin of ['http://example.com', 'https://example.com/path', 'https://name:password@example.com', 'https://example.com?x=1', 'bad']) assert.equal(validOrigin(origin), false)
  assert.equal(validOrigin('http://localhost:3000', false), false)
  assert.equal(validPublicKey('sb_secret_test_fixture'), false)
  const key = (role: string) => 'header.' + Buffer.from(JSON.stringify({ role })).toString('base64url') + '.signature'
  assert.equal(validPublicKey(key('service_role')), false)
  assert.equal(validPublicKey(key('anon')), true)
  assert.equal(validPublicKey('invalid'), false)
})
test('staging requires HTTPS and test payments; key syntax does not prove connectivity', () => {
  const staging = { ...core, APP_ENV: 'staging', NEXT_PUBLIC_APP_URL: 'https://staging.example.com', NEXT_PUBLIC_SUPABASE_URL: 'https://staging.example.supabase.co' }
  assert.equal(validateEnvironment({ ...staging, STRIPE_SECRET_KEY: 'sk_live_fixture' }).services.stripe, false)
  assert.equal(validateEnvironment({ ...staging, STRIPE_SECRET_KEY: 'sk_test_fixture' }).services.stripe, true)
  assert.equal(validateEnvironment({ ...staging, NEXT_PUBLIC_APP_URL: 'http://localhost:3000' }).services.supabase, false)
})
test('centralized runtime labels/order match the discovery commit exactly', () => {
  const hashes = { electrical: 'cf4c325dd0b68a5fbc4c633fceeeb6224389d83d5f2554ee1d0623150d8e91cc', plumbing: '1a5f7aee789257bd3b6162dfa3c600e3a50a1d082853f0e6b555a81dfdea50cf', roofing: 'b0306150a5ca1ef7bd02fb8d37c7b63e5776bd5cdec598e460832553237316b6' }
  for (const trade of ['electrical', 'plumbing', 'roofing'] as const) {
    assert.equal(createHash('sha256').update(JSON.stringify(CHECKLISTS[trade])).digest('hex'), hashes[trade])
    assert.equal(marketingChecklist(trade).flatMap(s => s.items).length, trade === 'plumbing' ? 15 : 18)
  }
})
test('legacy checklist state remains independent and compatible, not a safety endorsement', () => {
  const first = buildChecklistState('electrical'), second = buildChecklistState('electrical')
  assert.equal(Object.keys(first).length, 18)
  assert.ok(Object.values(first).every(answer => answer.status === 'pass' && answer.notes === ''))
  first[Object.keys(first)[0]].status = 'fail'
  assert.equal(second[Object.keys(second)[0]].status, 'pass')
  assert.deepEqual(buildChecklistState('unknown'), {})
})
test('payment transitions do not finalize work and work transitions do not pay', () => {
  const state = { work: 'draft', payment: 'unpaid' } as const
  assert.deepEqual(withPayment(state, 'paid'), { work: 'draft', payment: 'paid' })
  assert.deepEqual(withWorkStatus(state, 'finalized'), { work: 'finalized', payment: 'unpaid' })
  assert.deepEqual(state, { work: 'draft', payment: 'unpaid' })
  assert.equal(isLegacyPaid('completed'), true)
  for (const value of ['finalized', 'draft', null]) assert.equal(isLegacyPaid(value), false)
})
test('ownership and path guards fail closed at boundaries', () => {
  assert.equal(ownsRecord(undefined, undefined), false)
  assert.equal(ownsRecord('a', 'b'), false)
  assert.equal(ownsRecord('a', 'a'), true)
  assert.throws(() => requireOwner('a', { user_id: 'b' }), (e) => e instanceof AppError && e.status === 404)
  for (const path of ['/dashboard', '/report/new', '/reports', '/settings/profile']) assert.equal(isProtectedPath(path), true)
  for (const path of ['/', '/reporting', '/dashboard-public']) assert.equal(isProtectedPath(path), false)
  assert.equal(isAnonymousError({ name: 'AuthSessionMissingError' }), true)
  assert.equal(isAnonymousError({ status: 503 }), false)
})
test('request validation distinguishes malformed input from a valid object', async () => {
  assert.deepEqual(await readObject(new Request('http://localhost', { method: 'POST', body: '{"ok":true}' })), { ok: true })
  for (const body of ['null', '[]', '{']) await assert.rejects(readObject(new Request('http://localhost', { method: 'POST', body })), AppError)
  assert.throws(() => requireString('not-a-uuid', UUID), AppError)
})
test('error responses distinguish configuration, auth, missing records and provider failure without leaking details', async () => {
  for (const [code, status] of [['configuration', 503], ['unauthorized', 401], ['not_found', 404], ['query_failed', 503], ['payment_failed', 502], ['verification_failed', 502]] as const) {
    const response = errorResponse(new AppError(code))
    assert.equal(response.status, status)
    assert.equal((await response.json()).code, code)
  }
  const response = errorResponse(new Error('provider-secret-value'), 'payment_failed')
  assert.ok(!(await response.text()).includes('provider-secret-value'))
})
