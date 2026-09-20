import test from 'node:test'
import assert from 'node:assert/strict'
import { localEnvironment, API_ORIGIN } from '../scripts/ci/local-environment.mjs'
const key = role => 'local.' + Buffer.from(JSON.stringify({ role })).toString('base64url') + '.local'
test('disposable CI harness rejects remote targets and privileged browser credentials', () => {
  const status = { API_URL: API_ORIGIN, ANON_KEY: key('anon'), SERVICE_ROLE_KEY: key('service_role') }
  assert.equal(localEnvironment(status).APP_ENV, 'local')
  for (const API_URL of ['https://yqkiizimbtlygovkscoh.supabase.co', 'http://localhost:54321', API_ORIGIN + '/remote']) assert.throws(() => localEnvironment({ ...status, API_URL }))
  assert.throws(() => localEnvironment({ ...status, ANON_KEY: key('service_role') }))
  assert.throws(() => localEnvironment({ ...status, SERVICE_ROLE_KEY: key('anon') }))
})
