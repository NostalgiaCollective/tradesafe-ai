# Phase 2 staging verification

## Recovery and live verification — 2026-09-13

Recovered branch `astra/production-mvp` at `d79ef1242b93972db7379983ecb8bb7774d93ca4`, fetched origin, and confirmed 0 ahead / 0 behind. Preserved the uncommitted pre-crash journal below, unrelated `raw/`, and all ignored configuration. [The durable operation checkpoint](staging/RECOVERY-CHECKPOINT.md) records current processes, fixtures, results and the exact next action. The older preparation records below are historical, not the current service state.

### Actual staging state

Only the locally configured and operator-verified `tradesafe-staging` project was accessed. Original project `flhsdtshwwuddzyguyhf` was not modified and is now explicitly rejected by the staging harness even if misidentified in an isolation file. The original Playwright MCP worked after reboot; its Dashboard sign-in was restored manually. No extension was installed.

Read-only Dashboard catalog reconciliation confirmed all 13 expected tables have RLS, three templates, four verified synthetic Auth users, and no unexpected users. The initial global company/membership/invitation/report/action/event counts were all zero, consistent with the saved journal. Ordinary password sessions independently verified the four accounts and exact template snapshots. The three migrations below were already applied through SQL Editor; **none was rerun and no new migration was needed**. CLI migration history remains absent; do not use `db push` without reconciling the SQL-editor journal.

After fresh desktop OWNER and phone OUTSIDER onboarding, prepared and applied the expired-invitation fixture once. Verified exact company, membership and unaccepted expired invitation IDs in the recovery checkpoint. All old/new synthetic records remain retained, including records from failed tests. No database reset, historical `schema.sql`, data cleanup, production action, main merge, charge or redesign occurred.

### Executed verification

| Check | Current result |
| --- | --- |
| Real Auth / RLS / PostgREST | PASS, all 15 named cases using ordinary synthetic sessions and the public key |
| Fresh desktop + phone onboarding | PASS, 2 cases before the identities acquired memberships |
| Remaining desktop + phone workflows | PASS, all 8 cases in the final serial run started 14:22:51 UTC on clean f2adbf4; covers persistence, retries, concurrency, finalization, amendments, actions, invitations, removal and account/session switching |
| Supplemental role/report/logout inspection | PASS, both viewports: snapshot/actor/template/amendment content, no horizontal overflow, visible logout failure and successful retry/revocation |
| Actual Chromium print output | PASS after repair: both two-page PDFs rendered with Poppler and visually inspected; all 18 questions/states, concern, actor/time/template, action state and amendment link readable without overlap |
| Natural issued JWT expiry | PASS, five checks completed 14:22:33 UTC: unchanged issued JWT receives 401/PGRST303 after expiry + 45 seconds; input retained, re-login/retry saved and reload confirmed. Same preserved draft. Temporarily issued a genuine 300-second token; provider lifetime immediately restored and reload-verified at 3600 seconds. |
| Local quality gates | PASS: lint (one existing font warning), 28 tests, typecheck, build, 17 smoke checks and browser discovery |
| Dependency audit | Zero high/critical, one previously recorded moderate advisory in the unused Anthropic filesystem memory tool; no forced/major upgrade |

Application commit is **f2adbf453050f84b80de7759334a68f64ba6adc1**. Real API (15 cases, 14:18:03 UTC) and supplemental UI (8 checks, 14:19:42 UTC) evidence identify that clean commit. Natural expiry began just before this commit and truthfully retains base d79ef12 plus a dirty tree in its evidence; the tested application/runner source was then committed unchanged as f2adbf4. Onboarding was verified once before the configured identities acquired memberships, on the earlier recorded working tree. These distinctions must not be rewritten as clean-commit onboarding/expiry results.

