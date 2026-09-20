import assert from 'node:assert/strict'

export const APP_ORIGIN = 'http://127.0.0.1:3000'
export const API_ORIGIN = 'http://127.0.0.1:54321'
export const MAIL_ORIGIN = 'http://127.0.0.1:54324'
export function localEnvironment(status) {
  // This harness never reads .env.staging.local or accepts a configurable target.
  assert.equal(status.API_URL, API_ORIGIN, 'Disposable API must be loopback')
  const claim = key => JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString())
  assert.equal(claim(status.ANON_KEY).role, 'anon')
  assert.equal(claim(status.SERVICE_ROLE_KEY).role, 'service_role')
  return {
    APP_ENV: 'local', NEXT_PUBLIC_APP_URL: APP_ORIGIN,
    NEXT_PUBLIC_SUPABASE_URL: API_ORIGIN, NEXT_PUBLIC_SUPABASE_ANON_KEY: status.ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: status.SERVICE_ROLE_KEY,
    HOSTED_STAGING: '', TRADESAFE_STAGING_ARTIFACT: '1',
    STRIPE_SECRET_KEY: '', ANTHROPIC_API_KEY: '', RECOVERY_EMAIL_ENABLED: 'no',
    RECOVERY_ALLOWED_EMAILS: '', NEXT_PUBLIC_GOOGLE_AUTH_ENABLED: 'false',
    NEXT_PUBLIC_MAGIC_LINK_ENABLED: 'false', NEXT_TELEMETRY_DISABLED: '1',
  }
}
