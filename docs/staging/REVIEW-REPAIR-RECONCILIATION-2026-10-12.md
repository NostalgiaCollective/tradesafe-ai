# Review repair reconciliation — 2026-10-12

Base inspected: `88f6d5aca3e7ba7e34ba1d25298cff029d3a896f` on the isolated electrical completion worktree. The named `TradeSafe-Review-and-Repairs-2026-10-12.zip` was not available in the searched local files. These are independently demonstrated findings, not an attribution to an unavailable review or evidence that its entire patch was applied.

| Severity | Demonstrated consequence and location | Repair |
|---|---|---|
| High | `lib/domain/authorization.ts` omitted Sites, Briefs, Concerns, My work, Help, Device drafts and content review from session refresh. Their server pages still authorize access, but an expired access token could not reliably persist refreshed cookies through the existing proxy path. | Protect the actual authenticated workspace roots, retaining precise path boundaries. Keep `/join` public so its client can capture the private invitation fragment before sign-in. |
| High | `ts_brief_command` accepted superseded content for new drafts and new recorded versions. PromptPanel also offered retired versions as current suggestions. | Add `20261012000100_retired_brief_content.sql`: guard new selection and recording under the content-row lock shared with review decisions. Existing pinned draft text remains saveable; immutable historical versions and acknowledgements remain unchanged. UI disables retired selection and offers an explicit generic-recording path. No qualified approval is invented. |
| Medium | `/demo` used workspace controls without their `work-app` styling scope; raw fetch had no client timeout or useful unreadable-response feedback. | Reuse the existing style scope; retain entered credentials during errors, announce errors accessibly, and abort a login after 30 seconds. The existing server body, rate, concurrency and provider bounds remain. |
| High | Unused `/api/analyze-photo` still sent photo bytes to a paid AI provider, outside the supported recording workflow. | Authenticate, then return explicit `503 analysis_deferred`; no body parsing, provider call or paid work. Existing evidence uploads are unaffected. |

## Executed checks

`node --test tests/domain.test.ts tests/brief-content.test.mjs tests/phone-demo.test.mjs`: 19 passed, zero failed/skipped. The content regression applies the new migration over existing records in PGlite, exercises retired selection/recording denial, saves recoverable text, records the explicit generic alternative, and compares old versions and acknowledgements. This is database behavior in one embedded session, not a concurrent-transaction proof.

Touched-file ESLint passed. Added real-browser assertions to the existing local WebKit workflows for demo touch target/focus/error retention and authenticated AI deferral. Added seven protected workspace paths to HTTP smoke coverage. Those browser/HTTP additions require execution by the integrated verification run; discovery alone is not a pass.

## Limits

No hosted migration, deployment, live account change, professional content review or physical-phone acceptance was performed by this repair pass. Existing client-only navigation after a content retirement can still encounter the server's authoritative retired-content error; its text is preserved and an explicit generic path is available. The package's claimed historical 106-test result is not used as verification of this checkout.

## Independent new-capability review

Separate from authoring the repairs above, reviewed action completion SQL, API authorization/rechecks, client retry handling and retained-package code. Findings raised with the responsible author:

- Unsubmitted uploads could become permanently inaccessible for cleanup after reassignment/revocation. Database/API authors added a supervisor-only unsubmitted-upload cleanup path while preserving retained-update guards.
- Completion history returned an action row read before its asynchronous history query. API author changed it to detect revision changes and use the final authorized action row.
- New completion session recovery initially linked shared demo users to regular sign-in, which demo protection denies. API author reused the demo session context.
- Package HTML used nonexistent event/photo timestamp and event-detail properties. Root was asked to use `occurred_at`, `uploaded_at`, `before_value` and `after_value` and test actual generated content.
- Pending package snapshots captured before missing PDFs were prepared could make identical retries permanently fail. Root added preflight/new-generation controls; database author was asked to reject preparation before a complete retained-PDF selection exists.
- Electrical certificate/defect photo references in the retained job could be absent when the source report fell outside the date range. Database author was asked to include authorized referenced electrical photo bytes explicitly.

These are review observations and requested repairs, not claims that their final integration tests passed. Root owns final verification and records final resolutions.

`scripts/ci/action-completion-concurrency.mjs` was added for the existing Linux disposable Supabase runner. It verifies actual PostgreSQL lock waits before releasing two competing authenticated RPCs, and holds upload completion while an assignment or membership removal commits. Syntax and ESLint passed. Execution requires that runner; until its receipt exists this is prepared coverage, not a concurrency result.

### Final separate review of package integration

Re-read migration 003, package service, storage streaming helper, UI preparation flow and package tests after the authors' changes. The earlier package findings are now resolved in code:

- A selected report without a ready retained PDF fails before any pending generation is inserted. The UI prepares one PDF per request, then rechecks. Incompatible source changes have an explicit **Start new package generation** path; committed retries retain their original generation.
- Electrical-job referenced photo records are projected even when their parent report is outside the date range, with parent IDs and retained hashes. Missing, unauthorized or mismatched referenced photos fail preparation.
- The readable index now uses actual server upload/event timestamps and before/after transition fields; the regression asserts the rendered values.
- Package preparation starts from an invoker/RLS snapshot, and its narrow definer insertion helper independently compares the authoritative snapshot. Ready generations cannot be rewritten, and retrieval rechecks the creating account's current role and included-record visibility.
- The new private package bucket has restrictive denial for ordinary authenticated/anonymous storage access, including when another permissive policy exists. Only the authorized server retrieval path supplies bytes.
- ZIP generation spools sequentially to a task-owned temporary file, enforces declared file/byte limits, verifies every included attachment, and checks revisions/authorization again before publishing. Retained downloads are spooled and hash-checked before their response is exposed. The upload stream is destroyed on cancellation.

No additional high-severity defect was identified in this separate static review. This is not a security certification. `tests/package-storage.test.mjs` uses mocked chunked streams for response-loss recovery, integrity/size/missing-object failures and pre-aborted reads; those assertions do not establish real mid-stream network cancellation. Real local storage/browser and PostgreSQL concurrency checks remain dependent on their executed CI receipts. A storage write racing a tombstone cleanup can leave an unreferenced object; immutable guards prevent its publication, and deliberate cleanup retry is required. Existing downloads cannot be recalled after access changes.
