# Mobile worksite usability

The existing site page now puts **Report a concern**, **Site actions** and authoritative follow-up counts directly below site identity. **On this site** links move keyboard focus to saved work, briefs, reports, concerns or the dated handover. Controls wrap at narrow widths and keep at least44px touch targets; no fixed overlay obscures forms.

**Continue saved work** brings editable brief/report drafts and the signed-in reporter's concern drafts ahead of recorded history. Each loaded record appears once. Existing server-filtered queries and author/role checks determine visibility and labels; a readable draft that cannot be edited is labelled **View brief draft** or **View report draft**, never Resume. Existing50-linked-record and20-concern bounds remain explicit; these are not whole-site draft totals. No draft is created, copied or silently submitted by these navigation controls.

Daily handover remains available from the section link, with the same date/timezone selection, snapshot/export, retry and return-position behavior. It follows routine site work so a worker need not scroll through historical acknowledgements and export controls to capture a concern. Concern visibility explanations remain under **Who can see a concern?**. Current safety-content warnings and historical snapshots remain unchanged.

## Observed friction

On the served6535fbb phone layout (390×844), **Report a concern** began at2111px and **Site actions** at3008px. Editable drafts were interleaved with history beneath the full handover. The page offered no direct section navigation. Before/after screenshots and executed receipts belong in `test-results/mobile-worksite/` and `.staging/mobile-worksite-delivery.md`.

## Hosting and verification boundaries

Render runs the existing Node/Next server and Supabase supplies authentication, database and private storage. There is no Vercel runtime dependency in application code, package dependencies or CI. `vercel.json` deliberately suppresses automatic deployment of only `astra/production-mvp`; leave it intact. Old Vercel references in discovery documents describe historical intentions, not a required service. No credit card, billing, paid service, hosting migration, environment/auth/storage change or domain setup is required for this pass. `tradesafeapp.ca` and external signup-email verification stay deferred.

Focused tests extend the existing site, concern and handover fixtures: real draft resume/persistence, no duplicate links, supervisor inability to see worker concern drafts,320/390px layout, touch size and keyboard anchor focus. Both required exact-commit CI jobs precede Render deployment. Local WebKit, hosted Chromium, injected network faults and physical phone acceptance are separate evidence. No schema change is needed. Existing release gates stay open.

## Security audit follow-up — September30,2026

Today's audit newly reported Next16.3.4 and transitive brace-expansion1.1.18/5.0.9. Maintainer advisories verified on September30:

- [GHSA-vcvr-r3jv-pc5j / CVE-2026-94545](https://github.com/vercel/next.js/security/advisories/GHSA-vcvr-r3jv-pc5j) affects Node ImageResponse with attacker-controlled SVG data; fixed in16.3.6. Repository search found no next/og, ImageResponse or dynamic OpenGraph-image usage, but unused feature reachability alone is not remediation. Next and its matching lint configuration are explicitly patched to16.3.6, the minimum fixed version, with their matching internal packages.
- brace-expansion [GHSA-q2hr-2g5m-vwhr](https://github.com/juliangruber/brace-expansion/security/advisories/GHSA-q2hr-2g5m-vwhr), [GHSA-qhr7-859c-m2p7](https://github.com/juliangruber/brace-expansion/security/advisories/GHSA-qhr7-859c-m2p7) and [GHSA-6j4f-fj2g-mc7p](https://github.com/juliangruber/brace-expansion/security/advisories/GHSA-6j4f-fj2g-mc7p) concern untrusted pattern expansion and denial of service. Here they are transitive lint/tooling dependencies through minimatch, not an application request feature. Targeted lockfile updates retain compatible major versions1.1.21 and5.0.12.

No force upgrade, audit exception, threshold reduction or unrelated package update. The local post-patch audit reports zero vulnerabilities; full exact-commit CI and hosted verification remain required. Next's open-source maintainer organization is Vercel; installing its security patch does not use Vercel hosting or create a service dependency.
