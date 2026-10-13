# Combined electrical release review - 2026-10-13

Status: reviewed staging candidate preparation; no integration, hosted migration or deployment authorized/performed. Final candidate/CI and management preflight receipts are recorded in the durable checkpoint and `.staging/electrical-release-review-delivery.md`.

## Starting point and scope

PR1 is open at `43ad500271cbc62eedb22292d5bd0f04abfed4fe` targeting `astra/production-mvp`. PR2 started this review at `a4a56993f232fa41b1b451200211261423659ac8` and targets PR1's branch; it already contains the parent work. Repairs remain on PR2's existing suppressed branch. Original development checkout is `88f6d5aca3e7ba7e34ba1d25298cff029d3a896f`; research/raw files are untouched. Independent client, server and database review passes were separated from authoring.

Daniel reported that the application is confusing. This is a user statement, not a participant task score or a qualified content decision. Broad navigation alternatives remain research hypotheses.

## Concrete findings and resolutions

| Severity | Finding and observable consequence | Repair / evidence |
|---|---|---|
| Medium | `app/actions/ActionCompletion.jsx` restored unsent work and refreshed a stale action using the mutation-success callback. `ActionList.jsx` consequently displayed "Action update saved" without a new server update. | Separate refresh from confirmed save callbacks; current counts/revision refresh without success claim. Existing WebKit recovery test requires zero completion rows and no false Saved on unsent restore, then positive saved feedback only after authoritative receipt. |
| Medium | Caption-only input was omitted from the completion dirty state, allowing other action edits and navigation without an unsaved warning. | Include caption in dirty state; existing browser test proves the action lock and release after clearing it. |
| Medium | Native completion-history and unsubmitted-upload disclosures can open before client handlers attach. An already-open panel was not reconciled on mount and could remain blank despite retained evidence. | Reconcile open panels after hydration, with in-flight request guards. Browser coverage holds real script requests, opens the native panels, then releases scripts and checks authorized evidence. Final execution is recorded in the delivery checkpoint. |
| Medium | After a complete package download, `app/sites/SitePackage.jsx` continued to show Preparing while it refreshed the receipt list. Successful generation and secondary list loading appeared contradictory. | Distinguish retained-list refresh from package preparation; a delayed/failed list refresh must preserve the confirmed download and same generation. Controlled response-barrier browser regression. |
| High - recovery readiness | `scripts/operations/local-rehearsal.mjs` selected only `ts_private_objects` for storage-policy inventory/restore (the physical dump already contained all policies), omitting `ts_private_packages`. Current source protection was intact, but restored-policy equivalence was overstated; a permissive policy could expose restored package objects. | Inventory/restore all storage.objects policies, compare exact catalog and run an identity-checked, rollback-only permissive-policy probe as authenticated/anon on the disposable restored target. Focused database regression demonstrates exposure without package guard and denial with it. Actual restore execution remains a required CI gate. |
| Release constraint | Unmodified `88f6d5a` and parent `43ad500` are not full rollback candidates once new records exist. Old package assembly omits new completion/electrical evidence; parent UI cannot reconcile terminal abandoned generations. | Do not approve an untested old-SHA rollback. Preserve schema/bytes, stop field activity, repair forward from the verified combined candidate and rerun gates. No database downgrade or tombstone reversal. |

No additional blocking bypass was identified in the reviewed company/assignment boundaries, separate supervisor authority, immutable retries, async completion authorization or retained-reference maintenance guards. This is scoped review evidence, not a claim that all defects are absent.

## Phone journey and evidence

Existing separate-role synthetic workflows exercise: site concern capture -> original concern/follow-up -> permitted assignment -> worker completion notes/photo -> supervisor review/closure -> owner retained handover. Actual local WebKit captures are retained as a seven-day CI artifact under `electrical-phone-review`; only fictional fixture screens, no login pages or credentials. Inspect the captured screens after the final run. Automated phone-width operation is not observed participant usability or physical iPhone acceptance.

Check each screen for site/source identity, next permitted control, device vs server state, unsubmitted photo status, review authority and return link. Current modules are reused; no dashboard or workflow clone is introduced. More prominent job identity, shorter terminology and fewer competing controls remain participant-research hypotheses unless a specific demonstrated defect is recorded.

## Verification interpretation

Run 38404907567 was already complete on resume and was reused. Its quality job and connected concern-to-handover browser case passed, while a later crew-selection case failed. Subsequent failures exposed a reloaded completion-history problem and then a held-script test-harness problem. Neither a passing quality job nor script discovery establishes a passing browser workflow. The final exact-commit results, executed/skipped counts and sanitized failure receipts belong in the delivery record; do not combine partial runs into a full pass.

