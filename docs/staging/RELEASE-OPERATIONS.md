# Staging release operations

Scope: `astra/production-mvp`, the separate Render Free service `tradesafe-staging-yqkiizimbtlygovkscoh`, and Supabase staging `yqkiizimbtlygovkscoh`. No production change, checkout, migration replay, payment method or paid resource. This is a prepared procedure; no Render deployment, restart or rollback has been verified.

## Resume and deploy without duplicates

1. Read `.staging/physical-phone-checkpoint.json`, current Git status and remote branch SHA. Preserve newer work and all failed-run evidence. Inspect the available browser and Render workspace inventory before creating anything. Record account verification as observed; lack of browser access is not evidence of an unverified account. Do not resend verification email automatically.
2. Confirm the workspace is free, has no saved payment method, and the specific web service offers Free in Ohio. Check remaining included usage, existing service IDs and pending deploys. If the exact service already exists, inspect its source, environment and provenance before resuming it. Do not duplicate it or adopt an unrelated same-named service. If a paid requirement appears, record it and stop that operation.
3. Use `render.yaml` only for the approved new service. No pre-deploy command, database, disk, cron, worker, environment group or paid integration. Confirm manual deployment remains off for automatic triggers. Transfer private staging values from ignored files through supported masked configuration fields; record names and validation results only.
4. Record the assigned HTTPS origin from Render. It must match `HOSTED_ORIGIN`, the service URL and public app URL exactly. The proposed name is not proof of assignment. If it differs, stop before Auth changes and reconcile the intended target. Build with `npm ci --ignore-scripts && npm run staging:hosted:build`; start with `npm run staging:hosted:start`. Select the exact branch commit whose CI passed, never an unreviewed latest deployment.
5. Record service/deploy IDs, SHA, start/end times, plan, region and canonical origin without secrets. Wait for an in-progress build before retrying. Health `ok` proves only liveness. Compare the gated identity endpoint's commit, branch, project and public-key digest with the selected artifact and private configuration.

