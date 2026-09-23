# Crew coordination

The staging dashboard links to **My work**, a company-scoped queue of the signed-in worker's outstanding assigned actions and latest recorded briefing versions awaiting their acknowledgement. **Crew responses**, available to supervisors and owners, shows response counts and responsibilities that need reassignment. Counts come from permission-enforced database queries, with bounded pagination and explicit loading, empty and retry states.

Briefing records show each included participant, their acknowledgement of that exact version and server timestamp, or their missing response. Recorded attendance remains distinct. A draft revision makes acknowledgement unavailable until recorded; a newly recorded version needs a fresh response. Historical acknowledgements remain unchanged. Opening a briefing link does not grant membership. These are items available in the app, not notifications.

Existing assignment controls, optimistic revisions, request deduplication, role restrictions and audit events are reused. Removed assignees are flagged without restoring access. Assignment history now displays the previous and new assignee. Current action creation requires an active assignee; no new nullable-assignment behavior or status was introduced. Assignment never grants supervisor authority.

Additive migration `20260923000100_crew_coordination.sql` adds three read-only security-invoker views over existing records and RLS. It changes no underlying records or command permissions. Apply once to the verified staging project only after both exact-commit CI jobs pass.

Focused database coverage checks version binding, stale acknowledgements, assignment replay and conflict, role and cross-company denial, revoked access, historical snapshots and read-only views. The shared browser fixture executes My work/site return, worker and supervisor counts, stale acknowledgement, response loss after a committed acknowledgement and assignment, retry deduplication, retained conflicting input, reassignment history and reload, and revoked/cross-company denial. CI executes it in local Supabase/WebKit; the hosted runner uses existing synthetic accounts and prepares a separate phone fixture.

Execution receipts, exact CI/deployment identity and hosted screenshots are recorded in the durable checkpoint and `.staging/crew-coordination-delivery.md`. The private phone account file is `.staging/crew-phone-private.json`; it must remain ignored and its credentials must never be printed in delivery reports. Browser test implementation is not evidence of execution.

Daniel's previous phone acceptance covers source navigation. Site workspace and crew coordination phone acceptance remain pending. Qualified content approval, domain/email delivery and existing production release gates are unchanged.
