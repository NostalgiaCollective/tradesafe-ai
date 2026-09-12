import test from 'node:test'
import assert from 'node:assert/strict'
import { roles, stagingIssues } from '../scripts/staging/config.mjs'
import { expectDatabaseError } from '../scripts/staging/assertions.mjs'
const ref = 'abcdefghijklmnopqrst'
const env = { APP_ENV: 'staging', NEXT_PUBLIC_APP_URL: 'https://localhost:3000',
  NEXT_PUBLIC_SUPABASE_URL: 'https://' + ref + '.supabase.co', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'sb_publishable_synthetic',
  STAGING_ISOLATED_PROJECT_REF: ref, STAGING_ALLOW_SYNTHETIC_WRITES: 'yes',
  ...Object.fromEntries(roles.flatMap(role => [['STAGING_' + role + '_EMAIL', role + '@example.test'], ['STAGING_' + role + '_PASSWORD', 'synthetic-only']])) }
const isolation = { projectRef: ref, appOrigin: env.NEXT_PUBLIC_APP_URL, syntheticOnly: true, noProductionConnections: true,
  verifiedBy: 'Synthetic operator', verifiedAt: '2026-09-12', inventoryReviewed: true }
test('staging writes require explicit isolation evidence, public keys and distinct identities', () => {
  assert.deepEqual(stagingIssues(env, isolation), [])
  for (const changed of [{ APP_ENV: 'production' }, { STAGING_ALLOW_SYNTHETIC_WRITES: 'no' },
    { NEXT_PUBLIC_SUPABASE_ANON_KEY: 'sb_secret_not_allowed' }, { NEXT_PUBLIC_SUPABASE_URL: env.NEXT_PUBLIC_SUPABASE_URL + '/unexpected' },
    { STAGING_WORKER_EMAIL: env.STAGING_OWNER_EMAIL }, { NEXT_PUBLIC_APP_URL: 'http://localhost:3000' }]) {
    assert.ok(stagingIssues({ ...env, ...changed }, isolation).length)
  }
  assert.ok(stagingIssues(env, undefined).length)
  assert.ok(stagingIssues(env, { ...isolation, syntheticOnly: false }).length)
  assert.ok(stagingIssues(env, { ...isolation, projectRef: 'different' }).length)
})
test('authorization tests cannot pass because of network, schema or unrelated validation failures', () => {
  expectDatabaseError({ error: { code: 'P0001', message: 'TS_denied' } }, 'TS_denied')
  expectDatabaseError({ error: { code: '42501' } }, '42501')
  for (const error of [null, { code: 'PGRST202' }, { message: 'Fetch failed' }, { code: 'P0001', message: 'TS_invalid' }]) {
    assert.throws(() => expectDatabaseError({ error }, 'TS_denied'))
  }
})
