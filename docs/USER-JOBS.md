# TradeSafe user jobs

Discovery date: 2026-09-10. These are repository-supported product hypotheses, not findings from customer interviews. Sources: `raw/intent.md`, `raw/architecture.md`, current routes and SQL. Review with Daniel before implementation.

## Confirmed market and present account model

Ontario electrical, plumbing and roofing contractors are explicitly supported. The app has three trade templates and a `trade` enum, not a universal trades platform. Preserve those three and make templates extensible; do not add professions or jurisdictions without reviewed content.

The only authenticated actor currently implemented is a user operating their own contractor account. Business name and credentials are attributes of that user. `crew_members.role` is a free-text occupational description; it grants no permissions. No company, owner/member access roles, invitation, assignment, approval or dispatcher workflows exist.

## 1. Contractor / field report author

**Support:** raw intent explicitly names tradespeople, crew leads and forepeople; report form asks for supervising journeyperson and job information. These can be one individual in a small business. They are not separate implemented authorization roles.

| Area | Job |
| --- | --- |
| Primary job | Record what was checked at a job site, identify exceptions and produce a retrievable record of the work |
| Recurring tasks | Start or resume a report; select trade; confirm job/date; answer applicable items; add explanatory notes and photos; review; finalize; export |
| Information needed | Business details, job location/reference, current reviewed template, applicable permit/certification details, prior draft, unanswered items and findings |
| Actions needed | Explicit answer selection; mark not applicable with a reason where required; capture evidence; correct draft errors; acknowledge accurate observations |
| Pain addressed | Lost paper, repeated typing, missing evidence, difficulty finding records during an inspection or client discussion |
| Success | No unchecked item represented as passed; work survives ordinary interruptions; report retrieved without searching through paper; output accurately reflects recorded facts |
| Must work on phone | Capture/resume, large answer controls, camera/upload/retry, review exceptions, save confirmation, find recent report, download/share through device facilities |
| Primarily desktop | Long retrospective searches, careful review of longer reports, bulk administrative work if later validated |

Do not require a homeowner on every commercial job, a licence identifier for every trade, or an absolute compliance declaration to record a failed item. Required fields need trade/job applicability and reviewer confirmation.

## 2. Owner-operator / business record keeper

**Support:** raw intent names company owners; dashboard/settings provide business profile, credentials, report history and roster. Today this person uses the same personal account permissions as the report author.

| Area | Job |
| --- | --- |
| Primary job | Keep accurate, attributable job records for the business and retrieve them when a client, inspector or insurer requests evidence |
| Recurring tasks | Set business identity; maintain relevant credentials; create/review reports; locate completed work and unresolved findings; export; resolve payment issues |
| Information needed | Which job/report, work date, author, finalization state, findings, export access and last saved state |
| Actions needed | Edit business settings; create/resume; search/filter; review/export; request correction/support |
| Pain addressed | Fragmented records, repeated identity data, uncertain completion, lost reports, unreliable billing access |
| Success | A useful report can be found quickly; completed evidence cannot silently change; charges and access reconcile; customer information remains private |
| Must work on phone | See relevant work, find/export one report, create first report, update essential settings and recover from an error |
| Primarily desktop | Business setup and deeper history review; team administration only if shared company accounts are approved |

For a one-operator pilot, use one named operator per business and state the limit explicitly. Never recommend sharing credentials to simulate a team. If more than one person must work in the same company's records, a real tenant/membership model is mandatory before that pilot.

## Actors that are not confirmed product users

| Actor | Present evidence | Decision |
| --- | --- | --- |
| Crew contact | Name/trade/licence roster | Preserve as contacts; no implied invitation or access |
| Separate employee/technician account | Target market suggests it may help; no current membership or assignments | Daniel must confirm pilot need; then owner/member minimum with tested boundaries |
| Manager/supervisor approver | Supervising name is captured, but no approval flow | Do not invent review authority or approval state |
| Dispatcher/coordinator | No job scheduling, dispatch, assignments or work orders | Defer |
| Office administrator | Business record work plausible, no distinct privilege requirement | Defer separate role |
| Inspector/client/insurer | Likely report recipient in intent; no portal or shared access | Export recipient, not an application login in MVP |
| Internal support admin | Needed operationally, no app admin function | Start with restricted provider consoles and documented support procedure; no unrestricted impersonation feature |

## First value and customer validation

Proposed first-use sequence: verify account → enter business name and only necessary trade details → start first job report → answer explicitly → review findings → finalize/export → find it again. Offer empty-state guidance inside actual work, not a long product tour.

Validate with at least one operator from each supported trade before claiming applicability. Ask a participant to complete and retrieve a report on their own phone, interrupt/reload it, enter a failed item, recover a failed save/upload, and identify exactly what the report asserts. Observe typing burden and terminology. Use an isolated demo/staging environment, with clearly identified sample jobs and no customer account contamination.

Unanswered: whether a shared multi-user company is essential on day one; which initial business/trade will trial the product; who approves regulatory content. These affect scope, not just presentation.
