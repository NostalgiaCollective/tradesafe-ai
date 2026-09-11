# Phase 1 environment contract

Implemented in `lib/domain/config.ts`, guarded on the server by `lib/server/config.ts`, and checked at startup by `instrumentation.ts`. This is configuration validation, not a connection test or authorization check.

| Variable | Scope | Required for | Accepted configuration |
| --- | --- | --- | --- |
| `APP_ENV` | Server | Environment policy; defaults to `local` | `local`, `staging`, or `production`. Always set it explicitly on a hosted environment. |
| `NEXT_PUBLIC_APP_URL` | Browser + server | Account and service flows | Canonical application origin; HTTPS for staging/production. No credentials, query, fragment or path prefix. |
| `NEXT_PUBLIC_SUPABASE_URL` | Browser + server | Auth, profiles, reports | Origin of the isolated Supabase project. HTTPS for staging/production. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser + server, intentionally public | Auth, RLS-bound database requests | Supabase publishable key, or legacy JWT with `anon` role. Privileged/service-role keys are rejected. JWT role inspection is a configuration check, not signature verification. |
| `STRIPE_SECRET_KEY` | Server only | Checkout and payment verification | `sk_test_...` for local/staging. Production policy also permits `sk_live_...`; Phase 1 does not authorize its use. Never substitute a publishable or restricted key. |
| `ANTHROPIC_API_KEY` | Server only | Optional photo observations | Anthropic API key syntax (`sk-ant-...`). Use a separate staging project with spending controls. |

`NODE_ENV` is managed by Next.js; it does not replace `APP_ENV`. Node 24 is required for the native TypeScript test runner. No service-role key, database password, webhook secret or storage bucket variable is needed for this phase's application runtime. Migrations use separate operator access in the isolated Supabase console. A Stripe webhook is not implemented; do not invent/configure a webhook endpoint for this build.

## Files and build behavior

`.env.example` contains only names and safe placeholders. Copy it to an ignored `.env.local` only when that file does not already exist; fill values privately. Do not overwrite existing environment work. `.env`, `.env.local`, provider credentials and runtime logs are not source artifacts. The pre-existing local `.env` was not changed or committed.

Next.js freezes defined `NEXT_PUBLIC_*` values into browser assets at build time. Set the correct isolated values **before** `npm run build`; changing hosting variables after building does not fix browser assets. Build an artifact for each environment and keep its public and server configuration consistent. Never move a staging build to production by changing secrets alone. Only the three explicitly named public variables are read by the browser configuration helper; server modules are guarded with `server-only`.

`local` permits HTTP only on `localhost`, `127.0.0.1` or IPv6 loopback. Staging/production require HTTPS. URL validation cannot prove that a Supabase project is isolated: a human must verify its reference and data ownership before linking it.

## Validation and failure behavior

```sh
npm run check:env
npm run check:env -- --all-services
```

The first exits 0 when core account configuration is syntactically valid; the second additionally requires Stripe and Anthropic. Both print only service booleans and missing/invalid **variable names**, never values. With no Supabase configuration the expected exit is 1. `npm run build` intentionally works without external credentials; it is not a readiness probe.

Startup emits a structured `configuration_incomplete` warning containing variable names and reasons, without terminating the public site. Public home/trade pages show an account-setup notice; login shows a useful setup message. Protected pages return a readable, uncached HTTP 503 before constructing an auth client if account configuration is absent. APIs return stable JSON error codes. Callback configuration failure returns HTTP 503 instead of constructing a redirect from an untrusted origin.

With valid core configuration but no authenticated user, protected pages redirect to login with a sanitized internal destination and APIs return 401. A Supabase connection/auth-service failure is treated as unavailable, not anonymous or empty data. Missing optional provider keys disable only their operations; users can still sign in and work on reports.

## Log policy and limits

Application API errors log an event name and stable code only. They do not log provider error objects, request bodies, photo bytes, customer names, URL query tokens, keys or stack traces. Server page errors are sanitized `AppError` messages handled by the error boundary. Hosting/Supabase/Stripe/Anthropic logs still require independent retention/redaction review. Connection tests, email delivery, cookie settings and provider permissions remain unverified until staging setup.
