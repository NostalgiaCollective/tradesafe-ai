# TradeSafe isolated staging runbook — Phase 2

## Phase 3 continuation

Read [Phase3 implementation/API/operations](PHASE-3-EVIDENCE-EXPORTS.md) and [Phase3 recovery checkpoint](staging/PHASE-3-CHECKPOINT.md) before new work. The additive private-evidence/export migration is applied to staging; do not replay it or the three existing SQL-editor migrations. CLI history remains absent. New server-only staging configuration lives in ignored `.staging/server.env`, separate from ordinary-user test credentials. Browser suites sharing identities must run serially. Phase2 recovery and onboarding/elapsed-expiry verification remain completed historical evidence.

## Crash-recovery execution — 2026-09-13

Start with [the live verification record](PHASE-2-STAGING-VERIFICATION.md) and [the durable recovery checkpoint](staging/RECOVERY-CHECKPOINT.md). They supersede the historical setup/BLOCKED statements below. The three migrations were applied through SQL Editor and reconciled after reboot; do not rerun them or the already-applied expiry fixture. Existing synthetic users and records must be retained.

Run `npm run check:staging` and `npm run check:staging:recovery`, inspect active ports/processes and actual catalog/history, then start only the required staging HTTPS server. A new browser process does not imply a missing extension; try the original Playwright MCP and use manual Dashboard sign-in if necessary. Do not proceed if Next falls back to HTTP after certificate setup fails.

For unused configured identities, run `npm run test:staging:browser -- --phase=onboarding` first; desktop uses OWNER and phone uses OUTSIDER. Then use `--phase=workflows` for the remaining cases. These identities have already passed onboarding, so current reruns must select workflows. API/browser evidence is also retained by timestamp under `test-results/staging-runs/`. Supplemental commands are `test:staging:ui` (preserved finalized reports and actual print PDFs) and `test:staging:expiry` (natural expiry, deliberately unavailable refresh, retained input and re-login). Inspect the expiry checkpoint before retrying a long run.

Run browser workflows, supplemental UI and elapsed-expiry suites serially when they share identities. Logout uses global session scope and can invalidate another runner's session. Natural expiry waits 45 seconds beyond the unchanged JWT's actual expiry to exceed PostgREST's clock-skew allowance. The completed recovery used a temporarily issued 300-second staging token and immediately restored/verified the original 3600-second provider setting; that setting is now restored. The expiry runner reuses its retained draft after ordinary authorization/lifecycle checks and archives previous completed evidence. Never silently clear a running checkpoint or recreate its fixtures.

## Staging verification update — 2026-09-12

