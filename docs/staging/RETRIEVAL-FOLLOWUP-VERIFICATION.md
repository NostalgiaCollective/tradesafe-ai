# Daily retrieval and follow-up — September 17, 2026

Recovered `eface69e8bc44e813dae8cb40f073bf6e79cf13d`; remote matches, and only unrelated `raw/` is untracked. Hosted identity and historical photo/PDF hashes match. The first read-only identity request timed out while the Free service was waking; the subsequent check passed. No newer work was rolled back.

## Confirmed gaps and bounded checklist

- [x] Reports had lifecycle filtering and latest-draft resume, but no address/title search or explicit return with filters. Add bounded server-side search over the existing job-address/title value, retain lifecycle/pagination in a validated return URL, distinguish amendment/draft/finalized labels and add useful empty/loading/error states. No new report-title field.
- [x] Every action rendered a long edit form. Show a compact linked report, observation, assignee, state and due date, with permitted edits on demand. Keep Assigned to me accessible and retain filter values on reload/return. Collapsing or filtering keeps existing form state mounted.
- [x] Existing action commands already use revision checks and stable request IDs. Preserve those. Fix the confirmed bug where `incomplete` was treated as an uncertain result and locked resolution input; require resolution for awaiting-verification as the database already does. Keep entries through ambiguous failures, suppress duplicate taps and stop repeated stale/denied retries.
- [x] Reduce repeated company-switch controls; show one company as a short label and multiple-company switching behind a details control. Preserve the four-stage report journey.
- [x] Local real-browser verification: synthetic worker/supervisor/owner workflows, reload persistence, interrupted responses, cross-company denial, revoked membership and unauthorized reassignment/closure through real server boundaries. Hosted repeat is part of delivery below. Physical evidence remains separate.
- [ ] Non-force push, exact-commit CI, existing staging deploy, identity and retained-byte checks; save final checkpoint and delivery receipt.

## Scope and existing enforcement

The API and `ts_command` already deny updates by unassigned workers, worker reassignment, worker closure and edits to closed actions; active company membership is required. Supervisors/owners may assign, verify and reopen. Existing workers may set due dates on their own open actions. These rules are not broadened or replaced. No migration is needed or replayed. Finalized observations, photos and PDF bytes remain separate from live action updates.

Search matches the existing job address displayed as the report title. It stays inside the authorized company query and escapes SQL LIKE percent/underscore/backslash patterns. Return URLs reconstruct only known list filters for the same company; arbitrary destinations are discarded. Existing action loading remains bounded to 200 company actions ordered by due date and 500 recent company events; an explicit truncation notice appears when necessary. This is not a measured production-capacity claim.

No email, account reset, paid service, spending change, production/original-project change or destructive cleanup. Preserve all synthetic fixtures, drafts, history, private configuration, `raw/`, storage/photo limits, immutable finalization, amendment separation, disabled checkout and branch-only Vercel suppression. Existing signup, restore, content/privacy and operational decisions remain open.

Current exact receipts and recovery: `.staging/reliability-workflow-checkpoint.json`, `retrievalPhase`. Physical iPhone evidence remains limited to Daniel's previously explicit photo upload and retained thumbnail/full-image results. Search/action acceptance is pending until reported.

## Local verification milestone

52 automated tests, lint (zero errors; existing font warning), typecheck, production build and 30 HTTP smoke checks passed. `node --use-system-ca scripts/staging/retrieval-followup.mjs` uses existing synthetic identities and journals a dedicated crew in `.staging/retrieval-local.json`. No email is dispatched. The worker membership removed by the test belongs only to that new test crew; older memberships and all fixtures remain intact.

Actual UI/server results passed report text/status search, useful empty state, retained return filters, draft resume and stage navigation, recognizable orange-cone upload, finalized/amendment labels, due-date/status/control persistence, required resolution validation and editable recovery after an actual server `incomplete` response. The interruption test lets the server commit a save before aborting its response; a repeated tap submits once and retry retains the same request ID. It is fault injection around a real write, not a mocked success response. Worker reassignment/closure and another assignee's action are denied; direct RPC closure is also denied. Outsider reads/writes, and the revoked worker's existing browser/database sessions, remain denied. Supervisors assign/verify and owners reopen; original report document, photo and PDF hashes stay unchanged.

The initial harness assumed revision zero and then reloaded before a Link navigation completed; both test assumptions were corrected using the same preserved fixtures. Neither was an application defect. Historical harness selectors were adjusted for the collapsed action/company controls and return-query URLs without rerunning unrelated historical suites.

A separate local edge check passed real delayed-search feedback, keyboard traversal, application touch targets of at least 48px, and cancellation of a return navigation while draft saving was interrupted. After retry, the draft saved and its original search filters returned. Touch measurements exclude Next's development overlay. Search/action physical-phone acceptance remains unperformed. The load-error boundary is build-checked; no actual provider outage was induced.

For hosted verification set `EXPECTED_COMMIT` to the exact delivered SHA and append `--hosted`. Journals skip completed checks and preserve fixtures. Do not treat an earlier journal pass as new-deployment evidence. Hosted identity, CI and deploy receipts, remaining limits and the combined phone acceptance are recorded in the durable checkpoint and scoped delivery record.
