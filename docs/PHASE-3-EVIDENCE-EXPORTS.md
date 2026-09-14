# Phase 3: private retained photos and authorized PDF exports

Implemented on astra/production-mvp, based on completed Phase2 checkpoint0ad8b60. Functional UI only; visual redesign and AI photo analysis are outside this change. Checkout remains disabled.

Final application commit `d9fdb858dac29e6f8b7f4bc5c4753af3f68d40db` passed real staging verification. See [actual test results and migration evidence](PHASE-3-VERIFICATION.md) and [recovery checkpoint](staging/PHASE-3-CHECKPOINT.md).

## Data and permission model

`ts_evidence` belongs to one company/report and records an immutable UUID path, normalized-byte SHA256/size/dimensions, caption, original uploader ID/display label, server reservation/upload/removal times, and pending/ready/removed state. User filenames, client capture timestamps, geolocation and EXIF are not trusted. Captions are explicitly user supplied. Retained images are normalized visual evidence, not the byte-identical original camera file.

JPEG, PNG and single-frame WebP input only:3MiB maximum input/output,20 megapixels decoded input,2400px maximum output dimension,10 active ready/pending photos per report,1000-character required caption. The server decodes actual pixels with sharp, rejects malformed/truncated/animated input, applies orientation, strips metadata, flattens transparency and writes JPEG at quality85. The request stream is bounded before decoding; extension/MIME assertions do not establish validity. SVG, GIF, HEIC and documents are rejected. Storage independently limits photo objects to3MiB and image/jpeg.

| Operation | Authorized users |
| --- | --- |
| Read report/photo metadata, view/download retained photo, generate/download finalized PDF | Current active company members |
| Reserve/upload/remove/reconcile draft evidence | Report author, or company owner/supervisor; workers cannot edit another author's report |
| Retry the same upload reservation | Original uploader with current draft edit authority, same normalized bytes/caption/metadata |
| Complete byte validation or manage PDF jobs | Server-only service-role functions; never callable by ordinary/anonymous users |
| Direct Storage download/upload/upsert/delete/sign URL | Denied to ordinary/anonymous clients, including members |
| Direct metadata INSERT/UPDATE/DELETE | Denied to ordinary/anonymous clients |

Metadata tables have RLS and authenticated SELECT only. Mutating RPCs lock company then report, matching Phase2's order, and check current membership after taking locks. Finalization takes the same locks and rejects any pending upload. The finalization trigger captures ready evidence and author/finalizer labels into `ts_reports.evidence_snapshot` and `identity_snapshot`. Old finalized rows remain unchanged with null new columns; exports explain the absent retained-photo snapshot rather than inventing evidence. Amendments start without attachments, retaining the original report link and copied observations; new amendment photos are separate.

Metadata, evidence snapshots and ready export rows are immutable under database triggers. A completed photo cannot be replaced: object names are UUID-derived and uploads never upsert. Finalized reports cannot acquire new attachments or remove existing ones, including when upload/completion races finalization. Removing a draft photo creates a permanent tombstone before object deletion; it cannot be resurrected by a late completion.

## Access and revocation

Both `tradesafe-evidence` and `tradesafe-exports` buckets are private. A restrictive storage.objects policy excludes anon/authenticated from these buckets even if an unrelated permissive policy is later introduced. Storage writes and reads happen through a server-only service client **after ordinary Auth/RLS membership authorization**. Completion/export functions also check the actor's current membership. This trusted credential bypasses RLS, as documented by [Supabase](https://supabase.com/docs/guides/storage/security/access-control), and must never reach client code, logs or public configuration.

Photo and PDF routes use cookie Auth, recheck membership immediately before returning bytes, use `private,no-store` and `nosniff`, and generate safe download filenames. No signed URLs are issued, eliminating an outstanding-link expiry window. Removal blocks subsequent requests using an already-issued session/JWT. Bytes already viewed/downloaded or an in-flight response past its final authorization check cannot be recalled. Protected images deliberately use native authenticated image requests, bypassing shared Next image-optimizer caching.

