# Daily Operations UX / Retrieval

## Scope and implementation

This checkpoint reorganizes existing authorized workflows. It adds no migration, role, storage bucket, billing feature, trade, AI capability or external service.

- Dashboard: Start new report, up to three personal drafts with an exact count, outstanding assigned actions for workers or company actions for supervisors/owners, recent finalized reports, and a full-library link. Counts come from company-scoped server queries, not the visible slice.
- `/reports`: primary historical workspace with server-side customer/job-address search, existing trade filters, draft/finalized/amendment filters, recently updated/oldest update/work-date sorting, and 25-row pages. Search values are LIKE-escaped and quoted for PostgREST. RLS and explicit company predicates both remain. Validated return links preserve filters through reports and authentication. Historical records remain reachable.
- Report journey: Job -> Observations -> Review -> Finalize. Photos remain mounted in Observations so navigating steps retains the selected file and caption. Save hooks, revision checks, retry IDs, finalization and PDF semantics are unchanged. Missing-field links remain actionable. Mobile action areas are sticky and touch controls are at least 48px.
- Corrections: an action links directly to its original observation and to a prefilled amendment reason. Permitted correction photos use the existing separate amendment draft and evidence pipeline. Report amendments and their private photo links are visible from action details, clearly identified as report-level evidence rather than automatic action resolution. A worker requests verification; existing supervisor/owner authority closes an action and records actor/time. Original observations and photos/PDFs remain immutable.
- Settings: section navigation, recorded account identity, existing password-recovery link, company profile/trade references, crew and invitations. No unsupported profile editor or billing selector is invented.
- Shared report rows, loading UI and active navigation reduce duplication. Authenticated surfaces use fewer enclosing cards, compact navigation, readable hierarchy and tactile controls; marketing pages are outside scope.

## Verification

- 57 unit/database tests passed, including new library filter, quoted search, and safe return-destination coverage.
- 15 existing real isolated Supabase integration scenarios passed: membership, invitations, RLS, direct-write denial, concurrency, immutable snapshots, amendments and action history.
- Focused local Chromium phone-emulation workflow: eight real-backend checks passed (`.staging/daily-local-d58489.json`), including pagination, punctuation search, company isolation, draft resume, real photo/caption reload, finalization, correction photos, supervisor actor/time and original hash retention.
- Eight existing desktop/phone workflow scenarios passed across the initial run and focused reruns. Two stale feedback assertions were corrected; one transient phone session-loss failure passed on its focused rerun. Two unused-account onboarding scenarios remain separately blocked. Eleven interruption/concurrency checks passed with real persistence and deliberately simulated transport failures (`.staging/interruption-local-fd07fd.json`). Final receipts are recorded in the durable checkpoint.
- Required lint, typecheck, production build and 30 HTTP smoke checks passed. Existing layout font lint warning remains.
- Exact final CI must pass before deployment. Hosted identity, the focused hosted journey and historical hashes must then be verified. Authoritative receipts: `.staging/reliability-workflow-checkpoint.json` (`dailyOperationsPhase`).

## Audit and deployment gate

The previous commit `01afdc20770b4a10e33a17988c1e3f8876bf4f3d` passed workflow `35456998866` attempt 5 after npm's audit service recovered. Its earlier deployment occurred while audit was unresolved; that history is retained. Every future staging deployment requires passing required CI on its exact commit first.

The unchanged `npm audit --audit-level=high` gate now succeeds, while reporting a moderate advisory [GHSA-p7fg-763f-g4gf](https://github.com/advisories/GHSA-p7fg-763f-g4gf) in the Anthropic SDK's local filesystem memory tool. Inspection found no memory-tool import or use in this application; the optional photo analysis route uses the message API and staging disables its key. No forced or blind dependency upgrade was applied. This is a documented residual dependency advisory, not a claim that the dependency is vulnerability-free.

## Boundaries and limitations

Correction evidence uses amendments, not direct uploads into a finalized report or a second evidence store. A worker who is not the original report author must ask an existing authorized author/supervisor/owner to add amendment evidence. Original finding history remains visible after closure. Action lists remain bounded to 200 company actions and recent history/amendments; the UI must identify any truncation.

Chromium phone emulation is separate from physical iPhone/WebKit acceptance. Existing signup-email authorization, isolated restore, qualified content/privacy, operational ownership, capacity/device coverage and billing gates remain open. No offline or closed-browser persistence is promised. Pending onboarding and interrupted-work phone acceptance are preserved.

## Daniel's phone checks (pending)

1. Open Today in the intended company. Resume a draft, change a note, wait for Saved, then return and resume it again.
2. Search the report library by customer/site; apply trade/status/sort, open a result, return and confirm the filters remain. Check the next page if available.
3. Follow Job -> Observations -> Review -> Finalize. Add a recognizable captioned photo in Observations, switch steps, upload, reload and confirm the photo/caption. Resolve a missing-field link, finalize and open PDF.
4. From an assigned action, open the original finding and Add correction evidence. Finalize a separate amendment with a photo; return, add resolution notes and request verification. A supervisor closes it; reload and confirm the actor/time and amendment evidence, with the original finding unchanged.
5. Check Settings shows the correct company, account and permitted crew controls. Do not send password-recovery or invitation email for this acceptance test.
