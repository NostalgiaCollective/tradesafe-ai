# Source-linked draft content and qualified review

Daniel reports that the daily-brief export matches his entries exactly. This is user-reported physical export acceptance only; no additional device or workflow result is inferred.

## Bounded pilot and sources

The immutable [canonical payload](../../lib/domain/content-pilot.json), `on-plumbing-materials-2026-09-21-v1`, concerns moving plumbing materials along a ground-level Ontario construction route. Four optional prompts cover the route/destination, handling effort, material stability and crew discussion. Each has a stable ID/version, wording, applicability, sources, rationale, limits and requested reviewer decision. All wording is draft. Hoisting, powered-equipment operation, stairs, heights, excavation, energized work, hazardous substances and unusual loads are excluded. This is not a lifting plan or complete assessment.

In **Hazards and controls → Task prompts and sources**, choose **Suggested task prompts**. Each reminder has **Why this matters / Source**. Reading/selecting prompts never creates hazards, confirms controls or acknowledges a briefing. Changing jurisdiction/workplace clears the selected pilot, preserving entered hazards. User-entered hazards and company instructions are distinct from professionally reviewed source content. **Open content review record** shows the review package.

The text-fetch service still returned HTTP 403 for Ontario pages, but ordinary public-browser navigation returned HTTP 200 and full rendered official text. Relevant OHSA duties and Construction Projects housekeeping sections were read directly. No access-control bypass, proxy or search-snippet substitution was used. [Retrieval evidence](source-verification-20260921.json) records titles, displayed consolidation metadata and ministry dates. Official Word download links were identified; verification used rendered e-Laws text, not uninspected downloads.

| Source and exact pilot mapping | Dates verified; retrieval 2026-09-21 |
| --- | --- |
| Ontario Legislature, OHSA, R.S.O.1990 c.O.1: 25(2)(a),(d),(h); 27(2)(a),(c); 28(1)(c),(d) | Consolidation from 2025-11-27 through displayed e-Laws currency 2026-09-16; last amendment 2025 c.13 Sched.4 |
| Ontario Lieutenant Governor in Council, O.Reg.213/91: 35(1),37(1),38,39,45(1) | Consolidation from 2026-04-20 through displayed currency 2026-09-16; last amendment 116/26 |
| Ministry housekeeping/general-requirements guidance: defining adequately lit; overview | Published 2022-07-28; updated 2025-10-30 |
| CCOHS MMH—General Practice: before lifting | Fact sheet revised 2019-06-04; publisher confirmed current 2025-01-21; page modified 2026-09-17 |
| CCOHS MMH—Materials Flow: reducing handling/moves | Fact sheet revised 2025-03-12; page modified 2025-08-28 |
| IHSA Back care—Basic manual material handling: printed pp.155–156, dangers/controls/crew discussion | Official two-page PDF text verified; publication/revision date not shown |

The payload includes full URLs, authorities, sections, classifications, jurisdiction/applicability and date/access limitations. Legislation is distinct from ministry and CCOHS/IHSA guidance. Consolidation start is not an individual provision's effective date. Retrieval does not establish currency after the displayed e-Laws date; individual commencement histories remain unverified. The referenced Lighting Handbook was not obtained; no paywalled standard or numeric lighting threshold is reproduced. No company policy is adopted.

Ordinary browser access also resolved the earlier ministry construction-hazards, supervisor, constructor and work-refusal pages; publication/update dates are in the receipt. The earlier source register remains a historical record of its original access limitation, not retrospectively approved content.

## Review and immutable version handling

New additive migration `20260921000300_brief_content.sql` creates immutable payloads and append-only review decisions. A version begins **draft**, attributed to draft-content engineering with server registration time. A separately authorized decision can mark it **reviewed** or **superseded**; superseded is terminal. Changed wording/source mapping requires a new version through an authorized code/additive-migration deployment. Authenticated app users cannot publish, edit or delete content rows. No historical migration is edited or replayed.

Company owner/supervisor permissions never grant professional review authority. No staging reviewer or approval is seeded. After separate explicit authorization, a database operator can appoint a specifically identified reviewer for one version in `ts_brief_content_reviewers`, recording confirmed qualification scope, appointment reference and expiry. The table is inaccessible to ordinary authenticated users. Qualification/appointment evidence is an external review decision, not an agent inference. Revocation/expiry blocks decisions. Do not put credentials, recovery links or unnecessary personal data in references.

An appointed reviewer sees **Record an authorized review decision** in the review record. The HTTP API validates origin, actor and bounded body; SQL independently requires current membership and a live version-specific appointment. Decisions store actor, reviewer name/scope, appointment and decision references, notes, server timestamp and idempotency ID. Conflicting/stale operations cannot rewrite history; retries recover the same result. Successful review transitions in tests are synthetic disposable-database fixtures, never real approval.

The reviewer must decide:

1. Current Ontario applicability, selected clauses and any changes after the displayed currency date.
2. Each prompt's `reviewQuestions`: wording, source mapping, omissions, ergonomics/pipe-handling scope and unusual-load exclusions.
3. Whether wording clearly separates proposed/implemented/reviewed controls, attendance, acknowledgements, communication and pauses from qualification, statutory duties and authorization to work.
4. Approve within a documented qualification scope, or supersede. Wording changes require a new version. No reviewer is currently appointed; all content remains draft.

New drafts carry an available content version but no selected pilot. Existing drafts are never backfilled: missing provenance remains unknown until the user explicitly selects a version for that draft/revision. Server validation checks version/task applicability. On recording, the canonical content payload and review decision/state are copied into the immutable brief snapshot; client-supplied wording/status/attribution is not trusted. Recorded views and exports use this snapshot, not the latest registry. Later reviews/content updates cannot alter previous assessments or acknowledgements. Older snapshots retain any known legacy version string with detailed provenance explicitly unknown.

The private printable HTML export includes selected prompt IDs/versions, wording, source sections/URLs/dates and review provenance at recording. With no selected pilot it says so. Original trade reports, retained PDF bytes, installation templates and private photos are unchanged.

## Verification and boundaries

Focused SQL tests cover app-role denial, explicit synthetic appointments, expiry/revocation, state transitions, retry deduplication, source applicability, unknown historical records and unchanged briefing/acknowledgement snapshots. Shared local WebKit/hosted Chromium coverage exercises disclosure with keyboard access, source links, draft labels, review-control denial, export references and existing daily brief behavior. Required report/photo/PDF/amendment/Actions/access regressions remain in CI. Existing recovery regression is retained as a gate; no new recovery milestone is commissioned.

Exact execution, commit/CI, one-time migration and served identity are maintained in the durable checkpoint and `.staging/source-content-delivery.md`. Implementation alone is not a passed gate. Production, hosted evidence, resource limits, billing, domain and external email remain unchanged. This is source-linked draft content, not professional approval or production readiness.
