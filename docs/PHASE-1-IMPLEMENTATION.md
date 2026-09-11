# Phase 1 implementation: safe executable staging baseline

Date: 2026-09-11. Branch: `astra/production-mvp`. Starting discovery commit: `d2c054644632ef19a53493fdcf74f09f7bc278a7`.

**Outcome:** the application builds without Supabase configuration, public pages render setup guidance, protected entry points fail safely, and local domain/database/HTTP checks are executable. This is a staging foundation, not production readiness or approval to onboard customers. No deployment, remote database operation, payment, model request or customer-data access occurred.

The original discovery documents describe the earlier snapshot and remain unchanged. This report records the authorized Phase 1 changes; it does not silently revise discovery findings into verified features.

## Changes

| Area | Files/modules | Result |
| --- | --- | --- |
| Configuration | `.env.example`, `.gitignore`, `instrumentation.ts`, `lib/domain/config.ts`, `lib/server/config.ts`, `scripts/check-env.mjs` | Typed variable/service contract, public-key/origin validation, server-only secret access, value-free startup diagnostics, optional integration gates |
| Auth and redirects | `proxy.js` (replaces deprecated root `middleware.js`), `lib/supabase/*`, `lib/server/auth.ts`, `lib/server/page-auth.ts`, `lib/domain/authorization.ts`, `lib/domain/validation.ts`, `app/auth/*` | Protected routes fail closed; anonymous and service failures differ; one relative redirect helper; canonical callback URL; non-overwriting profile bootstrap |
| Public and error states | `app/components/ConfigurationNotice.jsx`, `ServiceMessage.jsx`, `TradeDetailPage.jsx`, `app/page.jsx`, `app/service-unavailable/page.jsx`, `app/error.jsx`, `app/not-found.jsx`, `lib/domain/errors.ts`, `lib/server/service-response.ts` | Useful public setup state, direct uncached private 503, safe JSON errors, retry and not-found surfaces |
| Templates/domain | `lib/domain/templates.ts`, `lib/domain/reports.ts`, three public trade pages, report form/view | One checklist source with retained runtime and marketing wording; legacy answer keys/order/defaults preserved; independent work/payment types introduced without changing stored report behavior |
| Data/error handling | `app/dashboard/*`, `app/settings/*`, `app/report/new/*`, `app/report/[id]/*` | Query failures no longer appear as empty data; missing versus inaccessible reports conceal ownership; submit/settings/payment failures show recovery feedback; auth-dependent pages wait for requests before validating services |
| API boundaries | `app/api/checkout/route.js`, `checkout/verify/route.js`, `analyze-photo/route.js` | Config/auth inside handled boundaries; bounded identifiers; owner checks; canonical payment URLs; paid session amount/currency/owner checks; basic photo type/size and output bounds |
| Database | `supabase/migrations/20260911000100_staging_baseline.sql`, migration README, `supabase/preflight.sql` | Fresh-install additive migration, guarded object creation, RLS/grants, timestamp triggers, restrictive new foreign keys and read-only inventory; existing objects untouched |
| Quality | `package.json`, `package-lock.json`, `tsconfig.json`, `tests/*`, `scripts/smoke.mjs`, `.github/workflows/quality.yml` | Node 24 native tests, ephemeral PostgreSQL migration/RLS tests, HTTP smoke checks, type checking, CI install/lint/test/build/security gate; no deployment |
| Operations | This report, `ENVIRONMENT-CONTRACT.md`, `STAGING-RUNBOOK.md`, `docs/evidence/phase-1/*` | Setup, verification limits, migration/rollback instructions and actual fallback-screen screenshots |

## Compatibility and deliberate deferrals

Checklist categories, runtime labels, key construction, order and all 51 default answers match discovery. Three fixed hashes guard the runtime definitions. Marketing descriptions live alongside their runtime labels instead of in separate checklist structures. **Default pass and missing-answer-as-pass remain known unsafe behavior**, retained at the user's explicit Phase 1 boundary; this is not a safety endorsement. No new template version interpretation is applied to old reports.

The pure report module separates work and payment state for future use; existing database/UI `status=completed` still means paid. The code labels this legacy interpretation explicitly. No billing migration, server-authoritative entitlement, webhook or finalization redesign was introduced. Tests for separate types do not imply the database lifecycle has been repaired.