Timestamped JSON under ignored `test-results/staging-runs/` distinguishes pre-crash BLOCKED results, failed diagnosis runs and subsequent passes. Browser/API results persist after each case. Raw errors, fill arguments, credentials, cookies and invitation tokens are excluded from reports. Explicit screenshots/print files contain only synthetic operational records. The first natural-expiry attempt asserted after only five seconds and did not record the rejection status; it was inconclusive inside [PostgREST's 30-second clock-skew allowance](https://postgrest.org/en/stable/references/auth.html). The corrected elapsed-time run passed without an application change.

Do not run these browser suites concurrently with the same synthetic identities: the application's logout uses the provider's global session scope. An overlapping supplemental OWNER logout interrupted the phone member-removal check (14:18:03 run: seven passes, one failure at line 330). That evidence is retained. The final serial run at 14:22:51 UTC passed all eight cases, including phone member removal, with no application/source change. No product workaround or synthetic-data cleanup was used.

### Confirmed defects and bounded repairs

- Invitation initialization captured and removed the URL fragment twice under Strict Mode, erasing its in-memory token and disabling acceptance. Capture once; retain the private fragment-removal behavior. The authenticated invitation regression now verifies enabled acceptance after the hash is cleared.
- Corrective-action UI displayed an earlier saved confirmation during a later save/reopen request. Clear that confirmation when the new request begins; a deliberately held real response tests that no stale success remains visible.
- Actual multi-page print output overlapped observations on the last page. Repair print fragmentation and retain question/state grouping; do not change stored observations. Replace damaged question-mark separators in report metadata.
- Browser alert assertions also matched Next's route announcer. Scope them to application content; this was a harness defect, not a failed persistence/Auth boundary.
- Preserve timestamped incremental evidence, add a recovery inventory and supplemental UI/elapsed-expiry runners, and allow onboarding/workflows phases so existing identities are not erased or needlessly replaced. Disable Next development request/browser forwarding for staging to prevent sensitive URLs/diagnostics entering terminal logs.

`npm run test:staging:browser -- --phase=onboarding` is for unused OWNER/OUTSIDER identities only. After recorded onboarding passes, use `--phase=workflows`; do not report repeated onboarding skips as passes. `npm run check:staging:recovery` is read-only apart from ordinary Auth sessions. `npm run test:staging:ui` inspects retained finalized reports and generates local print evidence. `npm run test:staging:expiry` waits for a real token to expire, injects refresh unavailability, checks failure/input retention/re-login recovery, and refuses an unfinished expiry checkpoint.

Historical import/backfill remains covered by local PGlite fixtures; this fresh staging project has no historical reports. No immutable legacy-write guard was bypassed to fabricate one. Print PDF checks verify Chromium output, not physical printer hardware or every browser. Natural token expiry and refresh failure are recorded separately from the earlier cookie-removal test. Qualified content review, email/password recovery, privacy/retention, abuse limits, backup/restore and production release readiness remain separate gates; billing and photo/PDF storage remain deferred.

## Preserved pre-crash checkpoint — 2026-09-13

Application commit: d79ef1242b93972db7379983ecb8bb7774d93ca4 on astra/production-mvp. Original Playwright MCP session is signed in; the separate browser-client runtime was unavailable and must not be used to infer that Playwright is unavailable. Use the existing Supabase tab; preserve the other tabs.

The separate tradesafe-staging project in NostalgiaCollective's Org (Free, Canada Central) matches the exact URL/reference in ignored .env.staging.local and differs from the original application project. Daniel verified empty public tables/views, Auth users, Storage buckets, Vault secrets, database webhooks, and Edge Functions. Data API is enabled with public/graphql_public exposed; Daniel disabled automatic new-table exposure. No automatic-RLS event trigger was found; the migrations explicitly enable RLS. ASTRA inspected project integration settings: no GitHub repository, Vercel integration, or private-network connections. The original project has not been modified.

Read-only preflight results: PostgreSQL 17.6; no public/migration-history tables, public policies, or TradeSafe function remnants before installation. Extensions: pg_stat_statements 1.11, pgcrypto 1.3, plpgsql 1.0, supabase_vault 0.3.1, uuid-ossp 1.1. Daniel executed the earlier individual inventory queries; ASTRA completed an aggregate read-only SQL-editor check. No CLI migration history existed; the empty schema and functions were checked independently.

**All three reviewed migrations actually executed successfully through the staging SQL Editor on 2026-09-13, before 10:55 UTC. Do not reapply them.**

| Migration | Source SHA-256 | Real result |
| --- | --- | --- |
| 20260911000100_staging_baseline.sql | 2b4eba5bfe820cf50083ec905f75eb898daedf90e71f99d59c95023ca940773d | Success; five baseline tables subsequently verified with RLS |
| 20260911000200_company_workflow.sql | 2253ec31e618ed0bc58316325bc7df241a534d8ac45960ed3ce4808da9b9ee1d | Success; eight ts_ tables verified with RLS |
| 20260911000300_template_v1.sql | 40eb0b5da7e98d21e9352c341ec78e53b97f252b5039d0678bae3b5d2fc433eb | Success; electrical 18, plumbing 15, roofing 18 items; all pending qualified review |

Post-migration SQL verified all 13 public tables have RLS, authenticated has zero non-SELECT grants on ts_ tables, ts_command execution is granted to authenticated and denied to anon, and company/Auth user counts are both zero. CLI history remains absent because execution was through SQL Editor; reconcile this journal before any future CLI operation. These are administrator inventory checks, not ordinary-user RLS integration evidence.

An initial empty read-only query and a later read-only query with a Monaco-inserted closing parenthesis failed. Both were corrected and rerun; neither altered data. Migration submissions each returned Success and were followed by catalog verification. Source hashes above identify repository files; the editor autoformatted indentation.

**Setup progress:** Auth Site URL https://localhost:3000 and exact callback https://localhost:3000/auth/callback saved and verified after reload. Four synthetic accounts created through Dashboard Add user with individual auto-confirm (no email sent; global Auth settings unchanged). Distinct random passwords and reserved example.test email identities are stored only in ignored .env.staging.local. MCP entered them using the Windows clipboard and keyboard; password values were never read back or emitted, and the clipboard was replaced with a blank space immediately after each transfer. Isolation inventory and authorized synthetic-write opt-in are recorded locally. npm run check:staging passes.

Real ordinary-user identity precheck passed for OWNER, SUPERVISOR, WORKER and OUTSIDER: password sign-in, server-confirmed email, zero initial memberships, and exact JSON template equality for all three trades. This proves the saved public key works and template contents survived SQL-editor formatting. Initial sandbox EACCES network failures were retried with authorized network access; they were not recorded as product failures. The local precheck is .staging/verify-identities.mjs and requires unused identities; do not rerun its zero-membership assertion after onboarding.

No expiry fixture has been generated/applied, and no full authenticated integration/browser scenario has run yet. No application server is listening on port 3000. Only this checkpoint is uncommitted, plus unrelated pre-existing raw/.

**Exact next step:** launch npm.cmd run staging:dev with network access and trusted local HTTPS, then run the desktop browser suite before creating the expiry company or running the API suite. After fresh-owner onboarding, prepare/review/apply the expiry fixture once and run test:staging. The later phone suite needs a fresh four-role identity set for genuinely fresh onboarding; preserve the first set privately, never erase accounts or companies. Do not generate the expiry company before fresh-owner onboarding, because it would consume the empty-company state.

Phase 2 remains **BLOCKED for real Auth/PostgREST and authenticated browser verification**. The historical preparation record below describes the earlier checkpoint and is superseded by this active record for service setup/migrations.

Date: 2026-09-12. Branch: astra/production-mvp. Recovered/tested application checkpoint: **800cc9ce8e27584d989fade295b2a1987998475d**. No reset or discarded work. Fetch initially showed 0 ahead / 0 behind. The implementation below is the staging-verification follow-up, not a production release.

**Phase 2 remains BLOCKED for real-service verification.** No available Supabase URL/key, project reference, synthetic credentials, linked project marker or verified isolation inventory was found. The only existing nonempty local provider variable was ANTHROPIC_API_KEY; its value was never printed or changed. No Supabase/Docker/psql command was found on PATH. No project was inferred from its name or created.

## Environment and migrations actually used

| Environment | What actually happened |
| --- | --- |
| Real local/hosted Supabase | Nothing connected; preflight, migrations, fixture execution, Auth and PostgREST scenarios all BLOCKED |
| Ephemeral PostgreSQL/PGlite | Existing migration/domain tests rerun; new read-only history inventory exercised with synthetic Auth schema |
| Unconfigured Next build | Local build and 17 HTTP smoke checks passed; this does not verify company workflows |
| Authenticated browser | No scenarios executed; all remain BLOCKED by isolated configuration |
| Browser tooling | Pinned Playwright 1.63.0 and local Chromium installed; test discovery succeeds |
| Private operator setup | Blank ignored .env.staging.local and .staging/isolation.json prepared without overwriting existing files; isolation flags remain false |

All three numbered migrations remain unchanged. **No migration executed against real Supabase.** No forward migration is needed for the preparation changes made here; no database defect has been confirmed against an applied environment.

New supabase/staging-verification-preflight.sql is read-only and inspects available migration history. Missing CLI history is explicitly not treated as proof of a fresh database. The optional expired-invitation SQL generator was invoked without configuration and stopped before sign-in/file generation; no expiry fixture SQL has executed.

## Preparation and confirmed harness fixes

- Dedicated staging environment loader with variable-name-only diagnostics, exact project-origin matching, public-key enforcement, four distinct identities and a matching operator-reviewed isolation record. A project name or opt-in flag alone is insufficient.
- Negative Data API/RPC tests now require the exact intended database error. Network failures, missing functions and unrelated validation failures can no longer falsely count as authorization success.
- Added wrong-user/revoked/consumed invitation checks, a separately prepared expired-invitation fixture, permission matrix checks, cross-company reads/mutations, direct trusted-field/ownership/history writes and last-owner demotion/removal checks.
- Added true concurrent PostgREST saves, duplicate retries, business snapshots, incomplete/invalid finalization, immutable amendments, action assignment/verification/reopening and snapshot-separation assertions.
- Removed-member checks reuse the exact JWT issued before removal for raw PostgREST reads/writes. Auth identity remaining valid must not restore company access.
- Added ten discoverable desktop/phone browser scenarios. Successful requests use real staging services; deliberate lost-response/network failures are labelled as fault injection. No success fixtures mock Supabase persistence.
- Browser cases cover onboarding, settings prefill, unanswered defaults, saved refresh/reopen, edits during save, duplicate-safe lost responses, retry, concurrent tabs, finalization with hazards, amendment preservation, disabled payment endpoints, actions, invitation UI, switching, removal, session loss and account switching.
- Safe browser reporter suppresses raw error/call arguments; no credentials in reports, default screenshots, traces or videos. Skipped fixture-dependent scenarios are BLOCKED and prevent a green suite. Explicit screenshots are limited to signed-in synthetic observations.
- Next local HTTPS launcher uses .next-staging, separate from unconfigured .next smoke builds; synthetic test passwords are not passed to the app child and billing/model keys are blanked.
- Pinned testing-only Playwright dependency added; no existing application package version changed. CI discovers browser tests without executing them or loading provider secrets.

No authenticated product defect is claimed as confirmed. These are test-harness/preparation fixes and artifact separation; real application defects remain to be found by running the blocked scenarios.

## Results and evidence

| Check | Result |
| --- | --- |
| npm run lint | PASS; one existing app/layout.jsx custom-font warning |
| npm test | PASS: 28 tests, zero failed; includes actual PostgreSQL fixtures and new guard/negative-assertion regression tests |
| Targeted company SQL + harness tests after inventory additions | PASS: 7 tests |
| npm run typecheck | PASS |
| npm run build | PASS: 21 pages |
| npm run test:smoke | PASS: 17 unconfigured HTTP checks |
| npm audit --audit-level=high | PASS; existing moderate Anthropic SDK advisory remains, no high/critical finding |
| npm run test:staging:browser:list | PASS: 10 scenarios discovered; **not executed** |
| npm run check:staging | BLOCKED: missing provider/identity values and unverified isolation record |
| npm run test:staging | BLOCKED/nonzero before network writes |
| npm run test:staging:browser | BLOCKED/nonzero before browser authentication |
| staging:prepare-expiry / staging:dev | BLOCKED before fixture generation or server startup |

Local evidence locations:
- test-results/staging-integration.json: currently records a BLOCKED real-service run and tested commit.
- test-results/staging-browser.json: currently records a BLOCKED authenticated browser run.
- Future test-results/staging-evidence/: synthetic signed-in screenshots only after actual successful execution.
- docs/evidence/phase-2/: older **static**, unauthenticated component layouts; not reused as E2E proof.

No passwords, cookies, invitation tokens, public-key values or provider errors were printed. Existing .env, raw documents and historical schema are preserved. No production deployment, main merge, customer-data operation, billable project, charge or model request occurred.

Local Chromium also launched successfully against about:blank and was closed. This verifies browser tooling only, not the app or authentication. Reports include a workingTreeDirty flag so a run over uncommitted changes is not misrepresented as evidence for an exact clean commit.

## Still blocked / not yet proven

Every real Auth, RLS/PostgREST and authenticated browser scenario remains unexecuted. Passing mocks, PGlite, test discovery and a production build do not prove these boundaries.

Additional acceptance details must remain explicit even after automation runs:
- The expired-invitation case needs the reviewed isolated fixture applied by an operator; absence is BLOCKED.
- Fresh onboarding requires unused synthetic identities. Tests preserve prior companies; use fresh sets per viewport when proving first use, rather than deleting records.
- Cookie removal tests **session loss**, not natural JWT expiry. Timed server-issued-token expiry with refresh unavailable still needs real-session verification.
- Print-media assertions do not establish actual desktop/phone print-preview fidelity.
- Qualified checklist/content review, recovery/email configuration, privacy/retention, abuse controls, backup/restore and deployment readiness remain release gates from the Phase 2 handoff. Photo/PDF storage and billing are out of this task.

## Daniel's missing setup

Follow [the exact console and ignored-file instructions](staging/DANIEL-SETUP.md). Supply a verified disposable project, reviewed schema/history/migrations, four verified synthetic accounts and the private configuration. Do not paste secrets into chat.

The prepared .staging/isolation.json must be completed from an actual operator inventory, not automatically marked verified. No billable infrastructure should be created to unblock this task.

## Interruption recovery / next action

Preparation began at 800cc9ce8e27584d989fade295b2a1987998475d. The staging-verification follow-up commit contains the reviewed harnesses, pinned test dependency/lockfile, isolated artifact configuration, read-only inventory and documentation described above; use git log -1 to identify the latest delivery commit rather than resetting to the baseline. Final local quality gates passed. raw/ remains pre-existing untracked material. No application server, browser or migration is running.

Delivery includes a non-force push to the existing branch after checking remote divergence. The final response records the resulting SHA and hosted CI outcome. No real-service pass should be inferred from that CI result: CI runs only local gates and browser test discovery.

After Daniel supplies setup: run npm run check:staging; reconcile real read-only preflight/history before any migration writes; run the selected browser viewport with unused identities, prepare/apply the isolated expiry fixture once, and run npm run test:staging. Record actual outcomes and repair only confirmed defects. Do not start photo/PDF, billing or broad redesign work.
