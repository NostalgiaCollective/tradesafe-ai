# TradeSafe limited-pilot operations

This runbook applies to the isolated staging service only. It is an operational aid for a limited pilot; it is not a production-readiness approval.

## Identify the service

Before investigating, record the served identity from the protected staging identity endpoint: full commit SHA, `astra/production-mvp`, canonical staging origin, isolated Supabase project `yqkiizimbtlygovkscoh`, and the public-key digest. The public health endpoint only proves that the HTTP process answers; it intentionally returns no configuration, dependency or data details. A failed identity check is a deployment/configuration problem, not proof that the application is unavailable.

Application failures are recorded as stable `request_failed` events with an event name and safe error code only. Upload and PDF admission events record `resource_work`, kind, complete/failed outcome, duration and (for failures) the same stable failure code. Logs must never contain passwords, session or invitation tokens, report text, customer names, photo bytes, provider error objects or request bodies. `unavailable` is used when the failure cannot be classified safely.

For a report that appears stuck, first retrieve authoritative report/evidence/export state using the ordinary authorized account. A `Saved` state requires server confirmation. A pending photo keeps its evidence ID and asks the user to select the same original file before retrying. A generating PDF can be retried after its bounded lease; retained PDF bytes are reused when available. A lost response is reconciled before another operation is started.

## Incident triage

1. Check the staging health endpoint, then the protected identity endpoint and deployment log. If health fails, treat the service as unavailable. If health succeeds but identity fails, stop workflow testing and inspect the deployment/runtime identity without exposing environment values.
2. If health and identity pass, reproduce with a synthetic report and inspect only sanitized `request_failed` and `resource_work` event codes. `resource_busy` and `resource_limited` are capacity controls; wait for the advertised retry interval. `evidence_missing`, `generation_failed` or `query_failed` require preserving the record and opening an operator investigation.
3. Check the report's authoritative state before retrying. Do not double tap, create a second report, select a different photo after an ambiguous upload, or regenerate a finalized PDF merely because a response was lost.
4. Preserve the receipt, timestamp, served SHA and synthetic record IDs. Do not copy cookies, links, credentials, raw requests or image contents into the incident record.

## Rollback

Rollback is a staging operator action through the existing Render service only. Confirm the candidate commit, required exact-commit CI result and current deployment ID before choosing the prior known-good deployment. Do not force-push, alter Supabase migrations, reset the database, change production, or restore data as a rollback substitute. After rollback, verify the served identity, health, isolated project, disabled checkout and retained historical photo/PDF hashes, then rerun only the affected hosted workflow. Keep the failed deployment and receipt for review.

## Recovery status

The recovery-set validator is executable offline and fails closed on missing, corrupt, unsafe or incomplete artifacts. It does not claim a restore. A real drill remains blocked until an already-authorized empty Supabase-compatible isolated target, supported database export/restore tooling and a protected independent archive destination are available. Never use active staging or production as the target. See [BACKUP-RESTORE-DRILL.md](BACKUP-RESTORE-DRILL.md).

## Release decision

The current limited-pilot recommendation is conditional staging/pilot continuation only. Core hosted workflows, authorization boundaries, immutable reports, private evidence/PDF access, retry behavior and historical hashes have evidence. WebKit/physical coverage, delivered-email signup, isolated restore, qualified content review, privacy/retention decisions, named operational ownership, capacity/device acceptance and billing reconciliation remain open decisions for Daniel or a qualified reviewer.
