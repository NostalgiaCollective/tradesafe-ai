# Daily site safety brief — staging candidate

This milestone adds a separate daily recording workflow. It does not replace electrical/plumbing/roofing installation reports or approve safety content. The previous cross-trade verification is preserved at `9467bf232ffd883a93b4e401e223e0484bda5fcb`; the new branch changes build on it.

## Implemented scope

From **Open daily site briefs**, a member can start a saved brief or reuse only a previous site's name/address and contact. Date, context confirmation, crew, task steps, hazards, controls and briefing acknowledgements start afresh. Drafts use the existing actor-bound autosave and optimistic revision mechanism, with server-confirmed Saved, retained input on an open page, explicit retry and unsaved-navigation warnings. No offline storage is promised.

**Site → Today’s work → Hazards and controls → Crew briefing** captures user-confirmed jurisdiction/workplace context, contact and crew. Optional prompts are expandable; workers may enter any task-specific hazard. Controls are proposed or reported implemented, with a distinct supervisor/owner review record on a particular recorded version. No control state, review or action closure authorizes work.

**Record briefing version** preserves an immutable snapshot, attribution and server time. Attendance entered by the recorder is separate from **Acknowledge this version**, which binds the signed-in participating worker and timestamp to that version. **Revise brief** preserves earlier versions, clears briefing notes/attendance for renewed entry, and does not transfer acknowledgements or reviews. An app permission does not appoint a constructor, competent person or statutory supervisor.

Unresolved entries create ordinary **Actions** once per brief/entry. Control responsibility recorded in the assessment is separate from action assignment. Worker-created actions start assigned to the recorder; supervisors/owners may assign the recorded responsible member and use existing reassignment controls. Existing progress, verification, role checks and history apply. A later assessment does not overwrite the original action finding or silently reopen a closed action: its originating version and current brief are both linked. No external communication occurs. Pause reasons and user-reported communication are explicit; an app pause is separate from the statutory work-refusal process.

**Export daily brief** downloads a self-contained, printable HTML document. It contains the selected immutable assessment, briefing, attribution, source version, version-bound acknowledgements/reviews and clearly labelled current action status as of export. It is not a retained immutable PDF; existing trade PDF storage and historical hashes are unchanged. Export requires current authenticated company membership.

## Data and limits

Two new additive migrations: `20260921000100_daily_briefs.sql` adds brief/draft, immutable version, acknowledgement and review tables with read RLS and command-only writes. The existing Actions table gains a second, company-checked origin; exactly one report or brief origin is required. Making report_id nullable under that exclusive-origin constraint removes no data. `20260921000200_brief_action_assignment.sql` closes a new-path assignment gap found during review: a worker recording somebody else's control responsibility cannot use that field to assign them a follow-up. It replaces only the new brief command function and preserves all existing rows. The first migration was already applied, so it was preserved rather than edited or replayed. Existing company/role permissions remain authoritative.

Only the existing staging artifact/runtime exposes this workflow. Limits: 100 new briefs/company/day, 20 task/hazard entries per brief, 50 crew members, 2,000 characters per text field, 80 KB document/90 KB command body. Recent lists and version history are bounded to 50. Existing photo, normalization, PDF and private-storage limits remain intact. No attachments or extra storage system are added to briefs.

## Content and verification

See [the versioned source register](DAILY-BRIEF-SOURCES.md). Ontario primary-source currency/effective dates remain unverified because direct public retrieval returned HTTP 403. All prompts await qualified review. Generic recording can be tested independently of that gap.

Focused tests cover SQL authorization, stale writes, immutable snapshots, acknowledgement version binding, proposed/reported/reviewed distinctions, safe site reuse, action deduplication and export escaping. The new shared application journey runs on disposable-local WebKit and hosted Chromium: draft reload, simulated interruption before save, simulated lost response after real recording commit, revision/renewed acknowledgement, readable export, existing Actions progress/verification and revoked/cross-company denial. Existing report/photo/PDF/amendment/evidence browser regressions remain required.

Execution receipts, exact commit/CI/deployment identity, screenshots and limitations are maintained in `.staging/reliability-workflow-checkpoint.json` and `.staging/daily-brief-delivery.md`. Implementation alone is not a passed release gate. Both required CI jobs must pass on the exact commit before the new migration is applied once to verified staging and the existing service is deployed.

Phone acceptance, once deployed: **Open daily site briefs → Start daily brief**; enter Site, Today’s work and one hazard/control; wait for **Saved**, reload, record the crew briefing, **Acknowledge this version**, then **Revise brief** and confirm a new acknowledgement is needed. Open the linked action and **Export daily brief**. This remains pending until Daniel reports the result.
