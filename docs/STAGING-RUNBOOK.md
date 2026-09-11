# TradeSafe Phase 1 staging runbook

This runbook prepares an isolated test environment. Phase 1 has **not** deployed an application, linked a Supabase project, run remote SQL, called Stripe/Anthropic, or accessed customer data. The local build is executable; live service readiness remains unverified. Do not onboard customers on this baseline.

## 1. Preserve the repository

Use `astra/production-mvp`. Discovery starts at `d2c054644632ef19a53493fdcf74f09f7bc278a7`. Check `git status`, branch and remotes before setup. Preserve uncommitted work and the original `raw/` documents. Do not run `supabase/schema.sql`. Review `docs/PHASE-1-IMPLEMENTATION.md` for Phase 1 evidence and remaining blockers.

## 2. Install and check without credentials

Use Node 24 and npm. On Windows, use `npm.cmd` if PowerShell blocks `npm.ps1`.

```sh
npm ci --ignore-scripts
npm run lint
npm test
npm run typecheck
npm run build
npm run test:smoke
npm audit --audit-level=high
```

Run smoke checks against a build made **without** public provider configuration. They start and stop a production-mode Next server on loopback port 3107 and intentionally set service variables to empty strings. They assert public HTTP 200 plus setup copy, protected HTTP 503, JSON API configuration errors, safe callback failure and HTTP 404. They do not authenticate or call remote providers. Do not run them against a configured staging/production artifact: defined public values are embedded at build time. Use a separate checkout for an unconfigured build if needed; never overwrite an operator's existing environment files.

The PostgreSQL tests are ephemeral PGlite tests, not Supabase integration certification. CI installs, lints, tests the migration/domain code, type-checks, builds, runs local HTTP checks and rejects high/critical dependency advisories. It has read-only repository permissions, no environment secrets and no deployment step. The hosted GitHub Actions run itself is not verified until the branch is pushed and the workflow executes.

For visible local review, `npm run dev` or `npm run start` after building. Home/trade pages remain available without Supabase. `/auth/login` explains setup; `/dashboard`, `/report/new` and `/settings` return a useful 503. A 200 public homepage is not proof that private services work.

## 3. Prepare isolated services

**Supabase:** Daniel or an authorized operator creates a dedicated disposable project containing only synthetic records. Confirm organization and project reference in the provider console. Inspect existing schema first using `supabase/preflight.sql`. Follow `supabase/migrations/README.md` and apply only the additive staging migration. Never run historical reset SQL. No production upgrade is authorized by these instructions.

Configure Supabase's Auth site URL to the isolated app origin, with only the needed callback URL(s), including `/auth/callback`. Enable the password, magic-link and Google methods you actually intend to test. Google OAuth requires its own configured provider credentials/redirects; do not infer that the visible button means Google is enabled. Email delivery and callback configuration must be tested with controlled inboxes. No email was sent during Phase 1 implementation.

**Stripe:** use an isolated test-mode environment and its secret key. This build retains the existing $10 CAD single-report checkout. No subscription, webhook or authoritative entitlement service exists. Never use a live key for the pilot baseline. Check cancel/retry/reconciliation manually with Stripe's current test-mode instructions; do not use real payment cards. A success URL alone is not proof of payment.

**Anthropic:** optional; use a separate project/key with a spending limit and only synthetic/non-customer images. The existing model/prompt is retained and availability is unverified. Leave the key absent to keep analysis unavailable while testing reports. MIME and 10 MiB per-file checks plus bounded response strings are basic safeguards, not upload security, consent, quota enforcement or evidence storage.

Review `docs/ENVIRONMENT-CONTRACT.md`. Configure `.env.local` privately or your future staging host's environment settings. Set `APP_ENV=staging` and HTTPS origins for a hosted staging artifact. Local development uses `APP_ENV=local` and a loopback app origin. Do not put server secrets under `NEXT_PUBLIC_*`.

Run `npm run check:env` (or `-- --all-services` when testing all providers) and rebuild after public variables change. Validation establishes syntax only; verify the project reference and credentials' actual permissions separately.

