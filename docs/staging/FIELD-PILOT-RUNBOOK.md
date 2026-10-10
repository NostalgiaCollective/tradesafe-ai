# Four-week, three-business pilot proposal

October 10 preparation update: [ready synthetic rehearsal](ELECTRICIAN-REHEARSAL.md), [actionable decisions and invitation-only entry clarification](PILOT-PREPARATION-DECISIONS.md), and [source-specific recovery operation](HOSTED-RECOVERY-OPERATION.md). Public self-service signup is a separate deferred scope item; invited participants still need verified individual access and tested recovery. No human rehearsal, hosted recovery, paid service or qualified approval is inferred. Prior evidence below is preserved.

Prepared October 10, 2026. Not launched; no businesses contacted, invitations emailed, money spent or real customer records collected. Entry conditions are in the [readiness matrix](COMMERCIAL-PILOT-READINESS.md). Until they pass, use synthetic rehearsal only.

## Cohort and scope

Recruit three Ontario licensed electrical contracting businesses doing residential service/renovation, each with 3–15 field workers. Recruitment and licence/qualification checks require an appointed coordinator; no business has been selected or vetted here. Begin with one supervisor and two workers per business (nine participants); the owner may also be that supervisor. Separate company memberships and personal accounts are mandatory. Expansion beyond those nine requires a capacity review.

Observe one representative service/repair and one renovation workflow per business. Unknown applicability stays unresolved; industrial/utility work is outside this workflow. Participants keep their existing required work/safety records and communication procedures. TradeSafe does not approve work, replace an emergency channel or establish a person's qualifications.

## Four weeks (relative to the recorded go date)

| Week | Activities | Exit evidence and decision |
| --- | --- | --- |
| 1: enter and practise | Independently sign in/join, confirm company/role, practise with separately labelled synthetic company/site, then one agreed in-scope job per business after Data gates pass. Observe one supervisor and two workers per business. | Each participant completes the role scenario; record assistance, timing, browser and failures. No real-data start for a business with unresolved access/privacy/content/recovery entry conditions. |
| 2: daily capture | Use concerns, captioned photos, recorded briefing versions and assigned follow-up on agreed jobs. Perform controlled disconnect/retry tests only in practice records. | At least 10 observed task attempts per business, including at least 5 worker captures. All original evidence retained; failed/abandoned attempts stay in the denominator. Coordinator triages feedback daily. |
| 3: supervision and retrieval | Owner/supervisor retrieves history, scoped evidence package and separate electrical job record. Exercise revised briefing and reassignment in practice. Operator checks backups and rehearses approved isolated recovery/rollback. | At least 5 retrieval and 5 follow-up attempts per business across the pilot; source/export reconciliation; named backup operator demonstrates the runbook. Do not rerun disruptive tests on active job records. |
| 4: evaluate | Repeat only corrected failures; separate participant statements from observed completion. Review anonymized per-business outcomes, support cost and requests. Export each business's own records for agreed handover. | Daniel and each business choose stop, extend with a specific fix, or propose controlled expansion. No automatic conversion to paid service. Retention/offboarding follows the approved agreement; no automatic deletion. |

## Onboarding checklist

Before inviting anyone: record the named primary/backup operator, support hours, emergency/fallback channel, go decision and three businesses' consent/agreements. Verify the served commit/project, required CI, capacity headroom, backup receipt and successful restore evidence. Do not use practice-provider accounts to claim delivered-email signup.

For each person, observe their own signup/confirmation or valid invitation and login/reload; verify the intended company and permitted role. Exercise password recovery with the person's specific authorization. Never share accounts, impersonate acknowledgements or give admin rights to solve a worker access problem. Distinguish the staging access gate from the account password. A failed independent entry blocks that participant.

In a synthetic practice company, use **Help → Practice a workday**. Prepared internal accounts are in ignored `.staging/first-workday-practice-private.json`; the coordinator supplies credentials privately using the existing mechanism, never in Help, chat logs or exported evidence. External participants need their own authorized accounts. A practice company is not converted into a real company.

Supervisor: select **Sites**, open the site, prepare a daily brief with eligible crew, and record it. Worker: open **My work**, acknowledge the displayed version, then **Report a concern** with a synthetic captioned photo. Supervisor assigns the action and deadline. Worker records progress and requests verification; supervisor reviews and verifies closure. Return to the site for **Daily handover**, history, evidence package and **Electrical job → Download electrical job record**. Confirm each download's stated scope.

Explain **Saved to server** versus **Saved on this device; upload pending**. Opted-in concern/brief text expires after seven days, with ten drafts/1 MiB total/128 KiB each. Photos and commands are excluded. Electrical job edits require keeping the page open until server-confirmed. Browser storage is not encrypted by this feature or a backup. On shared devices, default to no local copy; sign out and confirm cleanup. Demonstrate a safe failed save/retry and device-text comparison using synthetic text.