The held-script helper was also repaired after a real loopback HTTP/Chromium reproduction: Playwright 1.63 automatically continues active requests when removing its last page interceptor, so removing it before draining our continuations caused double handling. The helper drains before removal and preserves errors; this is test infrastructure evidence, not an application pass.

The original recovery run at a4a5699 did execute a distinct-target restore, but its storage-policy filter omitted the private-package guard. Its prior catalog-equivalence claim is qualified by this review. The repaired full-policy restore and rollback-only denial probe must execute before this gap is considered closed.

## Read-only release preflight

Live served identity was checked on 2026-10-13: commit `88f6d5aca3e7ba7e34ba1d25298cff029d3a896f`, branch `astra/production-mvp`, project `yqkiizimbtlygovkscoh`, expected existing Render origin. No new candidate is deployed.

Target: Render service `srv-dak9925g1s2s73bg1a4g`, https://tradesafe-staging-yqkiizimbtlygovkscoh.onrender.com; isolated Supabase `yqkiizimbtlygovkscoh`. Management sessions were signed out at preflight. Live migration ledger and current Render branch/auto-deploy/configuration must be read before a final release approval request. Do not infer them solely from historical receipts. Prepared read-only SQL is `.staging/electrical-release-preflight.sql`; if the migration ledger is absent, reconcile function/table definitions and historical per-migration receipts explicitly rather than replaying.

Candidate migration inventory, in dependency order (apply only those confirmed missing):

1. `20261012000100_retired_brief_content.sql`
2. `20261012000200_action_completion_evidence.sql`
3. `20261012000300_retained_site_packages.sql`
4. `20261012000400_storage_maintenance.sql`
5. `20261012000500_electrical_receipt.sql`

This review adds no schema migration. No new secret, service or paid resource is required. Preserve gate/demo scope, existing Auth/storage settings, disabled checkout/AI and branch-only Vercel suppression. Destructive hosted maintenance stays disabled and unscheduled.

## Proposed integration/deployment decision - not yet executed

After management preflight and review, authorize one staged release of the combined PRs: merge PR1 preserving history into `astra/production-mvp`, retarget PR2 to that branch and merge preserving history (do not cherry-pick or squash duplicate parent changes). Verify the integrated tree equals the reviewed combined candidate except explicit integration metadata; both required jobs must pass on the exact resulting deployment SHA before deployment. Confirm Render auto-deploy settings before integrating so a merge cannot deploy ahead of those checks.

Recheck target identity/ledger immediately before applying only missing approved migrations in order. Deploy the exact passing integrated SHA to the existing Render service. Verify served SHA/project and normal gate/demo boundaries, then run the focused synthetic plan below. No Vercel deployment or hosted cleanup.

If migration application fails, stop and inspect transactional completion/ledger; never replay blindly. If application verification fails, stop the rehearsal, retain all data/receipts and repair forward from the compatible combined code. Do not substitute old handover generation after new evidence exists. Any temporary Render suspension/configuration change needs explicit release authorization. Previously downloaded artifacts cannot be recalled.

## Focused hosted acceptance after separate approval

Use distinct synthetic reporter/worker/supervisor/owner accounts with credentials only in the existing ignored private-file mechanism. Never use shared demo identity as individual acknowledgement evidence. Reuse suitable fixtures; do not reset records.

1. Capture a named synthetic concern with captioned photo and retain source hashes. Assign follow-up to another worker.
2. Worker enables device text, enters completion notes/caption and reloads before submission. Current access must be checked; no Saved-to-server message or completion row may be invented.
3. Inject one bounded lost response after a real successful operation; resume the same ID after reload/sign-in. Confirm exactly one retained completion and required file reselection where bytes never reached storage.
4. Supervisor reads original and completion evidence, verifies/closes through existing controls. Deny worker closure, revoked membership and cross-company access.
5. Owner prepares retained handover, interrupts download and retrieves the same generation/hash. Check source/notes/photos/PDFs/revision references. Reopen action and confirm prior package and original hashes stay unchanged.
6. Verify loading/failure/retry feedback, phone-width overflow, keyboard focus and return context. Record hosted, simulated-fault and human observations separately. No external messages or destructive cleanup.

## Short physical-phone script

Worker: open the assigned concern action, enable **Keep unfinished text on this device**, add **Completion update notes** and a photo caption; interrupt connectivity, background/reopen, sign in if prompted and **Resume device work**. Reselect the photo only if asked, then **Submit completion for verification** once. Supervisor: read **Recorded completion updates**, then **Verify and close**. Owner: **Download evidence package**, interrupt and **Retry evidence package**; open the retained ZIP and compare the entries. Record assistance/confusion and actual outcomes; do not infer acceptance from CI.