## 4. Live staging acceptance checklist (not yet executed)

Record build SHA, isolated project reference, date, browser/device and pass/fail for each check. Never include passwords, auth cookies, API keys or customer records in screenshots/logs.

| Check | Expected outcome |
| --- | --- |
| Fresh user, returning user, enabled sign-in methods | Successful session and safe internal return path; profile bootstrap does not overwrite existing business data |
| Invalid/expired callback and provider outage | Useful retry/sign-in state, no raw error or external redirect |
| Logout, expired session, unauthenticated API | Private access denied; APIs 401; connection failure distinguished from missing session |
| Empty account | Onboarding/empty report content appears only after successful empty queries |
| Failed profile/report query | Visible error/retry, never a false empty-account state or 404 for a failed query |
| Two separate synthetic users | User B cannot read, update, delete or reassign User A's reports, profiles or roster via UI or direct Data API |
| Missing and other-user report IDs | Indistinguishable not-found response; no record metadata disclosure |
| Three trade templates | Original category/item labels and order; legacy output matches baseline (default-pass behavior is a known blocker) |
| Report insert failure | Inputs remain in memory with explicit error; no success navigation; refresh resilience remains deferred |
| Settings failure | No silent overwrite from a failed load; failed mutation shows feedback and keeps entered values |
| Checkout success/cancel/failure | Canonical return URLs, report ownership checked, readable failure |
| Verification paid/unpaid/wrong owner/failed query/retry | Only matching paid CAD 1000 session accepted; useful retry message; legacy database authority is still a blocker |
| Optional AI unavailable/malformed/oversized input | Safe, bounded error; no secrets in response; no retained-photo claim |
| Desktop and phone | Readable states, keyboard focus, usable touch controls; record actual screenshots |

Use the SDK's public key and ordinary authenticated sessions to test RLS, never a service-role key. Directly test attempted cross-owner writes; UI filtering alone is not evidence. The current app has user ownership, not shared company membership. Do not test a company workflow by sharing passwords.

## 5. Diagnostics

Startup reports missing/invalid variable names. APIs return `{ error, code }` with no-store headers: 400 invalid input/auth callback, 401 unauthenticated, 404 missing/not-owned, 503 configuration/connection/query failure, and 502 payment/verification failure. Callback failures with valid canonical configuration redirect to login with a safe code; missing canonical configuration returns 503. Page error boundaries show generic retry copy because Next production error serialization hides internal details. A report-query error remains distinct from a genuine missing record.

Inspect structured application event/code logs and the isolated provider's dashboard. Do not paste raw provider logs into GitHub: they may contain sensitive data. This phase adds no paid monitoring vendor, request tracing or central log retention.

## 6. Rollback and recovery

No deployment occurred, so there is no live release to roll back. For an isolated local regression, use a separate checkout at the recorded discovery commit rather than resetting uncommitted work. That commit has the original security/configuration defects; it is a comparison baseline, not a recommended customer release.

For a future staging release, retain the last verified artifact and its matching public configuration. Restore that artifact and configuration together; leave additive database objects intact. Do not remove columns/tables or run schema reset as an application rollback. A failed migration transaction rolls back itself; a committed migration requires a reviewed forward repair. Stop testing if schema drift is found.

Supabase database backup/PITR availability, retention, restore access and auth-data recovery have not been verified. No photo storage exists in this app and no storage backup is established. Before any customer pilot, verify the actual provider plan, perform an isolated restore drill, and document data retention/deletion and recovery ownership. Do not claim a provider backup protects files or services it does not include.

## Release blockers

Missing isolated service projects/test identities; unverified hosted Auth/Data API and CI; known default-pass answers; client-writable payment/completion state; absent webhook/idempotent fulfillment; split profile tables; unsupported crew-plan enum; no durable draft or retained photo evidence; incomplete recovery and report list; unreviewed compliance claims/templates; unknown backup/restore. These require later authorized slices. Passing Phase 1 checks does not make TradeSafe customer-ready.