Use [Daniel's precise console/setup handoff](staging/DANIEL-SETUP.md) and [the current verification record](PHASE-2-STAGING-VERIFICATION.md). The guarded runners now read **.env.staging.local**, not the ordinary .env/.env.local files, and require **.staging/isolation.json** with matching project/app identification and a real operator inventory. Blank ignored files have been prepared without modifying existing local secrets.

Run npm run check:staging first. npm run staging:dev uses a separate .next-staging directory and trusted local HTTPS. npm run test:staging:browser runs the prepared desktop/phone scenarios; list/discovery in CI does not execute them. Missing setup, unused-identity requirements and the absent expired-invitation fixture remain BLOCKED. The earlier sections below describe the acceptance matrix; the linked setup instructions take precedence for configuration and fixture handling.

This supersedes Phase 1 staging expectations. No deployment or real Supabase migration has been performed. Never substitute production services or customer data for staging.

## Repository and local checks

Use astra/production-mvp. Phase 1 baseline: 4ea433e99d05a1d1971dcd24a4a8551e2ce532ca. See PHASE-2-IMPLEMENTATION.md for current evidence. Inspect status and remote divergence; preserve raw documents and local secrets. Never run supabase/schema.sql.

Use Node 24 and npm (npm.cmd in Windows PowerShell):

~~~sh
npm ci --ignore-scripts
npm run lint
npm test
npm run typecheck
npm run build
npm run test:smoke
npm audit --audit-level=high
~~~

Smoke tests start/stop their own production-mode server on loopback port 3107. They require a build made without public Supabase configuration, since public values are embedded at build time. They check 17 public/protected/API/error paths without external services. Use a separate checkout if necessary; never overwrite existing operator configuration.

The unit/SQL suite uses native Node and ephemeral PGlite databases with synthetic Auth context. It executes actual migrations, privileges and policies, but does not establish real Supabase Auth, PostgREST or browser isolation. CI has no deployment step or provider secrets.

## Prepare an isolated Supabase project

1. An authorized operator creates a disposable project containing only synthetic records and verifies its organization/reference in the provider console.
2. Run read-only supabase/preflight.sql and supabase/phase-2-preflight.sql. Review drift, grants and functions. Follow supabase/migrations/README.md and apply the three numbered migrations in order. Never run a reset or mix SQL-editor and CLI migration histories without reconciliation.
3. Set APP_ENV=staging, the canonical HTTPS app origin, Supabase URL and public/anon key before building. No service-role key belongs in the application or integration script.
4. Configure Auth site/callback URLs, including /auth/callback. Enable only intended sign-in methods and verify delivery/redirects with controlled accounts. Visible Google/password/magic-link controls do not prove provider setup.
5. Create four separate verified synthetic accounts: owner, worker, supervisor and outsider. Keep their values privately in ignored environment files or process configuration.

## Real Auth / Data API test

~~~sh
npm run test:staging
~~~

Required names; never commit their values:

- APP_ENV=staging
- NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
- STAGING_ISOLATED_PROJECT_REF, matching the hosted Supabase URL exactly
- STAGING_ALLOW_SYNTHETIC_WRITES=yes
- STAGING_OWNER_EMAIL and STAGING_OWNER_PASSWORD
- STAGING_WORKER_EMAIL and STAGING_WORKER_PASSWORD
- STAGING_SUPERVISOR_EMAIL and STAGING_SUPERVISOR_PASSWORD
- STAGING_OUTSIDER_EMAIL and STAGING_OUTSIDER_PASSWORD

The script refuses missing setup before network writes. It authenticates through the public key, creates a unique synthetic company, accepts identity-bound invitations, exercises report/action commands and attempts forbidden direct Data API writes. It retains synthetic records for investigation, has no destructive cleanup and uses no privileged credentials. Record the SHA, project reference and result privately; omit passwords, cookies and invitation tokens. This script remains unexecuted against real services.

## Authenticated browser acceptance — still blocked

Run against the same isolated project and record phone/desktop outcomes:

| Scenario | Required observation |
| --- | --- |
| New/returning account | Company onboarding or company records; query failures never appear as an empty account |
| Business settings | Saved settings prefill a new draft; later settings changes leave its business snapshot unchanged |
| Invitation | Intended verified account accepts; wrong email, expired/revoked/consumed misuse fails; no email-send claim |
| Membership | Individual accounts share company records; worker cannot edit another author's record or verify closure; last owner retained |
| Draft creation | Stable saved ID; all answers unanswered; lost-response retry creates no duplicate |
| Autosave/resume | Saving then Saved after confirmation; refresh/reopen restores stored answers; edits during save remain queued |
| Connection/auth expiry | Not saved plus retry/sign-in state; in-memory inputs retained; no offline persistence promise |
| Concurrent tabs | Stale revision rejected; latest saved record accessible without silently overwriting current edits |
| Review | Missing answers/explanations and absent acknowledgement block finalization |
| Unresolved concern | Finalization records concern prominently and creates a separate open action |
| Finalized report | Direct ordinary update/delete denied; amendment creates linked attributable draft; original unchanged |
| Corrective action | Assignment/date/controls/resolution; authorized verification; reopening retains prior verification in history |
| Removed member | Subsequent UI/API/Data API access denied, including historical company reports |
| Payment | Both checkout endpoints unavailable; no charge, entitlement grant, safety finalization or resolution |
| Historical record | Stored answers shown with unknown default-pass provenance; missing never becomes pass/fail |
| Accessibility/print | Keyboard focus, labels, readable phone layout and accurate snapshot, actor/time and concern wording |
| Logout/account switch | Failed logout shows error; successful logout revokes access; another account does not inherit draft state |

Use ordinary authenticated sessions for negative RLS checks. Missing and cross-company report reads are indistinguishable; explicit company/action denial can say access denied. Network/query failures remain errors, never false empty data or 404.

Static fixtures (node scripts/render-workflow-fixtures.mjs after build) render actual components with synthetic props into ignored test-results/phase2-ui. They are not hydrated and cannot establish persistence/E2E. Screenshots in docs/evidence/phase-2 visibly state this limitation.

## Services and diagnostics

Checkout and verification are disabled regardless of Stripe configuration. Historical payment information remains unchanged. Do not run test or live charges in this phase.

The previous optional photo-analysis API remains but has no report attachment surface in Phase 2. Do not send customer photos; private storage, consent, quotas and retained evidence are not implemented. Anthropic is unnecessary for core Phase 2 workflows. Its moderate SDK advisory is documented; the affected filesystem memory tool is not used.

Startup logs variable names only. APIs return no-store error/code responses: invalid 400, unauthenticated 401, denied 403, missing/inaccessible report 404, stale/immutable/last-owner 409, incomplete 422, unavailable/configuration/query failure 503. No provider stack traces, tokens or observations enter application error logs. Hosted log retention/redaction still needs review.

## Rollback and recovery

No live release exists to roll back. Failed migration transactions roll themselves back. After commit, retain additive objects/data and use a reviewed forward repair or a new disposable project. Never delete migrations or run destructive down SQL.

Do not restore the Phase 1 app against a Phase 2 database: the legacy-write freeze intentionally makes the old report/settings/checkout flows incompatible. Pause staging access and use a matching verified Phase 2 artifact or forward repair. Keep original comparisons in a separate isolated environment.

Provider backup/PITR availability, retention, restore access and Auth-data recovery are unknown. Before customer use, verify infrastructure and perform an isolated restore drill. Account deletion requires a reviewed retention procedure; foreign keys preserve report history.

## Release gates

Real Auth/Data API and authenticated browser tests; qualified checklist/content review; password recovery; privacy/retention/support policy; backup/restore/deployment verification; abuse/rate limits. Secure photo/PDF evidence and trusted billing remain later slices. Local passing checks do not establish production readiness.
