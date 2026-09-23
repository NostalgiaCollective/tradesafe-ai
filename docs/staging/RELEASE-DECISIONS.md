# Release decision register — 2026-09-16

Proposals for review, not approvals. Staging remains the only deployment target. No retention job, checklist publication, paid entitlement, plan or spending change is authorized here. [Verification details and exact signup procedure](RELEASE-GAP-VERIFICATION.md); current commit/CI/deployment receipts are in `.staging/reliability-workflow-checkpoint.json`.

| Gate / missing evidence | Agent can finish | Daniel / qualified reviewer needed | Proposed decision and implications |
| --- | --- | --- | --- |
| WebKit / Safari | Run real hosted workflows on an approved compatible runtime; diagnose app failures. Windows currently blocks `icuin77.dll` with Code Integrity events 3033/3077. | Administrator-approved runtime or an existing approved macOS/Linux environment; Daniel performs physical iPhone checks. | Preserve security controls. No relocation, renamed binaries or policy weakening to get a pass. Automated WebKit remains pending. Daniel has separately reported acceptance of the tested iPhone report/photo/finalization/PDF/correction workflow and persistent amendments; other physical coverage remains pending. |
| Fresh signup delivery | Non-email validation/callback checks and failure wording fixed; execute the prepared one-email test after authorization. | Daniel authorizes the unused recipient **and signup test**; the sender must permit that address. Recovery-account authorization is insufficient. | Authorize one confirmation email to a controlled, unused, provider-permitted address. Otherwise review sender arrangements separately without new charges. Keep Google/magic-link off until independently verified. |
| Backup / restore | Manifest/target validator and database-plus-object procedure prepared; execute and measure after prerequisites exist. | Operations owner supplies explicitly authorized empty isolated Supabase-compatible target, database export/restore access and protected independent archive destination. | Keep drill blocked; disable outbound integrations in the destination. Never restore over staging/production. Set RPO/RTO, cadence and custodians from measured results, not archive validation. |
| Safety content / claims | Maintain question/source/version review matrix; implement explicitly approved revisions. | Named qualified trade/jurisdiction reviewers approve wording, evidence requirements, competence assumptions and claims. | Keep content pending review; no compliance certification or unreviewed candidate publication. Approve a new version; preserve historical snapshots. |
| Privacy / retention / support | Implement approved notice and authenticated export/deletion intake; map records/access and legal holds. | Daniel names support owner; qualified privacy/legal review sets jurisdiction, purposes, response commitments and retention periods. | Explain company access, normalized photos/EXIF removal, timestamps and immutable records; avoid unrelated personal data. Set separate periods for drafts, finalized evidence/PDFs, invitations, audit, recovery and backups. Retain current data meanwhile; no destructive job or immediate erase of finalized evidence. |
| Operational ownership | Prepare/run approved monitoring and incident procedures; sanitized events and health endpoint exist. | Daniel names primary/backup operator, alert destination, escalation, secret custodian and response expectations. | Establish owned incident/rollback/backup procedures before production. Review provider-log privacy. No unsolicited alerts/emails or credential rotation. |
| Capacity / device coverage | Design and run a bounded load test within approved workload/budget; existing limits are tested. | Daniel specifies expected crews/uploads/PDFs and pilot devices; operator approves load and acceptance criteria. | Current quotas and Render Free cold starts are staging constraints, not measured production capacity. Retained-byte reads remain available under generation quotas. On September 17 Daniel confirmed iPhone Safari photo upload, thumbnail/full-image display after reload and retained photo. On September 19 Daniel reported that the tested iPhone report/photo/finalization/PDF/correction workflow is connected and working, and amendments persist. This is user-reported acceptance, separate from automation. Caption-specific persistence, untested permissions and new onboarding acceptance are not inferred; no exact size/build/device version is inferred. Other physical checks remain pending unless separately reported. |
| Billing reconciliation | Read-only configuration inspection complete; implement reconciliation only in separately authorized scope. | Daniel decides unpaid/paid pilot, entitlement/refund/tax rules and authorizes future billing work. | Keep checkout/verification disabled. Paid phase needs verified webhook signatures, replay/idempotency, server-owned entitlements and legacy reconciliation. Payment never implies work completion or safety approval. No billing settings changed. |

## Read-only billing snapshot

Render: Hobby workspace, existing Free staging service, automatic deploys and PR previews off; dashboard reports 1.55/750 free instance hours, 7/500 pipeline minutes, 80 MB/5 GB bandwidth, accrued/projected USD 0.00. An existing payment method is present and unchanged. This is a timestamped snapshot, not a guarantee of zero future charges.

Supabase: organization Free Plan, spend cap enabled; excess quota may cause unresponsiveness/read-only service. Dashboard displayed 29/500 MB database, 0.04/5 GB egress, 9/50,000 monthly active users and rounded 0.00/1 GB storage. These are organization totals, not isolated staging capacity measurements.

Application: both checkout routes return `deferred`; hosted configuration rejects Stripe credentials and the launcher blanks optional payment/model keys. No Stripe key was present in inspected local/staging configuration. No authenticated Stripe account or webhook/entitlement reconciliation was established. Checkout and branch-only Vercel suppression remain unchanged. Production readiness is not claimed.

## Interrupted-work phase

Focused reliability evidence is recorded in [the interruption verification record](INTERRUPTION-VERIFICATION.md). It does not close delivered-email signup, isolated restore, content/privacy approval, operational ownership, capacity/WebKit/device, billing or pending onboarding phone acceptance gates. Daniel's earlier iPhone acceptance remains user-reported evidence for the tested prior workflow; this phase needs its own phone retest.

## Daily Operations checkpoint

