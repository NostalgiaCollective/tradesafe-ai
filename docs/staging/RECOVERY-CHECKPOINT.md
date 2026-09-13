# Crash recovery checkpoint

Recovery started 2026-09-13. Working directory: `C:\Users\USER\Documents\tradesafe-ai`.

## Current delivery checkpoint - 2026-09-13 14:25 UTC

**Staging verification complete.** Application commit `f2adbf453050f84b80de7759334a68f64ba6adc1`; final evidence update is documentation-only. Exact-commit API15/15, serial desktop/mobile workflows8/8 and supplemental UI8/8 PASS. Earlier onboarding2/2 PASS retained; not rerun against used identities. Natural expiry5/5 PASS with the unchanged issued JWT and preserved draft; staging lifetime restored/verified3600. Local lint,28 tests,typecheck,build,17 smoke checks and audit gate PASS (one pre-existing lint warning and one moderate unused-tool advisory; zero high/critical). See verification record for precise commit/dirty-state distinctions and timestamped evidence.

All three precrash migrations reconciled and not rerun; only the recorded expired-invitation fixture transaction was executed during recovery. Original project, ignored credentials/configuration, synthetic records and unrelated raw/ preserved. Original Playwright MCP works; no extension required. Only staging HTTPS service remains running (exec67730, localhost3000); all test runners have exited. Inspect process/port before any later restart. No production/main/charge action occurred.

Next concrete operation: commit this documentation-only delivery record, verify application source unchanged from f2adbf4 and divergence has no remote-only commits, then non-force push astra/production-mvp and inspect its quality CI. Final push/CI result will also be saved to ignored `.staging/recovery-delivery.json` so a later interruption can reconcile actual remote state without repeating fixtures. The chronology below is historical; this section and final operation record take precedence.

## Confirmed local state

- Branch `astra/production-mvp`, HEAD `d79ef1242b93972db7379983ecb8bb7774d93ca4`; fetched origin and confirmed 0 ahead / 0 behind.
- Preserved the existing uncommitted verification journal and unrelated untracked `raw/`. No reset, pull, configuration overwrite or database mutation.
- Dedicated ignored staging configuration and isolation inventory exist; `check:staging` passes. No credentials printed. Original project `flhsdtshwwuddzyguyhf` remains excluded.
- Ports 3000 and 3107 had no listeners. Existing Node/browser processes were not stopped. Original Playwright MCP responds, initially on `about:blank`; Supabase Dashboard redirects to sign-in. Manual sign-in requested; no extension installation needed.
- Existing `test-results/staging-{integration,browser}.json` are BLOCKED preparation results dated 2026-09-12, for d79ef12. They are not current service verification.
- All three migration file hashes match the saved 2026-09-13 SQL-editor execution journal in `../PHASE-2-STAGING-VERIFICATION.md`. That journal reports successful application, 13 RLS tables, no CLI migration history, four verified synthetic identities, and no company/expiry fixtures. Remote state must still be reconciled after reboot; do not reapply migrations.
- No local expiry fixture files or staging server/build/certificate directory found at recovery.

## Incomplete / next operation

Run read-only ordinary-user inventory against only the configured isolated project. Once manual Dashboard sign-in is restored, verify exact project identity, actual schema/history, synthetic Auth/company/invitation/expiry state before any SQL or fixture retry. Then launch only staging HTTPS and run desktop onboarding before fixture-dependent suites. Preserve old evidence before new runs. Phone onboarding currently selects OUTSIDER; confirm whether still unused before deciding whether additional identities are necessary.

## Ordinary-session reconciliation completed

2026-09-13: `.staging/recover-state.mjs` signed in all four configured roles with the public key, verified server-confirmed emails, read visible record counts, and compared all three templates exactly. All four passed: zero visible memberships, companies, invitations, reports, actions and events. Private timestamped evidence is `.staging/recovered-ordinary-state.json`. These are RLS-limited reads, not global administrator inventory. The initial sandbox transport failure was retried with approved network access; it is not a product failure. No fixture created.

The first staging launch could not download mkcert inside the sandbox and Next fell back to HTTP. That process was stopped without running application tests. An HTTPS launch with network access is pending. Next added its `.next-staging` type directories to `tsconfig.json`; review this generated change, do not discard unrelated work.

## Live catalog reconciliation completed

