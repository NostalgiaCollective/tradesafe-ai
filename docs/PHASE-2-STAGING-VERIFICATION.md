# Phase 2 staging verification

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
