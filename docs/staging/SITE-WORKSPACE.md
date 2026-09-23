# Returning to a site

Sites connects existing daily briefs, trade reports and Actions. It remains staging-only alongside daily briefs. No safety checklist, qualified approval or notification has been added. Daniel's phone confirmation covers the previous task prompts, source navigation and return/recall only; site-workspace physical acceptance is pending.

## Capabilities and deliberate boundaries

Active company members can create a site with a name, address/location description and optional company instructions. Workers edit their own sites; supervisors/owners can edit all company sites and archive/restore them. Revision checks prevent stale overwrites. Stable request IDs recover interrupted operations without duplicate sites, records or audit entries. Unconfirmed entries remain on the open page; no offline or closed-browser recovery promise is made.

Archiving blocks new briefs, reports and associations from that site. Existing drafts, corrections and action follow-up remain available; history is never deleted. Company membership and record authorship rules are enforced in SQL as well as reflected in the UI.

The overview lists up to 50 recent associations, with paginated site-specific brief/report lists for older work. Follow-up counts are exact database counts over the permitted company/site set and existing statuses. These counts do not establish safety or compliance. Site search/filter parameters remain in the URL; site return position is stored in session storage, scoped to actor/company/site, containing navigation metadata only.

**Start today’s brief** prefills the site's name/location. Deliberate previous-task selection copies only its task description from a same-site brief. Date, jurisdiction confirmation, contact, crew, hazards, controls, attendance, communication, acknowledgements and verification must be established afresh. Existing source-content version handling and draft review status remain unchanged.

**New site report** uses the existing report journey and prefills the job location. **Associate with a site** explicitly connects an existing authorized brief/report. There is no address matching, bulk migration, reassignment or inferred historic provenance. Existing records remain accessible through their original company lists. Later associations are labeled as such and do not modify the original record/export.

## Persistence and historical accuracy

New additive migration `20260922000100_sites.sql` adds RLS-protected sites, immutable associations and private idempotency receipts, a security-invoker site-action view, and nullable report site snapshots. Existing migrations are unchanged. Existing records receive no site association or historical values.

New records capture site name/location/instructions and revision at creation. Brief recording copies that association snapshot into the immutable briefing version. New report snapshots are retained through finalization and rendered in new exports; amendments inherit the original captured site provenance. Later association of an existing report does not rewrite its snapshot or existing PDF. Site edits never update record snapshots, acknowledgements, evidence or export bytes.

Site command transactions lock the company before membership and resource checks. They validate record company/author, site activity, optimistic revisions and same-site task reuse. Idempotency receipts bind request content and actor; changed retries conflict. Ordinary members cannot write sites, associations, receipts or snapshots directly. Existing report/brief/action RPCs retain their original authorizations and persistence behavior.

## Verification record

Focused database tests cover similarly named cross-company sites, explicit linking, role/revocation denial, request replay/conflict, stale edits, archive restrictions, fresh-day resets, site-scoped Actions, immutable brief/export content and original reports/amendments. The real browser fixture covers creation with a simulated lost response after commit, saved navigation/reload, fresh-day reuse, report resume, filtered Actions return, interrupted editing, archive and revoked API denial. The existing CI report/photo/PDF/amendment and brief tests remain required.

Executed results, exact CI SHA, staging identity, one-time migration receipt and screenshots are maintained in `.staging/reliability-workflow-checkpoint.json` and `.staging/site-workspace-delivery.md`. Local WebKit, hosted Chromium, simulated faults and physical acceptance are distinct evidence categories. A test's implementation or discovery is not execution.

No production, private evidence, resource-limit, domain, billing or external-email changes. Qualified content review and other existing release gates remain open.