## Interrupted operations

1. Upload body is received and validated before an ordinary reservation is committed. An interrupted request before reservation has no saved photo. An interrupted request afterward leaves pending metadata visible after reload.
2. Server uploads without overwrite. A lost upload response is reconciled by reading the exact object and comparing SHA256 and byte count. A retry uses the same evidence UUID and metadata; differing content fails with409.
3. Trusted completion locks/rechecks report and member state. If completion is interrupted, draft reconciliation verifies the existing stored object and completes it; absent/mismatched bytes remain pending and never count as saved. The uploader may reselect the original file or an editor may remove the pending row.
4. Draft removal tombstones first. Cleanup deletes only that tombstone's exact object. A late upload can leave an unreferenced tombstone object; repeated cleanup is safe. `npm run staging:reconcile-evidence` inventories these exact candidates; `-- --apply` removes only verified tombstoned, unreferenced objects, including on now-finalized reports. It rechecks metadata and snapshot references before every removal. It never sweeps unknown prefixes, ready/pending objects, or unrelated synthetic data.
5. PDF jobs use a durable two-minute lease and attempt UUID. A failed/interrupted job can be explicitly retried; a stale attempt cannot complete a newer lease. Each attempt has a distinct non-overwriting object path. Unreferenced PDF attempts are conservatively retained for operator review, never swept by photo cleanup. Operational storage monitoring and an approved retention policy are required before production.

## PDF contract

PDFKit runs in a Node route with no browser executable, external rendering service or paid API. Native sharp is required for uploads. Noto Sans is bundled with its SIL Open Font License and traced into export deployment artifacts. Font SHA256: b85c38ecea8a7cfb39c24e395a4007474fa5a4fc864f6ee33309eb4948d232d5. Unsupported glyphs are visibly represented as Unicode codepoints. Runtime dependency and font changes require export-version review. PDFs are functional exports; they are not claimed to be PDF/UA certified.

One version1 export is retained per finalized report. The first job captures the authoritative report snapshot and related amendment index under the company lock, with a server `cutoff_at`. Retries preserve that input/cutoff; completed export bytes/hash/path cannot change. A new export format requires a new export version and reviewed additive migration, not replacement of an existing artifact.

The PDF includes report/export identity, immutable business/author/finalizer data, server timestamps, entered work date, template/snapshot versions, explicit answers (including unanswered fallback, not applicable and unable to verify), explanations/controls, photos/captions/upload attribution, original amendment relationship and amendments known at the export cutoff. Later corrective-action status/history is deliberately excluded and clearly labelled. It remains in the separately authorized Actions view; it never changes the original findings. Browser text printing is separately labelled and excludes photos.

All expected photos are downloaded and verified before generation. Any missing/mismatched photo prevents generation; a failed job records `evidence_missing` or `generation_failed`. Cached export downloads recheck retained photo integrity and PDF checksum too. There is no partial-success PDF. Missing evidence requires retry or a safe operator restoration of the exact bytes; never delete references or remove photos from a finalized record to obtain a passing export. PDFs are limited to32MiB and generation to a60-second Node route budget; a crash uses lease-based retry.

## API contract for the design chat

All paths use UUID `reportId` under `/api/reports/{reportId}`. Mutations require the configured same Origin and the existing Supabase Auth cookies; no bearer tokens are added to URLs. JSON errors have `{code,error}` and no-store headers. Do not log request bodies, invitation URLs, cookies or credentials.