No company membership/RBAC, profile consolidation, subscription, report-list route, persistent drafts/photos, PDF generation, AI prompt/model redesign, broad form redesign, password reset or legal/compliance copy rewrite was attempted. Existing user-owned records and useful screens remain. Fresh-install foreign keys use `RESTRICT`; auth-user deletion must be handled separately instead of cascading away reports. Existing database foreign keys are not changed.

## Redirect policy

Only literal internal paths are accepted. Absolute/protocol-relative URLs, backslashes, control characters, whitespace, fragments, encoded paths, path normalization and malformed values fall back to `/dashboard`. Queries are removed except for a single `step=1..4` on a report path. In particular, tokens/session IDs and nested destinations are not carried through login. This preserves the requested `/report/123?step=2` shape; the legacy wizard does not gain a new query-driven navigation feature. If login expires during a payment return, reconciliation of that session remains a later billing requirement.

Login, callback and middleware share the helper. Production callback errors use only a validated configured origin; when that origin is missing, the callback returns 503. Unrecognized callback error codes cannot inject provider text or inherited object properties into the login UI.

## Verification evidence

Local environment: Windows, Node 24.14.0, Next.js 16.3.4. No isolated Supabase or Stripe configuration was available.

| Check | Observed result |
| --- | --- |
| `npm test` | 16 tests passed: redirects, environment/service gates, checklist compatibility/independence, work/payment separation, authorization predicates, request/error handling, real SQL replay and ownership policies in PGlite |
| `npm run typecheck` | Passed; typed domain/server/tests compile. Most pre-existing JSX remains JavaScript, so this is not full application type coverage. |
| `npm run lint` | Exit 0; two retained warnings listed below, zero errors |
| `npm run build` | Passed; all 14 pages generated, private pages request-rendered, API handlers dynamic |
| `npm run test:smoke` | 14 HTTP assertions passed against a local production-mode build without service configuration |
| Browser review | Actual login at 1440 x 900 and private unavailable screen at 390 x 844: readable setup/retry/home actions, no horizontal overflow, actions at least 48 CSS pixels high. Browser's expected 503 network entry is not an application crash. |
| Remote Auth/Stripe/Anthropic, hosted migrations, company isolation | Not executed/verified; staging credentials and a real company model are absent |
| GitHub Actions | Workflow added; a hosted run has not been observed locally |

Screenshots: `docs/evidence/phase-1/login-desktop.png` and `dashboard-mobile.png`. They show actual unconfigured screens, not authenticated workflow verification.

Remaining lint output (non-failing):

```text
app/layout.jsx
13:9 warning Custom fonts not added in `pages/_document.js` will only load for a single page. This is discouraged. See: https://nextjs.org/docs/messages/no-page-custom-font @next/next/no-page-custom-font

app/report/new/NewReportClient.jsx
178:13 warning Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` or a custom image loader to automatically optimize images. This may incur additional usage or cost from your provider. See: https://nextjs.org/docs/messages/no-img-element @next/next/no-img-element

