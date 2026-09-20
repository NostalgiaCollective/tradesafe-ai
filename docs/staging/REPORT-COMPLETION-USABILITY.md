# Report completion usability — 2026-09-20

Focused engineering milestone, following the completed local WebKit and synthetic recovery milestones. Release verification remains incomplete; domain/email, hosted recovery and policy/operational decisions remain unchanged.

## Three demonstrated problems and changes

1. **Observation entry was an undivided 18-question list.** The initial phone page measured 6,876 px. Observations now use the six categories already present in the report's immutable template snapshot. Each section shows answered counts; an unanswered filter keeps the active answer available for its notes. Counts describe recorded answers, not compliance or completeness. Review links clear the filter, expand the relevant section and focus the missing answer/explanation. No answer is preselected or bulk-filled by the application.
2. **Save feedback was at the top, away from ongoing work and navigation.** A shared action area puts the existing server-confirmed save status and retry beside Back/Continue; it stays visible on phones. Longer saving limitations are available under “Saving and leaving this draft.” The file input stays mounted during in-page navigation. This adds no offline or reload persistence for unsaved work.
3. **“Make a correction” switched to “Create amendment” and left keyboard focus on the page body.** The path now uses “Reason for correction” and “Create correction draft,” explicitly explaining that this is a separate amendment preserving the original report, photos and PDF. Both the link and direct hash navigation focus the reason input.

No database migration, template wording, persistence protocol, authorization, normalization, finalization or PDF-byte changes.

## Evidence and reproduction

- Before: actual hosted Chromium journey at deployed `e4afa293134874ba4d39bdb8b569c13211b21352`; `.staging/usability-before.json`, `test-results/usability-before/`. Phone 390×844 and desktop 1366×900. The corrected job capture uses its saved amendment draft after the original was finalized; the receipt labels this.
- After local: `.staging/usability-local-2.json`, `test-results/usability-local-2/`. Chromium against the actual local app and isolated staging backend, with recognizable synthetic cone photo. This is not disposable-local WebKit or physical-iPhone evidence.
- Browser assertions shared in `tests/fixtures/report-usability.mjs`: keyboard activation/visible focus, no phone overflow, touch targets, counts/filter, collapsed/filtered review errors, answers and explanations retained through navigation and server-confirmed reload, selected photo/caption retained in-page, and nearby save failure/retry. Network interruption is simulated; save/reload persistence is real.
- The local WebKit integration incorporates these assertions into its existing full workflow, retaining photo/PDF bytes, amendment, immutability and cross-company/revoked-member checks. The existing synthetic recovery regression remains required and unchanged.
- Staging Chromium: `node --use-system-ca scripts/staging/report-usability.mjs --hosted` with `EXPECTED_COMMIT` set to the exact passing CI commit. Each separate run needs an unused `USABILITY_RUN` label. It journals created IDs and refuses to overwrite earlier receipts. Credentials stay in existing ignored files. Fixtures are retained.
- Before/after full-page and viewport images cover dashboard, job, observations, photos, review, finalization, PDF-ready view and correction/amendment. Screenshots supplement executed assertions; they are not workflow proof by themselves.

Current exact CI/deployment and hosted results are recorded in `.staging/reliability-workflow-checkpoint.json` and `.staging/report-completion-delivery.md`. Do not deploy until both required CI jobs pass for the exact commit.

## Phone acceptance still pending

Resume a test draft, use an observation section and “Unanswered only,” enter a note, and follow a Review missing-item link. Select a captioned photo, go Back and return, then upload. Wait for Saved and reload. Finish the test report, open its PDF, then use Make a correction; save a change in the separate correction draft and reload. Confirm the original remains unchanged.