2026-09-13 12:38 UTC: manual Dashboard sign-in restored on the original Playwright MCP. Exact configured project `yqkiizimbtlygovkscoh` displays `tradesafe-staging` in the expected organization. Read-only SQL Editor inventory confirms all 13 expected tables have RLS, three templates, four verified synthetic Auth users and zero non-synthetic users. Globally zero companies, memberships, invitations (including expired), reports, actions and events. Authenticated has zero non-SELECT grants on `ts_` tables; `ts_command` execution is allowed for authenticated and denied for anon. CLI migration history is absent, consistent with the saved SQL-editor execution journal. No interrupted database writes need retry or repair; do not reapply the three migrations.

Trusted HTTPS server successfully started on localhost:3000 (exec session 99510). Local lint (one existing custom-font warning), 28 tests, typecheck, build and 17 smoke checks passed. No new full acceptance results yet.

Exact next step: archive old BLOCKED reports; run fresh onboarding for desktop OWNER and phone OUTSIDER before remaining workflows consume those unused states. The runner now supports an explicit onboarding/workflows phase, and browser results persist after each test in timestamped files with project fingerprint and sanitized failure source locations. Then prepare/reconcile/apply expiry fixture once and execute real API checks. No migration or fixture SQL executed during recovery.

## Fresh desktop and phone onboarding passed

2026-09-13 12:41 UTC: both actual authenticated UI onboarding cases PASS using desktop OWNER and phone OUTSIDER. Saved companies now exist and must be retained; do not rerun fresh onboarding with these identities. This avoids creating unnecessary additional accounts. The initial sandbox browser navigation failed before login; the approved run with system certificate/network access passed both cases. Evidence: timestamped `test-results/staging-runs/browser-*.json` (started 12:40 UTC), base commit d79ef12 with working-tree changes explicitly marked.

Next: run remaining workflows with `--phase=workflows`; inspect expiry fixture absence and generate/apply once. Archive files preserve the pre-crash BLOCKED reports. Never infer these two onboarding passes cover other workflows.

## Expiry fixture applied and reconciled

2026-09-13 approximately 12:47 UTC: generated the ignored expiry SQL/companion once, reviewed its three INSERTs and transaction, then checked globally that no expiry company/invitation existed. Executed once in the exact staging SQL Editor; provider returned Success. Follow-up read-only query verified exactly one company `b2420c9d-f33e-4990-baf4-98f042e9798e`, one owner membership and one unaccepted/nonrevoked expired invitation `60ade7ec-f76e-4789-b0e2-0d0042609fac`. This is fixture SQL, not a migration. Do not regenerate/reapply. Private token remains only in ignored companion JSON; clipboard cleared after SQL transfer.

Initial remaining browser workflows report failures at lost-response/session-loss alert assertions, action reopening state assertion, and invitation workflow timeout. Partial synthetic companies/reports/actions remain preserved; these cases are not passes. Source-location diagnostics are being improved without storing raw errors or credentials. Real API suite is starting now. Next: finish API run, diagnose browser failures against preserved records, apply only confirmed fixes, rerun affected cases. Staging Next development request/browser logging is now disabled before invitation tests to keep query tokens out of terminal logs.

## API pass and confirmed fixes

All 15 real Auth/RLS/PostgREST scenarios PASS, including exact expired fixture rejection, ordinary direct-write denial, concurrent saves, immutable finalization, and removal using an already-issued JWT. Timestamped API evidence retained under `test-results/staging-runs/` (base d79ef12; dirty tree recorded).

Confirmed UI defects: invitation hash capture ran twice under Strict Mode and erased its in-memory token; added one-time capture guard without retaining the token in the URL. Corrective-action UI retained an earlier saved message during a new request; clear previous confirmation at request start. Browser alert selectors also matched Next's route announcer; scoped assertions to the application's main region. No SQL repair or migration required. Both-viewport workflow rerun is in progress (exec session 94409).

Natural-expiry verification started at 13:04 UTC, using an ordinary worker session and a new draft in an existing synthetic company. `.staging/natural-expiry-evidence.json` records report/company IDs and exact next step. Real issued JWT lifetime is 3600 seconds; expiry is **2026-09-13 14:04:27 UTC**. Refresh is deliberately made unavailable (fault injection); access JWT and provider settings remain unchanged. Exec session 66634 waits until expiry plus five seconds, then tests Data API rejection, retained editor input and re-login/retry. Do not stop staging server or clear this browser context while it runs. No expiry PASS is claimed yet.

## Print repair verified / final gates

