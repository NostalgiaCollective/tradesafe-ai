# Phase 2 implementation — company ownership and truthful reports

Updated 2026-09-11. Branch: astra/production-mvp. Baseline commit: 4ea433e99d05a1d1971dcd24a4a8551e2ce532ca. Phase 1 was verified and pushed without force; GitHub Actions run 34606878813 passed for that SHA. Remote comparison after fetch was 0 ahead / 0 behind before the Phase 2 commit.

**Outcome:** Phase 2 implementation and independently executable checks are complete locally. Real Supabase Auth/Data API integration and authenticated browser E2E remain BLOCKED. This is not production readiness. No deployment, merge, customer-data change, remote migration, charge or model request occurred.

## Implemented workflows and boundaries

| Area | Result and principal modules |
| --- | --- |
| Company identity | ts_companies and individually authenticated ts_members; owner/supervisor/worker matrix defined before implementation in AUTHORIZATION-MODEL.md; company onboarding and selection |
| Invitations/removal | Server-generated random token, stored SHA-256 digest, seven-day expiry, verified intended Auth email, revocation and one-use acceptance; consumed invitations cannot revive removed access; last-owner protection |
| Business settings | One company settings source; existing conflicting profiles retained for review; new report receives a business snapshot; later settings changes leave it unchanged |
| Templates/answers | Shared templates.ts has 51 stable question IDs across three trades, version 2026-09-unreviewed-v1; exact labels/order preserved; all answers start unanswered; invalid/missing/legacy pass never becomes meets |
| Durable drafts | Stable client-generated creation ID and duplicate-safe command; database persistence before editor navigation; debounce autosave, server-confirmed Saving/Saved/Not saved, retry using same pending request, revision conflict detection and dashboard reopen |
| Finalization | Server/database validation, required explanations and accuracy acknowledgement; actor/server time/template/snapshot version recorded; explicit unresolved hazards allowed and displayed |
| Amendments | New attributable draft linked to original with reason; original finalized document stays immutable |
| Corrective actions | Observation, immediate controls, assigned member, target date, state, resolution, authorized verifier/time and append-only history; reopening preserves old resolution/verification; no rewrite of finalized observations |
| Payment separation | Checkout and verify endpoints return unavailable after authentication; no Stripe request or client-granted paid entitlement; historic values preserved; payment never finalizes a record |
| Field UI | Reports/filter/pagination, staged job/observations/review, company/team settings, assigned actions, labels/touch targets/keyboard focus, explicit failure/empty/denied/missing states, truthful print wording |
| Authority | lib/server/workspace.ts and api/workspace validate session/membership/permission; database commands independently enforce boundaries; ordinary authenticated clients have SELECT only on new tables and cannot mutate protected fields directly |

Report answer, lifecycle, action state and billing information remain separate concepts. App roles never establish statutory competence or legal permission. Finalization records observations, does not certify compliance or authorize work, and does not resolve findings.

## Regression and deliberate deferrals

Retained Next.js 16.3.4, Supabase, electrical/plumbing/roofing questions and charcoal/amber branding. Original raw documents, historical schema and Phase 1 migration remain unchanged. Existing legacy checklist/payment values are displayed with limitations rather than silently reclassified.

Replaced the old report creator, settings widget, payment verifier and print gate with company-bound workflows. Their earlier code remains in Git. Historical crew roster entries do not become authenticated memberships. The original optional photo-analysis endpoint remains; the report editor no longer shows controls implying retained evidence. No photo, attachment or PDF storage is claimed.

Deferred: private photo evidence/generated PDF artifacts; trusted billing reconciliation/subscriptions; full offline synchronization; automated invitation email; enterprise roles; broad marketing/content redesign. Owners share generated invitation links privately using their existing channels; the app does not claim an email was sent.

Unsaved edits exist only in the open page. Refresh is safe only after Saved. Connection failures preserve in-memory edits for retry; conflict recovery lets the user inspect the latest saved record, then explicitly discard/reload if desired. There is no automatic offline merge or browser-persisted draft.

Current list limits are explicit: reports paginate by 25; historical links show at most 100; actions at most 200; action history the latest 500 company events. Larger-dataset action/history pagination is deferred and must precede customers exceeding those limits.

## Review defects corrected

- JSONB may reorder object keys: canonical content comparison prevents repeated autosaves and false Not saved states after confirmation, while preserving queued edits.
- Pending save retries retain the same request/revision; finalization retries retain their request ID.
- Missing/unknown answers and malformed historical entries display as unknown/unanswered, never implicit pass.
- Malformed business-setting values and relative work dates are rejected in database commands.
- Action filters update after confirmed changes; closure/reopening is explicit; absent history does not falsely claim an update succeeded.
- Logout failure is visible; successful sign-out refreshes the session-bound UI. Account switches do not inherit draft browser storage.
- Mobile company selection now uses a full row instead of truncating the business name.

## Checks actually executed

