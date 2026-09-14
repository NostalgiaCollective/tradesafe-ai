# Database and stored-byte restore drill plan

Status: **prepared, not executed**. No backup, retention guarantee, restore success, new service or staging reset is claimed. Source is only `tradesafe-staging` (`yqkiizimbtlygovkscoh`); `flhsdtshwwuddzyguyhf` and production are excluded. This task authorizes planning, not a new restore target or destructive restore. Keep all six applied migrations and existing synthetic records intact.

Supabase database backups contain Storage metadata, not the stored object bytes. Free projects need an explicit export strategy; do not assume paid backup or PITR features. See [Supabase database backups](https://supabase.com/docs/guides/platform/backups). The procedure below therefore treats database capture and object capture as one recoverable set.

## Prerequisites and recoverable set

An operator must identify an already-authorized isolated local restore destination, its engine/extension compatibility and a protected backup destination with enough space. Record source/destination identities before any connection. Never point restore commands at source staging. Do not provision a cloud target, add billing or reset staging to make the drill possible. If compatible infrastructure or export access is unavailable, record the exact gap and leave execution pending.

Assign a drill ID and append-only private manifest, containing capture start/end times, source project, application SHA, all six migration filenames/SHA256 values, PostgreSQL/extension versions, export tool versions, schema inventory, table row counts and artifact SHA256/length. Record operator and destination, but no credentials, recovery URLs, session tokens or raw records in the committed report. Secure export authentication must use supported private configuration, never command-line passwords or logged connection strings.

| Capture | Required contents |
| --- | --- |
| Database structure | Application schema, functions, constraints, triggers, grants, RLS policies, indexes, sequences and migration reconciliation evidence; preserve legacy tables as well as every `ts_*` table |
| Business records | Companies/memberships/invitations, profiles, templates, drafts/revisions, finalized snapshots/amendments, corrective actions/history, evidence states/tombstones, export jobs/inputs/leases, recovery grants/limits and legacy relationships |
| Identity | Auth user IDs and identity relationships needed by foreign keys. Inspect supported export coverage explicitly; a default schema dump is not proof Auth data is included. Keep sensitive Auth material protected; do not carry live sessions or active recovery grants into an internet-accessible drill |
| Storage | Bucket definitions/private status and every object in `tradesafe-evidence` and `tradesafe-exports`, including retained, pending, tombstoned and orphan-attempt objects. Preserve paths, MIME type, byte count and SHA256; classify references without deleting anything |
| Configuration | Exact staging origin/redirects, allowlist, provider settings, bucket policies and secret references/versions. Keep secrets separately under controlled access. SMTP/API keys and managed settings are not assumed to be in a database dump |

## Capture without losing cross-system consistency

1. Arrange a documented quiet interval with synthetic writers and other test runners stopped. The web gate alone cannot freeze direct database/API writes. Do not use a broad permissions change as a substitute. Inventory pending uploads and export attempts before capture; preserve their states and IDs.
2. Use a supported read-only logical database export under a consistent snapshot. Inspect explicit schema/Auth/role coverage, dump warnings and completion code; enumerate the complete table inventory rather than assuming the default CLI dump covers managed schemas. Do not run `db push`, `db reset`, or migration application commands. Record the snapshot time and row counts.
3. Enumerate both buckets with complete pagination and download every listed object using authorized private access into the protected drill directory. The server credential intentionally lacks broad application-table SELECT, so use authorized database export access for records instead of granting it privileges. Never make a bucket public or create shareable signed URLs to simplify capture.
4. Match ready evidence and finalized evidence snapshots to exact photo paths/hash/length. Match ready export rows to PDF paths/hash/length and immutable generation inputs. Retain unreferenced attempts separately in the manifest; missing required bytes make the set incomplete, never a passing partial backup. Capture bytes as stored, without re-encoding photos or regenerating PDFs.
5. Re-inventory database revision/job state and bucket path/hash/length after capture. A stable quiet interval plus a consistent DB snapshot and matching before/after inventory is required. If a writer or cleanup ran, or objects changed, retain this failed capture as evidence and repeat only the incomplete capture after quiescence. This is not an atomic cross-system snapshot guarantee.
6. Verify checksums after transfer to the protected destination. Record encryption/access-control arrangements and a recovery-key custodian separately from the archive. A local working copy is not evidence of an independent/off-site backup. Backup cadence, retention, deletion approval, RPO and RTO are product/operator decisions still unset.

## Restore into the isolated destination

1. Refuse source-project or production credentials/URLs at the restore entry point. Keep the destination inaccessible publicly and outbound SMTP/payment/AI disabled. Restore only to the explicitly identified empty destination; no overwrite of an existing dataset.
2. Restore compatible database structure, data and dependencies in the tool's supported order, including necessary Auth identity references, sequences, functions, triggers, grants and RLS. Inspect errors instead of accepting a zero-row partial restore. Reconcile the six migration hashes as history; do not apply them again to staging or blindly replay them over a restored schema.
3. Recreate the two private buckets in the isolated storage target and restore exact object paths/bytes using supported Storage APIs so its own metadata is consistent. Review how managed Storage metadata maps to these uploads; do not blindly insert copied `storage.objects` rows over existing objects. A local byte directory alone proves byte recovery, not a functioning Supabase Storage service.
4. Bind a compatible application build to the isolated destination with destination-only credentials. The Render staging launcher is intentionally pinned to `yqkiizimbtlygovkscoh`: do not relax that guard to run a drill. A separate reviewed local configuration is required. If only plain PostgreSQL is available, label database/byte validation as partial and leave Auth/Storage/application checks blocked.
5. Isolate or invalidate restored sessions and outstanding recovery grants in the destination only before application testing. Keep source throttles, grants, passwords and session state unchanged. No real recovery email is needed for the restore drill.

## Acceptance and failure evidence

- Compare table counts, primary/foreign-key relationships, immutable report/evidence/export snapshot hashes and sequence positions with the manifest. Check representative old and new records, all roles, removed memberships, pending operations and tombstones.
- Compare every restored photo/PDF byte count and SHA256 to the captured manifest, then check all ready-record references resolve. Include historically retained artifact hashes from `RECOVERY-EMAIL-VERIFICATION.md` where those same objects are present. No PDF regeneration substitutes for restoring the retained PDF.
- Through ordinary isolated accounts, prove owner/worker/supervisor access and outsider/anonymous/removed-member denial. Verify private bucket access remains blocked directly, and application-authorized photo/PDF downloads match the original bytes. A service-role download is not an RLS test.
- Open a restored draft and verify persisted content; inspect finalized snapshot immutability and amendment/action history. Exercise retry behavior only on explicitly journaled destination fixtures, preserving original restored records for comparison.
- In the isolated drill copy only, quarantine a copied photo or PDF and prove the verifier/download fails closed; restore that exact byte sequence and prove recovery. Never delete or replace source staging objects for fault injection.
- Record capture duration, restore duration, bytes/counts, source/destination IDs, actual data-loss window, tool exit codes, failures and pass criteria. Measure rather than promise RPO/RTO. Keep failed attempts and artifacts; no cleanup or retention schedule is authorized by this plan.

Completion requires a readable database, exact stored bytes, intact relationships and ordinary application authorization on the compatible isolated destination. Archive-only or SQL-only success remains partial. Keep the drill blocked if any required object or identity dependency cannot be restored; do not edit finalized references to manufacture a pass.
