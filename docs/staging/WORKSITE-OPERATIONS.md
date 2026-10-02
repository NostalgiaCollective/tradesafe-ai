# Worksite operations and evidence

Three increments extend existing Sites, Actions, My work and Daily handover. No new dashboard or external service. Render and Supabase remain the staging stack.

## Planning

Supervisors/owners can change or clear due dates and choose Low, Normal or High operational priority; Not set explicitly clears it. New actions start with no priority selected. The original saved values and audit history remain intact. Workers retain progress/request-verification rights but cannot alter scheduling. Actor, server timestamp and before/after values stay in action history. Persistent request receipts reject changed payloads and deduplicate retries even after later updates. Revision checks and existing verification/reopening rules remain enforced in SQL.

The company/site planning convention is America/Toronto. Due today means that calendar date; overdue means an earlier saved due date on an action that is not closed. Reopening preserves the current deadline. Unscheduled means no date. These are human-entered planning values, not safety ratings or legal deadlines. Site and handover counts use authorized rows, independently of the selected historical activity day.

## Site history

Caller-RLS search combines recorded brief versions, submitted concerns, finalized reports/separate amendments and existing action events. It does not invent missing historical events. Date range is inclusive in America/Toronto, maximum 366 days. Text is a literal case-insensitive substring; 120 characters maximum. Pages contain at most 30 records with timestamp/key ordering and a fixed server cutoff. New activity after that cutoff requires a fresh search. Current action state is explicitly labelled and may change between pages; historical event payloads remain separate. Navigation preferences and return position are stored per actor/site; record content is not stored offline.

## Evidence download

Private, authenticated POST; no durable/public package URL or outbound delivery. A ZIP contains a readable index, structured records, retained report/amendment PDFs copied unchanged, exact-version daily brief HTML, submitted concern photos/captions, separate concern notes and action history/current status. The manifest records IDs, revisions and SHA-256 file hashes; the response supplies the whole-ZIP hash. Internal storage paths, request identifiers and signed URLs are excluded.

Date inclusion: brief recording, concern submission, report/amendment finalization and action-event server timestamps, not entered work/observation dates. Associated current actions and subsequent concern notes are labelled current/subsequent. Parents outside the range are referenced, not presented as in-range activity. Acknowledgements and reviews are exact-version records through the cutoff.

Limits: 31 inclusive days; 200 selected activity rows; 100 associated actions; 1,000 acknowledgements and reviews each; 200 concern notes; 100 files including index/manifest; 64 MiB archive; 16 MiB per file; 4 MiB database payload. One concurrent PDF/package process slot; bounded shared admission windows; 90-second preparation budget. Files spool sequentially to task-owned private temporary disk, with at most one bounded attachment in memory, and cleanup on completion/cancellation/failure. Missing PDFs, missing/corrupt bytes, over-limit records and changed authorization/records fail the whole package. Missing PDFs must first be generated through the existing original report flow; the package never regenerates retained exports.

Database selection uses one caller-authorized MVCC statement snapshot. Storage retrieval happens afterward. Hashes must match; a second authorized database snapshot at the same activity cutoff must match before download. This does **not** claim an atomic database-and-storage snapshot. An already received download cannot be recalled after later revocation. Interrupted downloads require retry in the app. Immutable historical exports are never modified.

## Evidence and remaining gates

Additive migrations: `20261002000100_action_planning.sql`, `20261002000200_site_history.sql`, `20261002000300_site_evidence_package.sql`, `20261002000400_action_priority_clear.sql`. Apply only once to verified isolated staging after exact-commit CI. No applied migration is edited or replayed.

Local SQL covers scheduling authorization, concurrency/deduplication, date boundaries, keyset pagination over representative synthetic events and resource/access denial. Local WebKit exercises the connected browser workflow and a missing task-owned local storage object. Hosted Chromium uses new synthetic records and never removes hosted evidence. Injected response loss is labelled simulated; persistence, downloads and hashes are actual integrations. Exact receipts and screenshots belong in `.staging/worksite-operations-delivery.md` and `test-results/worksite-operations/`.

Daniel's October 2 report of a failed iPhone attempt returning to sign-in without error is preserved separately. Its browser context and timing relative to his earlier accepted retry are unknown; no individual phone success is inferred. Physical operations acceptance remains pending. Domain/email, qualified content approval and other release gates remain deferred/open. This is not production readiness or compliance approval.
