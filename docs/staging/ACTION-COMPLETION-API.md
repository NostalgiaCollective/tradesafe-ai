# Corrective-action completion evidence API

Local implementation; requires migration `20261012000200_action_completion_evidence.sql`. No hosted migration or deployment is authorized for this increment.

All routes use current authenticated application sessions and private/no-store responses. Mutations require the configured same-origin `Origin`; the UI supplies `X-Expected-Actor` to reject account changes. Company, site and actor come from the authorized action, not submitted identifiers. An active owner/supervisor or currently assigned worker may read completion records. New updates require an open action. Assignment does not grant access to the original report/concern.

## Read updates

`GET /api/actions/:id/completion-updates?page=0`

Returns `{ action, updates, page, hasMore }`, 20 updates per page, ordered by server `recorded_at` and ID descending. Each immutable update includes `id`, `company_id`, `action_id`, `site_id`, `basis_revision`, `submitted_revision`, `actor_id`, recorded `actor_label`, `recorded_at`, `notes`, `state`, `evidence_snapshot`. A revision change during the history read produces `conflict` instead of contradictory current state. Counts are never fabricated after a failed query.

## Upload a photo

`POST /api/actions/:id/evidence`, raw JPEG/PNG/WebP body.

Required headers: `X-Evidence-Id` (stable photo UUID), `X-Update-Id` (stable future completion UUID), `X-Action-Revision` (editing baseline), `X-Evidence-Caption` (URI-encoded, nonblank, max 1,000 characters). Keep these values unchanged when retrying a lost response.

The server admits bounded processing, decodes actual image content, rotates/normalizes and strips metadata, reserves through `ts_action_photo`, writes an immutable private object with hash verification, then completes with `ts_complete_action_photo`. Completion rechecks current membership, assignment and action revision. The API rechecks authenticated access after asynchronous work. Response: `{ id, state: 'ready', caption }`. Ready uploads are not retained completion evidence until submission.

Limits remain 5 MiB input, 20 megapixels, JPEG/PNG/WebP still images, normalized JPEG at most 3 MiB and 2,400 pixels per side. Maximum 10 photos per update and 100 nonremoved photos per action. No user-reported capture timestamp is inferred from the file. `reserved_at` and `uploaded_at` are server times.

`GET /api/actions/:id/evidence?update=:updateId` lists that bounded batch under RLS. `POST /api/actions/:id/evidence/reconcile` with `X-Update-Id` verifies existing object bytes and completes eligible pending reservations. Incomplete objects remain pending; the caller must retry the original selected file or remove the unsubmitted photo. Browser reload cannot recreate an unsaved selected file.

`DELETE /api/actions/:id/evidence/:photoId` with `X-Update-Id` tombstones the caller's unsubmitted photo (or an owner/supervisor's explicitly selected unsubmitted company-action photo) through SQL, then obtains a service-only cleanup candidate and removes that exact object. Ready evidence referenced by an immutable update cannot be removed. An interrupted cleanup may be retried; it never sweeps arbitrary objects. GET with `?pending=1` returns up to 100 authorized unsubmitted photos through `ts_action_pending_photos`; the expandable UI requires confirmation before removing an abandoned upload. No automatic cleanup job is enabled. A storage write finishing after cleanup can leave an unreferenced private object; retrying removal of the same tombstone is safe. This is a storage cleanup limitation, not retained evidence or permission to publish the object.

## Submit the update

`POST /api/actions/:id/completion-updates`, JSON:

```json
{"id":"stable-update-uuid","revision":2,"notes":"Recorded work and unresolved questions","state":"awaiting_verification","evidenceIds":["ready-photo-uuid"]}
```

Notes are required, maximum 4,000 characters; `state` is `in_progress` or `awaiting_verification`. Photo IDs must match all ready photos in this batch, with no pending uploads. Request body is bounded to 20,000 actual bytes and five seconds. For a new submission, the server verifies the actual bytes/hash of each selected ready photo before calling SQL; access and revision guards run again in SQL after these asynchronous reads. A committed retry returns its existing receipt even during a later storage outage. `ts_action_completion` atomically applies the existing progress transition and retains the immutable update/evidence snapshot. Returns `{ update, action }`. An exact committed request retry returns the same update plus current authorized action; changing the payload for that ID conflicts. New work never overwrites newer revisions.

Submission is not supervisor verification, closure, an acknowledgement, a safety decision or a notification. Supervisor review and closure continue through existing `POST /api/workspace` `update_action` checks; that transition records actor/time/history independently.

## Retrieve photos

`GET /api/actions/:id/evidence/:photoId` returns verified JPEG bytes through the application, without signed/public storage URLs. Both before and after reading the private object, the server rechecks current action access and the authorized ready row. Pending/removed photos cannot be downloaded as completion evidence.

## Failures and recovery

Existing error codes remain enforced: `unauthorized` (401), `denied` (403), `not_found` (404), `conflict` or `immutable` (409), `invalid_request` (400), `evidence_pending`/`evidence_limit` (409), `image_invalid` (422), `resource_limited` (429), `resource_busy`/`evidence_missing`/`unavailable` (503), `request_timeout` (408). The UI keeps current notes and selected file during recoverable failures, freezes an ambiguous submission's payload, and explicitly retries that request. A stale baseline offers comparison with the latest record in another tab; no automatic merge or overwrite occurs. No offline or browser-close persistence is promised for completion notes/photos.