| Method/path | Request / response |
| --- | --- |
| GET `/evidence` | Array of evidence metadata including pending/ready/removed; filter tombstones in ordinary review UI |
| POST `/evidence` | Raw image body; `X-Evidence-Id` stable UUID and URI-encoded `X-Evidence-Caption`;200 `{id,state:"ready"}` only after completion |
| GET `/evidence/{evidenceId}` | Authorized image/jpeg bytes; UUID filename; no public/signed URL |
| DELETE `/evidence/{evidenceId}` |200 `{id,state:"removed",cleanupPending}`; draft edit permissions required |
| POST `/evidence/reconcile` |200 `{results:[{id,state,error?}]}`; incomplete rows remain explicit; never treat an error row as saved |
| GET `/exports` | Null or current version1 job status, cutoff/completion/lease times and safe failure code |
| POST `/exports` | Generate/retry immutable version1 input;200 `{id,state:"ready",download}`; existing ready job returns the same ID |
| GET `/exports/{exportId}` | Authorized attachment application/pdf after photo/PDF integrity checks |

Meaningful errors:401 unauthorized;403 denied;404 inaccessible/missing record;409 immutable/conflict/evidence_pending/evidence_limit/export_busy;422 image_invalid/incomplete;503 evidence_missing/configuration/unavailable. Invalid caption encoding is400. Distinguish upload progress, pending, saved, removed/cleanup-pending and retryable errors. Preserve the current file and request UUID after ambiguous response loss; files are held in memory only. Query pending metadata after reopening and offer reconciliation or original-file selection. Do not infer saved from a local preview. Keep captions labelled, file inputs accessible, statuses announced and download failures visible. Do not clear unrelated unsaved report edits when refreshing the evidence list.

## Setup and operations

The original project flhsdtshwwuddzyguyhf remains blocked. Only verified tradesafe-staging yqkiizimbtlygovkscoh was modified. The3 Phase2 migration hashes/history were reconciled; no old migration was replayed. Phase3 migration `20260913000100_private_evidence_exports.sql`, SHA2566153aaf9f97e1ee1e4424bc6821e37e2bb61265274c72122676f5ea149621dcb, applied once through SQL Editor on2026-09-14. CLI history is still absent; never blindly db push. Postcheck verified RLS, grants, private buckets and restrictive Storage policy.

Existing `.env` and `.env.staging.local` were preserved. New ignored `.staging/server.env` supplies only `SUPABASE_SERVICE_ROLE_KEY` to the staging app launcher; its JWT role/project is checked before starting. Ordinary test configuration never inherits this file. Production setup needs an independently managed server secret for the intended project, a Node-compatible sharp build, bundled font tracing and verified provider limits. Do not deploy a staging artifact to production. Missing Storage configuration fails closed while core Phase2 features remain usable.

Safe-cleanup inventory exposed an actual42501 permission gap: service_role intentionally lacks direct report-table SELECT. Forward repair `20260914000100_evidence_cleanup_guard.sql`, SHA2567e51eef2d40a27dabdb5d244cf2a0b7cc87396a23fd43b2d2911a1e571c0a22f, applied once on2026-09-14. Its service-only function checks tombstones against snapshots and returns only the exact object path/IDs; broad report reads were not granted. Local tests deny ordinary execution and reject retained-photo candidates. Real repaired inventory passed without deleting anything. The original applied Phase3 migration remains unchanged.

Run browser suites serially because shared synthetic-account logout has global scope. `test:staging:phase3` keeps IDs and per-case checkpoints in ignored `.staging/phase3-verification.json` plus timestamped staging-runs JSON. Use `--resume` only after checking processes/remote state; `--new-run` requires a completed prior PASS. Synthetic data and failed-run evidence remain retained. Administrative access in that harness is restricted to explicit missing-object/interrupted-completion fault setup; all authorization assertions use ordinary sessions.

## Remaining production gates and next bounded task

Qualified checklist/content review; supported account/password recovery and delivery; privacy, retention/deletion consent/support policy; abuse/rate/storage/CPU controls and monitoring; provider backup/restore drill; secret rotation and production deployment verification; billing reconciliation (checkout remains off). AI expansion remains deferred. Passing staging tests is not production approval.

Next bounded task: implement and verify the supported account-recovery flow in isolated staging, including safe redirects and real controlled email delivery. Retention policy and cleanup scheduling need a product decision before customer evidence is accepted.