2026-09-13 14:03 UTC: actual Chromium print revealed overlapping final-page observations that print-media DOM assertions missed. Final print-only fix uses normal block/inline text flow and keeps question/state together. Both two-page desktop/phone PDFs were rendered with local Poppler and every page inspected: all 18 observations, original concern/controls, stored actor/time/template/snapshot, current action and amendment link remain readable. Files: `test-results/staging-evidence/{desktop,phone}-finalized.pdf` and `*-print-flow-*.png`. Earlier print variants are diagnostic failures, not accepted evidence. The renderer is retained only under ignored `.staging/`; no app dependency/system installation.

During iteration, computed print CSS proved the dev server had served an earlier stylesheet. Stopped only the old staging server and restarted it (current exec session **67730**, trusted HTTPS port 3000). Current CSS was verified in-browser. Natural-expiry context/session was preserved; its draft was already saved. Updated verifier scripts are now under `scripts/staging/`, with public-key ordinary sessions and credential-safe evidence.

Final local lint, 28 tests, typecheck, build, 17 smoke checks and browser discovery pass; audit gate passes with zero high/critical and the existing single moderate unused-tool advisory. Exact next step: record natural-expiry outcome, commit reviewed fixes, rerun API/workflow checks for that commit, update delivery evidence, fetch/check divergence and push without force. Preserve raw/configuration/synthetic records. No migrations were executed during recovery; only the one recorded expiry fixture transaction was added.

## Timed expiry retry and reversible provider setting

2026-09-13 14:13 UTC: original 3600-second run failed at its premature expiry assertion (expiry + 5 seconds), inside PostgREST's documented 30-second clock-skew allowance. HTTP status was not retained, so this is inconclusive harness evidence, not a confirmed product defect. Original run is archived; original saved worker draft 11302142-3883-4422-81dc-910b1cad5b13 remains unchanged. Corrected runner waits 45 seconds, records sanitized HTTP status/code, verifies JWT claim expiry and reuses that exact ordinary worker's draft after authorization/lifecycle checks.

Dashboard /project/yqkiizimbtlygovkscoh/auth/sessions positively shows Access token expiry time = 3600. Next operation: temporarily save 300 seconds for one fresh synthetic test token, start the corrected runner, then immediately restore 3600 and reload to verify restoration. No other Auth settings, keys, environment files or original project may change. If interrupted after the first save, inspect this exact staging setting and restore 3600 before other verification. No new migration/expiry fixture is required.

2026-09-13 14:17 UTC: staging access-token lifetime 300 seconds saved and verified by reload. Corrected runner exec 27349 issued a genuine 300-second JWT, expires 14:21:44 UTC; checks start after 14:22:29 UTC. It reused and verified the preserved worker draft, with no new record. Immediately submitted restoration to original 3600 seconds; verify reload before proceeding. Do not stop server/context while timed check runs.

2026-09-13 14:17 UTC: restoration independently verified after Dashboard reload: Access token expiry time = 3600. All other provider settings and local environment files unchanged. Next: commit reviewed source, run exact-commit API and browser workflow checks while corrected expiry run finishes.

## Committed application and completed timed expiry

Application commit f2adbf453050f84b80de7759334a68f64ba6adc1 created after staged credential/excluded-path audit passed (20 files). Exact-commit API evidence at 14:18:03 UTC: all15 cases PASS with workingTreeDirty=false. Supplemental UI at14:19:42 UTC: all8 checks PASS on the same clean commit; actual two-page PDFs rendered and inspected again. Desktop/phone rendered page hashes match each other; all18 observations and original concern/current action/amendment remain readable.

Corrected elapsed-expiry run finished14:22:33 UTC: all5 checks PASS. Unchanged genuine300-second JWT (expires14:21:44) rejected401/PGRST303 after45 seconds; editor input retained, same-account re-login/retry persisted, reload confirmed. Original draft11302142-3883-4422-81dc-910b1cad5b13 reused. Provider access lifetime had already been restored and reload-verified3600. Run began before the commit, so its evidence truthfully records d79ef12/dirty; source was then committed unchanged as f2adbf4. No application expiry fix required.

The 14:18:03 browser run had7 passes and one phone member-removal failure at source line330. Supplemental logout was accidentally run concurrently against the shared OWNER identity; application signOut uses global session scope, invalidating the other session. Failed evidence and partial records retained. Serial full workflow rerun now active exec25366 (started14:22 UTC), after both supplemental/expiry processes finished. Do not start another shared-account browser runner alongside it. Next: record serial result, finish documentation-only evidence commit, push branch without force, verify remote CI. Fetched origin at14:19 UTC: one ahead/zero behind, no remote conflict; raw/configuration untouched.