| Check | Result |
| --- | --- |
| npm run lint | PASS, exit 0; one pre-existing app/layout.jsx:13 custom-font warning; no errors |
| npm test | PASS, 26 tests, 0 failed |
| Targeted SQL rerun after expiry/preflight/destructive-SQL coverage additions | PASS, 9 tests, 0 failed |
| npm run typecheck | PASS |
| npm run build | PASS, 21 pages generated |
| npm run test:smoke | PASS, 17 loopback HTTP checks; public setup states, protected 503, API configuration errors, callback and missing page |
| npm audit --audit-level=high | PASS after retrying a sandbox registry failure; 0 high/critical, 1 moderate |
| npm run test:staging | BLOCKED, nonzero before network writes; missing isolated project and synthetic identity configuration |
| Static component layout | Five synthetic actual-component layouts rendered; observations inspected at 390x844 and actions at 1440x1000 |
| Layout measurements | No horizontal overflow or unlabelled inputs; visible buttons at least 48px; all 18 electrical observations unanswered |
| git diff --check | PASS |
| Historical integrity | Raw intent/architecture and supabase/schema.sql hashes match the baseline; no secrets/environment file staged |

The staging blocker output was:
~~~
BLOCKED: isolated staging configuration and explicit synthetic-write opt-in required. Missing names: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, STAGING_ISOLATED_PROJECT_REF, STAGING_OWNER_EMAIL, STAGING_OWNER_PASSWORD, STAGING_WORKER_EMAIL, STAGING_WORKER_PASSWORD, STAGING_SUPERVISOR_EMAIL, STAGING_SUPERVISOR_PASSWORD, STAGING_OUTSIDER_EMAIL, STAGING_OUTSIDER_PASSWORD
~~~

APP_ENV=staging and STAGING_ALLOW_SYNTHETIC_WRITES=yes are also required. See STAGING-RUNBOOK.md for setup. PGlite executes PostgreSQL policies/functions with synthetic Auth context; it does not prove real Supabase isolation. Static screenshots are not hydrated/authenticated E2E.

The moderate advisory is GHSA-p7fg-763f-g4gf, affecting the Anthropic SDK filesystem memory tool. That tool is not used by the application. No major dependency upgrade or audit fix --force was performed; API/private-evidence integration and a tested SDK update remain future work.

During development, lint exposed a fixture-loader variable naming error and a navigation warning; both were fixed, and the final lint rerun above passed. Earlier validation is historical; only executed results are claimed.

## Migrations: created versus executed

- 20260911000200_company_workflow.sql: created; executed only in ephemeral PGlite, including synthetic conflicting-profile/legacy-report fixtures.
- 20260911000300_template_v1.sql: generated from the shared module; executed only in those fixtures.
- supabase/phase-2-preflight.sql: read-only inventory, executed in those fixtures.
- No migration was executed in real local Supabase, hosted staging or production.

See supabase/migrations/README.md for exact ordering, one-company-per-legacy-user backfill, field precedence and production-upgrade separation. No drop, truncate, destructive cascade or legacy data deletion was introduced. Do not roll the Phase 1 app back onto a Phase 2 database: its legacy writes are intentionally frozen.

## Release blockers and remaining risk

1. Real isolated Supabase Auth/PostgREST/Data API verification, including direct protected-field attempts, revocation, provider grants and authenticated browser draft/expiry/concurrency/finalization workflows.
2. Qualified Ontario checklist review and remaining public content/claim review; software validation does not validate legal requirements.
3. Password recovery and actual sign-in provider/email configuration; abuse/rate limits for invitations and optional AI.
4. Backup/restore drill, deployment configuration, operational diagnostics and retention/deletion/privacy/support review.
5. Retained private evidence/generated artifacts and trusted billing are deferred; paid commercial access is unavailable.
6. Moderate unused-tool SDK advisory and bounded action/history lists remain documented risks.

## Delivery and recovery

Implementation commit: **91d581577fffc5b3f475efed96c870d02fc3a2f5**, pushed without force to origin/astra/production-mvp. GitHub Actions [run 34644937911](https://github.com/NostalgiaCollective/tradesafe-ai/actions/runs/34644937911) passed install, lint, all tests, typecheck, build, smoke and the dependency gate for that exact SHA.

The following small delivery checkpoint records this evidence, replaces damaged display separators, and sets the scoped dark colour scheme so native date controls remain legible. It changes no database or authorization behavior. Use git log -1 for the latest delivery commit; do not reset to the implementation SHA if newer work exists.

All Phase 2 implementation files are committed. The pre-existing raw/ directory remains untracked and must not be staged. Local environment files are unchanged. No migration or build is pending, and the temporary loopback fixture server was stopped after review. The only remaining Phase 2 verification work requires the isolated services below.

Next implementation slice: configure a disposable Supabase project with four verified synthetic identities, execute the reviewed migration sequence, run npm run test:staging, then the authenticated phone/desktop acceptance matrix. Fix real Auth/RLS/concurrency findings before private photo/PDF storage or billing work. Do not use production to unblock these checks.