## Proposed measurable acceptance criteria

These are proposed go/continue targets, not achieved results or contractual promises. Use the [measurement schema](PILOT-MEASUREMENT.md); report denominators and per-business results. Automated tests never count as field observations. Do not exclude slow, failed or abandoned attempts. Mark cold/unknown starts separately.

| Measure | Proposed threshold / stop condition |
| --- | --- |
| Independent entry | All nine initial participants complete entry/reload and first role task without developer provisioning; record coordinator assistance separately. |
| Worker capture | At least 90% of observed concern tasks completed without assistance; median at most 90 seconds for short text plus one photo, excluding time spent assessing the hazard. At least 5 observed captures per business before evaluating. |
| Follow-up / owner retrieval | At least 90% independent completion, and median at most 2 minutes to find assigned work or the requested existing evidence; at least 5 of each task per business. |
| Integrity / access | Zero lost server-confirmed records, silent overwrites, duplicate retry records, cross-company exposure or changed retained bytes. Any occurrence stops real-data entry pending investigation. |
| Response time | Operator measures at least 20 warm synthetic saves and 20 reads across representative records: p95 at most 3 s save / 5 s read; one-photo upload at most 15 s and bounded export at most 30 s at stated size/network. Measure at least 5 first-after-idle starts separately; proposed start target 10 s. Failures count. Threshold failures require an operating/hosting decision, not a keep-alive workaround. |
| Recovery | Proposed initial RPO at most one workday (24 h) and RTO at most one workday (8 staffed h), subject to business approval. Demonstrate actual hosted capture/restore with all retained bytes, relevant Auth/config and ordinary access checks. Local seconds-long rehearsals do not satisfy these targets. |
| Support | Proposed staffed window weekdays 08:00–17:00 America/Toronto; primary acknowledges critical data/access incidents within 1 staffed h, ordinary problems within 1 staffed day. Backup takes over on missed acknowledgement. Commitments remain inactive until people and contact routes are named. |
| Business value | Each owner reviews their own evidence package and reports whether it reduced retrieval effort. Record their exact statement separately from measured time. All three owners must accept unresolved limitations before any expansion proposal. |

With a small pilot, percentages and p95 values describe the sample; they do not establish population reliability. Do not stretch three-business evidence into a production SLA. Capacity for all 45 possible field workers requires separate testing.

## Support and incident procedure

Participants use **Help and pilot feedback → Problem** or **Suggestion** and keep the support reference. Do not include passwords, invitation/recovery links, report text, photos, addresses or customer names. Feedback is saved in the app, not emailed or pushed. Company owners can review their company's submissions; workers/supervisors see their own. There is no global support inbox. The operator and each company owner must agree a daily review and contact route before launch. An outage needs an agreed out-of-app route, currently unassigned; no messages are sent by this plan.

Primary operator triages the reference, UTC time, served version, task label, safe failure code and whether input is still visible. Ask for no sensitive screenshots. Check health and protected identity; public health alone does not verify Supabase. Reproduce on synthetic records and inspect authoritative saved state before asking for a retry. Keep request identifiers stable; do not create replacement records or regenerate retained PDFs to hide a failure.

For suspected access leakage or missing confirmed data: stop new real-data use, notify the named owner through the approved process once authorized, preserve evidence and restrict only the affected access through approved controls. Never reset accounts or delete records as a diagnostic step. For ordinary network failures: keep the editor open, retry the same operation, or review **Device drafts** after same-account authentication. Never promise recovery of an unsaved file or unopened offline app.

Use [operations/rollback](PILOT-OPERATIONS.md) and [recovery procedure](BACKUP-RESTORE-DRILL.md). A rollback requires a previously passing compatible commit, available artifact and privately checked configuration/migration compatibility. No migration rollback or data restore into the live project. Verify identity/access and retained hashes before reopening access. There is no executed current rollback drill in this assessment.

Close an incident only after the reporter checks the outcome or the operator records what remains unconfirmed. Preserve the original failure and correction evidence. Weekly review: aggregate task outcomes, safe error counts, response-time samples, unresolved support items and quota headroom. No alerting service, recurring job or external communication is activated here.

## Data handling proposal for review

Collect only job records needed by the business; avoid faces, unrelated personal information and private customer documents. Company access and worker record restrictions remain enforced. Explain to participants who can see their records, how to request a copy/correction and whom to contact about removal. Finalized originals are corrected through amendments rather than rewritten.

Before real data, a qualified reviewer and each business must approve purposes, access, processor arrangements, export custody, breach handling, legal holds and category-specific retention for drafts, immutable records, invitations/audit, feedback, local copies and backups. Do not invent a universal legal retention period. Proposed pilot measurement retention is 30 days after the decision meeting, followed by approved disposal of raw observations and retention of aggregate decisions; this is a proposal, not an activated deletion schedule. Existing evidence is preserved.
