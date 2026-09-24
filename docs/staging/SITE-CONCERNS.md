# Site concern capture and follow-up

**Report a concern** on an active site opens a short observation/location form with optional immediate steps and user-entered observation time. **Save concern draft** confirms durable server storage; optional captioned photos then use the existing photo controls. **Submit concern** locks the original observation, site snapshot and photos and creates exactly one existing Action. Submission time comes from the server and is shown separately from entered observation time. No notification is sent.

The initial action is assigned to the reporter, matching worker-created briefing follow-up. Existing supervisor/owner assignment, progress, verification, closure, reopening, optimistic revisions and audit history are reused. **Add a correction note** appends an attributed, server-timestamped note without rewriting the original; action progress is also separate. Concerns remain discoverable under their site and **Concerns I reported** in My work after reassignment. Company/site identity and reporting account are resolved by the server, not accepted from form labels.

## Narrow access boundary

Drafts and draft photos are visible only to the active reporter. Submitted concerns, photos and correction notes are readable by the active reporter, current assignee, and active company supervisors/owners. Other workers in the same company are denied, as are unrelated companies and revoked members. Only the reporter edits or submits their draft. Reporters and supervisors/owners can append correction notes; assignees use the existing progress workflow. Assignment confers no supervisor rights or access to other concerns. Existing company-wide report/brief access is unchanged.

Additive migration `20260923000200_site_concerns.sql` adds concern, photo metadata, notes and private retry receipts. It adds nullable concern origins to existing Actions/events and restrictive RLS for those origins. The single action-origin constraint is transactionally replaced with an exclusive three-origin constraint; existing report and brief branches remain intact. Read-only site/personal-action views are extended using CREATE OR REPLACE, preserving their existing columns and grants. No applied migration is edited or replayed. No historical rows are updated or deleted.

## Evidence and recovery

Concern photos reuse the private evidence bucket, normalization/EXIF removal, 5 MiB input, 20-megapixel, 3 MiB normalized-output and 10-photo limits, immutable object writes/hash checks, resource slots and shared global/company/user upload budgets. Separate metadata binds their authorization to the concern rather than a trade report. Submitted evidence cannot be removed or replaced. Draft removal is a tombstone; this milestone performs no destructive cleanup. Recovery archive reference validation includes ready concern photos; the existing required CI recovery regression remains in place without a new hosted drill.

Stable request IDs bind concern mutations to their actor and exact request. Submission, notes and upload retries deduplicate. Pending uploads block submission. Failed or ambiguous operations retain open-page input and expose explicit retry; stale revisions fail without overwriting another save. Browser-close/offline recovery of unsaved input is not promised. Private credentials, tokens, text and image contents are excluded from operational diagnostics.

## Verification and release status

Focused SQL checks cover role/company access, unrelated same-company worker denial, revoked access, exclusive origins, stale saves, request replay, locked originals, photos and separate correction notes. The local WebKit/hosted Chromium fixture executes actual capture, photo/caption upload/reload, dropped responses after real creation/upload/submission commits, assignment, worker progress, verification/reopening and retained-byte checks. Existing report/photo/PDF/amendment, briefing/acknowledgement, site and crew workflows remain required CI gates.

Exact executed results and staging migration/deployment receipts are in `.staging/reliability-workflow-checkpoint.json` and `.staging/site-concerns-delivery.md`; test discovery is not execution. Phone acceptance remains pending and separate from earlier acceptance. This is observation capture, not emergency response, statutory incident reporting, professional content approval or permission to resume work. All existing production, privacy/content/operational and deferred domain/email gates remain open.

## Connected workday verification

The workday fixture extends the existing concern browser harness across one site and separate supervisor/worker accounts: recorded brief, exact-version acknowledgement, captioned concern, assignment/reassignment, progress, verification, site counts, revised briefing and historical export/evidence checks. It also exercises interrupted saves, committed-response retries, a stale action editor and revoked access. Individual feature and security evidence remains valid; this adds coverage at their transitions.

Baseline hosted inspection found that brief-to-Actions navigation dropped the site filter, Today used “Original record” for a concern and dropped site context, and returning to a previously visited site could show an old action count. Brief links now use the existing authorized site association; Today uses the existing action-ownership projection; return links reload the live workspace while the existing site-position mechanism restores location. No data model, roles or underlying workflow rules change. No new dashboard or schema migration is needed.

Run the same hosted harness with `--workday`. Exact CI/deployment and hosted results are recorded in `.staging/workday-integration-delivery.md` and the durable checkpoint. Local WebKit, hosted Chromium, injected faults and physical acceptance are distinct. Prepared workday phone accounts live only in ignored `.staging/workday-phone-private.json`; previous site, crew and concern phone acceptance stays pending until Daniel explicitly confirms it.