2 problems (0 errors, 2 warnings)
```

The raw local-photo preview stays an `img`; replacing it is outside this phase. The existing font setup remains. No lint rules were disabled to pass.

Intermediate tests caught and fixed: a destructive-SQL test mistakenly matching the `DELETE` grant/`ON DELETE RESTRICT` rather than a delete statement; protected-page prerendering before configuration; and Next rewriting a 503 destination as HTTP 200. The final implementation returns a direct static recovery response with 503/no-store and awaits request-time rendering for private server pages. These are fixed failures, not outstanding gate exceptions.

## Dependency changes

Next and matching ESLint config moved from 16.2.1 to supported 16.3.4. Targeted supported-range fixes updated Babel, humanfs, baseline-browser-mapping, brace-expansion, browserslist, js-yaml and ws with their dependent lockfile entries. Next's own Sharp/native dependency changes follow its supported manifest. React, Supabase, Stripe and Anthropic direct dependencies were retained. No forced audit fix or automatic major upgrade was used. Added `server-only` for boundary enforcement and development-only PGlite for database tests.

Audit after remediation: **one moderate, zero high/critical**. The remaining Anthropic SDK advisory is [GHSA-p7fg-763f-g4gf](https://github.com/advisories/GHSA-p7fg-763f-g4gf), insecure local memory-tool file permissions. This app calls the messages API and does not instantiate that filesystem memory tool. Exploitability through the current application has not been demonstrated; a reviewed SDK upgrade is deferred because npm's proposed fix crosses the existing pre-1.0 compatibility range. CI rejects high/critical advisories; it is not a claim of zero vulnerabilities.

## Repository and data integrity

No production services were modified. `supabase/schema.sql`, discovery documents and `raw/intent.md` / `raw/architecture.md` remain unchanged. The `raw/` directory was untracked at the start and is intentionally left untracked. The existing ignored `.env` is unchanged and excluded from the commit. Staging tests use in-memory databases and synthetic identifiers only.

Baseline SHA-256 checksums for verification:

```text
raw/intent.md       80FB2FDBDC726FB3D7663522611A7D5F3B4E6E1A65E997980AB4E6F2D6D10434
raw/architecture.md CBEA98456E34489C754A9383C5D3E050DA7CD3BCA9114DCFECAEB9D4E1289035
supabase/schema.sql 152EDC0D721BDABF61879CBAFB93D85AA897B63F5793B2B93788EC1C8937B292
```

## Unresolved blockers

1. Isolated Supabase project, Auth settings, test users and direct Data API policy validation are not available; existing hosted schema/grants/backup state is unknown. The migration intentionally does not reconcile drift.
2. Report truth, default-pass answers, client-writable completion/payment fields and print entitlement remain production blockers. User ownership is not company membership/isolation.
3. Stripe test-mode success/recovery, canonical callback/email delivery, Anthropic model availability and hosted CI still need execution. Payment fulfillment has no webhook/idempotency; request timeout/retry can create duplicate checkouts.
4. Split profiles, crew-plan enum mismatch, missing report list, durable drafts/photos/export and recovery remain as documented in discovery. Error handling does not implement these missing features.
5. AI has no rate limit, consent/retention workflow, byte-signature verification or reverse-proxy request-body limit. `formData()` parsing precedes the per-file size check. Do not expose it broadly merely because basic validation was added.
6. No deployment target, backup/restore drill or production operational configuration has been verified. Legal/regulatory claims and content remain unreviewed.

Next authorized work should start with isolated staging verification, then the identity/ownership and report-integrity slices from `MVP-SCOPE.md`. Production deployment still requires separate authorization.

## Exact change inventory

Git status relative to the discovery commit (A = added, M = modified, R = renamed):

```text
A	.env.example
A	.github/workflows/quality.yml
M	.gitignore
M	app/api/analyze-photo/route.js
M	app/api/checkout/route.js
M	app/api/checkout/verify/route.js
M	app/auth/callback/route.js
M	app/auth/login/page.jsx
A	app/components/ConfigurationNotice.jsx
A	app/components/ServiceMessage.jsx
M	app/components/TradeDetailPage.jsx
M	app/dashboard/layout.jsx
M	app/dashboard/page.jsx
M	app/electrical/page.jsx
A	app/error.jsx
A	app/not-found.jsx
M	app/page.jsx
M	app/plumbing/page.jsx
M	app/report/[id]/PaymentVerifier.jsx
M	app/report/[id]/PrintButton.jsx
M	app/report/[id]/page.jsx
M	app/report/new/NewReportClient.jsx
M	app/report/new/page.jsx
M	app/roofing/page.jsx
A	app/service-unavailable/page.jsx
M	app/settings/SettingsClient.jsx
M	app/settings/page.jsx
A	docs/ENVIRONMENT-CONTRACT.md
A	docs/PHASE-1-IMPLEMENTATION.md
A	docs/STAGING-RUNBOOK.md
A	docs/evidence/phase-1/dashboard-mobile.png
A	docs/evidence/phase-1/login-desktop.png
A	instrumentation.ts
A	lib/domain/authorization.ts
A	lib/domain/config.ts
A	lib/domain/errors.ts
A	lib/domain/reports.ts
A	lib/domain/templates.ts
A	lib/domain/validation.ts
A	lib/server/auth.ts
A	lib/server/config.ts
A	lib/server/page-auth.ts
A	lib/server/service-response.ts
M	lib/supabase/client.js
M	lib/supabase/middleware.js
M	lib/supabase/server.js
M	package-lock.json
M	package.json
R084	middleware.js	proxy.js
A	scripts/check-env.mjs
A	scripts/smoke.mjs
A	supabase/migrations/20260911000100_staging_baseline.sql
A	supabase/migrations/README.md
A	supabase/preflight.sql
A	tests/domain.test.ts
A	tests/migration.test.mjs
M	tsconfig.json
```
