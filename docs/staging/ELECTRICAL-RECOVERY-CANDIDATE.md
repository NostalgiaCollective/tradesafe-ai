# Electrical recovery ? staging candidate

Engineering implementation; hosted and physical acceptance remain pending. No hosted migration, deployment or destructive maintenance is authorized in this task.

## Dependency

Branch `astra/electrical-field-recovery`, base `43ad500271cbc62eedb22292d5bd0f04abfed4fe`. Follow-up draft PR targets PR #1's `astra/electrical-completion-evidence` while it remains unmerged. Final SHA/CI execution receipts are recorded in the durable delivery checkpoint. Existing records, other trades, disabled AI/billing and draft content-review status remain unchanged.

## Recovery contract

**Keep unfinished text on this device** extends the existing bounded actor/company/draft store. Electrical text, review/check draft text, completion notes/captions and exact operation identities can survive reload/context reopening when browser storage survives. Limits: seven days, 10 entries, 1 MiB total, 128 KiB each. No photo binaries, credentials, acknowledgements or replayable review/verification commands are persisted. Frozen electrical-save entries include the user's selected statuses as inert retry metadata, not as authoritative decisions.

Online sign-in and current access are checked before displaying stored text. Account/company changes invalidate delayed responses. Existing sign-out, account-switch, opt-out and expiry cleanup apply. Cross-tab tokens prevent replacing newer local copies. Storage denial/quota failures preserve visible input. This is not encrypted storage, guaranteed backup, offline sign-in or offline launch.

**Resume device work** checks authoritative state. Exact committed electrical/action receipts are not replayed. An absent electrical save can be explicitly retried with its original payload/ID against the original baseline; conflicts require comparison. Review/check receipts can be reconciled, but those commands never replay after reload. Action photos reconcile existing server IDs. If a file never reached recoverable storage, its caption remains and the original file must be selected again. Package IDs recover the same generation/range. No automatic submission occurs.

Device-only, pending upload, uncertain outcome and server-saved messages are distinct. Interrupted leases can require up to two minutes to release. Timeout is not proof of rollback.

## API/schema

- GET `/api/sites/:id/electrical?view=current&requestId=<uuid>`: current job plus own `{requestId,revision}` receipt or null, current owner/supervisor access and expected-actor header. No other actor's receipt or document payload.
- GET `/api/actions/:id/completion-updates?updateId=<uuid>`: exact authorized update or null plus current action; existing history pagination unchanged.
- GET `/api/sites/:id/package?generation=<uuid>&status=1`: authorized metadata/state, no storage paths or public URLs. Ready packages recheck retained-scope authorization.
- Upload/reconciliation/package operations acquire service-only leases, propagate cancellation and recheck authorization/revisions. Download cancellation closes streams, temporary files and admission slots.
- Electrical POST retains 30,000-byte actual-body limit and adds a five-second read deadline.
- New migration `20261012000400_storage_maintenance.sql`: leases, immutable sanitized receipts, guarded cleanup and terminal abandoned package state. Transactional constraint expansion removes no records.
- New migration `20261012000500_electrical_receipt.sql`: scoped authenticated receipt lookup; no request-table grants.

No new secrets/services are required. Existing service authority stays server-only; ordinary clients cannot enumerate or delete maintenance objects.

## Maintenance

`node scripts/operations/maintain-local-storage.mjs --dry-run` inventories at most 10 candidates by default (hard maximum 25). `--apply` is deliberately restricted to the existing GitHub Ubuntu disposable Supabase target. Fixed loopback API, Docker container/volume and PostgreSQL system identity are checked before inventory/claims/deletion. Hosted targets are rejected; nothing is scheduled.

Pending/unsubmitted photos and pending packages qualify after seven days without recent activity. Explicitly removed photos require 15 minutes. Abandoned packages remain retryable. Submitted completion references and ready packages are protected. Exclusive 120-second leases (30-second renewals) prevent cleanup during active work. Claims terminally tombstone before deletion, so late uploads cannot publish. Later inventory reclaims late-written bytes. Failed removals leave immutable receipts and remain retryable; touched-candidate ordering avoids starvation.

Default 30-second work budget, maximum 60 seconds, bounded calls and separate five-second receipt budget. Logs contain IDs/kinds/reasons/outcomes only. A failed or incomplete run is never reported successful. Ambiguous deletes reconcile by guarded repeat removal.

## Verification and evidence distinctions

Tests cover fresh/populated upgrades, actual HTTP/storage interruptions, actual concurrent PostgreSQL transactions, local WebKit recovery and existing report/other-trade regressions. Browser response-loss simulation is separate from real midstream transport faults. Final execution results and CI receipts are recorded after running them; test listing is not execution. No hosted or physical result is implied. The first Linux run passed all seven concurrent database cases and six real transport cases, then caught a mobile checkbox overflow regression. The electrical full-width-input rule was narrowed; the existing layout assertion remains required. Simulated authentication loss removes cookies while retaining device storage; it is not a natural-expiry test.

## Deployment order ? requires separate approval

1. Review PR #1 and this dependent candidate; both exact-commit jobs must pass.
2. Verify staging project and migration ledger. Apply only missing parent migrations then 004/005 once.
3. Deploy approved candidate through existing Render staging, preserving Vercel suppression and disabled optional services.
4. Verify served SHA/project and affected workflows with synthetic accounts. Keep destructive maintenance disabled.
5. Roll back application only after checking prior code compatibility with abandoned state. Preserve additive schema/tombstones/receipts/evidence. Reconcile pending IDs; never reset them.

## Fixtures and phone script

`tests/local-browser/electrical-field-recovery.spec.mjs` creates disposable owner/supervisor/worker/outsider identities and an owner-authored electrical report assigned to the worker. Passwords remain ephemeral, not logged/committed. Hosted credentials are untouched. After deployment approval, prepare fresh synthetic staging fixtures through the existing ignored private account-file mechanism; shared demo identity is not individual acknowledgement evidence.

Supervisor: open Electrical job, enable **Keep unfinished text on this device**, type a scope note, background/reload, **Resume device work**. Worker: enter **Completion update notes**, select a photo/caption, interrupt upload, sign back in and resume; reselect only if requested. Reconcile before **Submit completion for verification**. Supervisor: read **Recorded completion updates**, **Verify and close**. Owner: **Download evidence package**, interrupt download, then **Retry evidence package**; confirm same generation/content. Reopening must preserve prior completion/package. Record actual outcomes; WebKit is not phone acceptance.

## Open gates

Hosted migration/deployment/verification need the specific candidate decision above. Physical interruption/background/session-expiry checks and professional safety-content review remain pending. Hosted destructive maintenance is neither authorized nor enabled. Earlier preview cleanup is listed in ELECTRICAL-RECOVERY-PREVIEWS.md; no Vercel management action was taken.