The dashboard, company-scoped report library, mobile report journey, correction-evidence links and settings navigation are covered in [Daily Operations](DAILY-OPERATIONS.md). No release-policy decision, billing capability or retention behavior changes. This checkpoint requires passing exact-commit CI before staging deployment; the previous npm audit service failure was resolved on run 35456998866 attempt 5. New physical-phone acceptance remains pending and must not be inferred from Daniel's earlier workflow acceptance.

## Phase 4–6 release-candidate update

Daniel confirms the current workflow is working as planned. This is user-reported overall acceptance; it does not invent individual phone, browser, signup, restore or permission results. The current pilot recommendation is conditional staging/pilot continuation only. Operational diagnosis now records stable failure codes for failed upload/PDF admission alongside duration and kind, without recording sensitive payloads. The incident and rollback procedure is [PILOT-OPERATIONS.md](PILOT-OPERATIONS.md).

The exact delivered SHA, CI, deployment identity, hosted daily workflow and hosted interruption workflow remain those recorded in `.staging/reliability-workflow-checkpoint.json`. No new migration or deployment is implied by this decision-register update.

## Release-verification wording and dependency follow-up

Implemented engineering work is delivered; release verification remains incomplete. `@anthropic-ai/sdk` is now pinned to compatible patched version `0.91.1` for GHSA-p7fg-763f-g4gf/CVE-2026-41686, and the local audit reports zero vulnerabilities. This does not close WebKit execution, fresh delivered-email signup, or isolated restore. Those gates require the access and infrastructure decisions listed in the current checkpoint.

## Disposable browser verification and deferred domain decision

Daniel's intended future domain is `tradesafeapp.ca`, unpurchased with no purchase budget. Domain setup and actual fresh-signup email delivery are deferred; preserve current Render origin, login and recovery. No active app URL, SMTP sender or redirect may use the intended domain before ownership and setup are verified. Existing Gmail identity stays intact and the final fresh recipient must be reconfirmed before future dispatch. The [disposable local WebKit harness](LOCAL-WEBKIT.md) advances browser coverage independently using local Supabase and captured mail. Its execution results cannot close hosted-WebKit, real-delivery, physical-device or restore gates.

## Bounded recovery-engineering milestone

Task-owned local source/target creation is now explicitly authorized for a [synthetic recovery rehearsal](BACKUP-RESTORE-DRILL.md). The current checkpoint and exact-commit CI distinguish implementation from executed results. Even a passing local restore does not authorize a hosted export or close hosted recovery, independent backup storage, full Auth/configuration recovery, operational ownership, RPO/RTO, domain or delivered-email gates. Tooling-only changes do not require a staging deployment; the served application identity remains separately recorded.

## Daily follow-up usability

Daniel reports that the latest report-completion workflow works on his phone (the usability update delivered at `7c9d960`). This is overall user-reported acceptance, separate from automated checks; no individual test results, other devices, permissions or production readiness are inferred. The new [daily follow-up milestone](DAILY-FOLLOW-UP.md) does not reopen domain/email or recovery work. Existing gates and evidence remain intact; current exact CI and staging receipts remain in the durable checkpoint.

## Plumbing and roofing verification

The [cross-trade verification milestone](PLUMBING-ROOFING-VERIFICATION.md) adds focused local WebKit coverage using disposable synthetic fixtures. Functional passage does not approve checklist content, legacy credential terminology, numeric/code statements or compliance claims; those remain for qualified review. No content/version changes are authorized here. Daniel's praise is not physical acceptance of daily follow-up; that phone check remains pending. Existing domain/email, hosted recovery and operational/policy gates are unchanged.

## Daily site safety brief

The [separate staging recording workflow](DAILY-SITE-BRIEF.md) supports Ontario construction context without representing the existing installation reports as workplace assessments. Its [draft source register](DAILY-BRIEF-SOURCES.md) distinguishes legislation, ministry guidance, CCOHS/IHSA guidance and proposed product/company conventions. Direct Ontario sources returned HTTP 403; exact current consolidation/effective dates and all proposed prompts require a qualified Ontario construction-safety reviewer. Daniel must arrange that review before content approval or broader release. Functionally passing tests do not close this gate.

Authenticated acknowledgements are version-bound records, not signatures, qualifications or evidence of understanding. Entered attendance, reported communication and work pauses are distinct; no notification or statutory process is performed. Privacy/retention review must include crew names, acknowledgement timestamps, version history and exported copies. Existing policy, operating ownership, hosted recovery, capacity/device and deferred domain/email gates remain pending. Daily follow-up phone acceptance also remains pending; praise is not acceptance evidence.

## Source-linked draft content and review

Daniel confirms the daily-brief export matches his entries exactly: user-reported physical export acceptance only. No additional device results are inferred. [The bounded plumbing-materials pilot](SOURCE-LINKED-CONTENT.md) adds source disclosure and immutable content/review provenance. Ordinary public-browser access resolved the prior Ontario access gap; OHSA and Construction Projects consolidation metadata are verified through displayed e-Laws currency 2026-09-16. Individual commencement histories, later changes and IHSA publication/revision date are not inferred. Qualification, applicability and wording remain for a separately appointed reviewer. No reviewer or approval is seeded; owner/supervisor roles do not authorize professional review. Other release gates remain unchanged.


## Returning-site workspace

Daniel confirms task prompts, source navigation and return/recall work on his phone: user-reported functional acceptance only, not qualified safety-content approval. Content remains draft. The site workspace links briefs, reports and existing Actions through explicit company-scoped associations. It introduces no regulatory claims, automatic historical matching, notification or external integration. Exact executed delivery evidence is in the durable checkpoint and `.staging/site-workspace-delivery.md`. Existing qualified review, policy/operations, capacity/device, hosted recovery and deferred domain/email gates remain unchanged.