Render documents Free services, usage suspension when no payment method is present, ephemeral local files and restricted runtime features. Account eligibility still needs dashboard inspection. See [Free service conditions](https://render.com/docs/free). Manual selection of an exact commit is supported in [deployment controls](https://render.com/docs/deploys).

## Hosted acceptance before requesting email

Record each result separately with time, exact source and environment. Local simulation does not satisfy these rows.

| Check | Required result |
| --- | --- |
| Real HTTPS | Certificate validation succeeds without an insecure bypass; HTTP redirects to the assigned HTTPS origin without sending credentials over HTTP |
| Gate | Fresh context challenges pages, APIs and static files; wrong credential fails; health returns only `ok`; successful gate still requires ordinary account authorization |
| Origin | Wrong Host/protocol rejected; cross-origin mutation denied; identity agrees with the approved source/project; no indexing or shared private caching |
| Recovery fragment | In a fresh browser, open a non-secret malformed fragment such as `/auth/recovery#probe=staging`; pass the actual Basic challenge and observe the same fragment reaches the document before the recovery UI strips it. Do not treat server-only gate tests as proof. Then complete the actual delivered-link case on the phone |
| Cookies | Ordinary HTTPS session cookies Secure/SameSite=Lax; recovery grant Secure/HttpOnly/SameSite=Strict. Record flags only, never cookie values |
| Ordinary accounts | Existing owner/worker/supervisor/outsider sign in; active membership preserved; no admin token used to satisfy permission assertions |
| Draft | Journal one synthetic draft ID before editing; save acknowledgement, reload and compare content; denied cross-company access; retry resumes the same draft |
| Photos | Read retained photo through authorized API and compare historical hash; direct public/ordinary Storage access and outsider access denied |
| PDF | Authorized retained download matches hash. Generate only a separately journaled synthetic finalized report/export to prove Linux PDFKit/font/sharp runtime; never replace retained exports. Reuse an existing unfinished attempt when appropriate |
| Failure behavior | Missing evidence fails explicitly; unknown network/provider failure never counts as permission denial; checkout stays unavailable |

After acceptance, read and save the current staging Auth configuration privately. Set Site URL to the verified origin and add exactly `/auth/callback` and `/auth/recovery` at that origin while preserving existing localhost entries. Reload to confirm. Keep the existing single-recipient allowlist and provider throttles. No wildcard redirects or template link tokens in logs.

## One recovery email and the physical phone

Before dispatch, reconcile the dedicated recipient's current private password against the saved delivery state; retain the old password and planned phone password privately. Do not administratively reset it. Inspect request/receipt evidence and actual throttles. A generic 202 is not proof of delivery. If an earlier request may have succeeded, inspect the authorized inbox before retrying; do not reset database counters or resend blindly.

When the phone is ready, journal one hosted request and confirm receipt in the already-authorized inbox. Record message ID/time and origin match only. Do not consume the recovery authorization on the computer. Give the user the next action only: open that delivered message's link on the physical phone. Access credentials are viewed privately in `.staging/hosted-access.json`, never pasted into chat or URL. The access password and account password are different credentials.

Record device model, OS, browser, email app and full browser versus embedded view; unknown versions remain unknown. Guide the gate prompt, recovery identity confirmation and password update one step at a time. If needed, use the mail client's supported Open in browser action with the same unconsumed link. Record failures before any alternative. Following observed password success, prove the saved new password succeeds and the old one fails for the dedicated account, then update only its private current-password entry. Existing access JWTs can remain usable until expiry; do not claim immediate universal session revocation.

Next guide phone sign-in, draft save/reopen, retained photo review, and PDF download/open in the phone's viewer. Record observation versus automated assertion separately. Do not claim device success from emulation. Keep recovery links, screenshots of secrets, passwords and email bodies out of evidence.

## Restart

First capture a sanitized failure code, deploy ID and timestamp. Check Free usage/suspension and whether a deploy or restart is already active. A normal sleep/wake delay is distinct from a product failure. Use the existing service's supported manual restart control once; do not create another service or use a keep-alive job. If the control is unavailable, manually redeploy the same verified SHA, checking build allowance first. Do not select an unverified latest commit. See [Render deploy controls](https://render.com/docs/deploys).

After restart, compare the gated identity and ordinary authorization again. Verify previously journaled draft content and retained photo/PDF hashes. Pending photo reservations and export leases survive in Supabase; inspect their state before retrying. No deletion, counter reset or migration is needed. Record restart evidence and keep automatic deployments off.

## Rollback

Record the candidate's prior successful deploy ID/SHA, matching six-migration compatibility and private environment version before touching the service. If no prior compatible hosted artifact exists, the safe response is to suspend access and repair forward; `575be4f` lacks the hosted launcher and is not a hosted rollback target.

On the existing service's Deploys page, select an available compatible successful artifact and its Rollback action. Confirm it remains Free and manual. Render's rollback can restore target environment variables while leaving current service settings in place; compare secret versions and build/runtime identity, and never reactivate a compromised credential. If identity or key configuration differs, rebuild the selected compatible SHA with the correct private environment instead of bypassing the launch guard. These semantics and artifact availability limits are described in [Render rollbacks](https://render.com/docs/rollbacks).

A code rollback does not roll back Supabase records, stored bytes or Auth settings. Preserve all six migrations and immutable snapshots. With the same canonical origin, keep exact Auth redirects; any recovery of Auth configuration must restore the saved staging-only values and preserve localhost/allowlist. Do not change the original project. Re-run HTTPS, gate, identity, ordinary membership and retained-byte checks before resuming phone work.

## Current production blockers against implemented capabilities

2026-09-16 update: [Reliability workflow](RELIABILITY-WORKFLOW.md) records the subsequent hosted-workflow delivery and local verification; consult its durable checkpoint for the exact deployed SHA. The seventh additive migration introduces upload/PDF resource admission without altering historical records. Code rollback leaves that additive table/function in place; never replay or remove migrations. [Release decisions](RELEASE-DECISIONS.md) contains reviewable privacy/retention/content/operational proposals. The table below preserves the earlier baseline; completed hosted checks are not reopened merely because that baseline calls them pending.

| Area | Implemented/evidence | Still required |
| --- | --- | --- |
| Core workflow | Phase 2 verified company memberships, drafts, immutable finalization/amendments and corrective actions | Hosted regression and physical workflow observation |
| Evidence | Phase 3 verified private normalized photos, integrity checks and retained PDFs | Hosted native-runtime and physical download checks; ongoing capacity/incident procedures |
| Recovery | Provider-verified grants, shared throttles and three actual delivered-email cases passed on desktop/emulation | Public staging gate/email/phone flow; reviewed production sender/domain; broader browser coverage |
| Content | Versioned checklist snapshots and explicit user declarations | Qualified safety-content review and approved claims; no approval inferred from test results |
| Privacy/support | Private storage and company access controls | Decisions on consent, deletion/export handling, retention and support ownership; no invented retention period |
| Abuse/operations | Recovery quotas, bounded photos/PDFs, staging gate, CI and secret separation | Broader abuse protection, capacity monitoring, secret rotation, incident response and hosted release evidence |
| Recovery of data | Concrete database-plus-object drill in the linked plan | Authorized isolated target, actual backup/restore execution and measured results |
| Billing | Checkout deliberately disabled | Separate billing reconciliation and authorization before enablement |

Historical audits describe earlier implementations. Use their dated observations as history; do not reopen already completed recovery or evidence development merely because an old document calls it missing.
