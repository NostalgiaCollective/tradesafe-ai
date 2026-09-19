# Interrupted work and concurrent editing

Scope: isolated staging; reuse existing autosave, request IDs, revision checks, private evidence and immutable snapshots. No migration, role change, email, credential reset, paid resource or destructive cleanup. Onboarding phone acceptance and prior production gates remain pending.

## Confirmed gaps and bounded changes

- Disable draft input until its save handlers are ready; show Loading save controls during startup. Keep validated report/action destinations in recovery sign-in links.
- Correct failed photo-list refresh feedback so it cannot claim success.
- Add leave-page warnings for selected photos and navigation between application pages with unsaved work. Text/files remain in the open page only; no offline or closed-browser recovery claim.
- Bind draft, action, photo, finalization and amendment submissions to the account that opened the form. This additional server check supplements existing authentication, membership and role enforcement; it grants no permission.
- After ambiguous finalization, read the authorized server state and open the finalized report when confirmed. Before retrying, read it again. Freeze observations while the result is unknown; do not merge a newer revision. PDF preparation remains separate.
- Before retrying an amendment, retrieve the existing same-ID draft first. Existing SQL idempotency still handles races; the original snapshot remains immutable.
- Preserve existing autosave and photo/action idempotency instead of adding parallel mechanisms.

## Verification checklist

- [x] Draft before/after-commit connection loss, honest status, retained input, bounded retry and navigation warning.
- [x] Photo before/after-commit connection loss, selected-file retention, same-ID retry and reload persistence.
- [x] Two authorized sessions: stale revisions retain losing text; finalization blocks stale writes.
- [x] Action interruption, duplicate guard, reload persistence, changed-account denial.
- [x] Real missing session, revoked membership, private photo/PDF and generation denial.
- [x] Finalization and amendment repeated taps/lost responses; authoritative reconciliation; separate PDF failure/recovery and retained hashes.
- [ ] Exact-commit CI, existing staging deployment and served identity; durable delivery receipts.

Receipts live in `.staging/reliability-workflow-checkpoint.json` (`interruptionPhase`). Network fault injection and actual hosted persistence results must remain distinguishable. Existing Daniel physical acceptance is historical user-reported evidence, not acceptance of this phase.

Local result: all 11 focused Chromium checks passed against the real isolated Supabase backend (`.staging/interruption-local-7d7fca.json`). Browser transport loss was injected before requests and after real commits; it is not a measured carrier outage. Missing-session testing removed/restored browser cookies without changing credentials. Two separate authenticated browser contexts demonstrated revision conflicts and finalized-write rejection. Recognizable synthetic cone evidence, captions, action updates and one amendment persisted. Photo/PDF/document hashes were retained. No migration was required.

Required local gates: 55 unit/database tests, lint (existing layout font warning), typecheck, production build and 30 HTTP smoke checks passed. Hosted exact-commit repetition follows deployment. Earlier failed harness receipts are retained: startup hydration exposed a fixed application gap; case-sensitive text and query-bearing navigation assertions were corrected in the harness.

Limits: Chromium mobile emulation is not physical iPhone or WebKit evidence. No offline storage or recovery after tab/browser closure is promised. Native leave warnings depend on browser support and are not a guarantee against OS termination or browser-history navigation. Existing onboarding phone acceptance and all production decision gates remain open.
