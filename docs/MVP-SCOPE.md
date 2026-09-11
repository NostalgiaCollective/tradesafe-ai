# TradeSafe Production MVP v1 scope proposal

Discovery baseline dated 2026-09-10. The original classifications below are retained for comparison; the following authorized Phase 2 update takes precedence.

## Authorized Phase 2 update — 2026-09-11

Daniel confirmed Ontario trade companies with separately authenticated staff and shared records. Company ownership, owner/supervisor/worker permissions, invitations/removal, versioned truthful observations, durable drafts, immutable finalization/amendments and minimum corrective actions are now required and implemented locally. See PHASE-2-IMPLEMENTATION.md for evidence and blocked live-service checks. Local implementation does not establish release readiness.

Current answer states are unanswered, meets, attention, not_applicable and unable. Report lifecycle, corrective-action state and historical billing information are separate. Roles establish application access only; shared passwords are never the company model.

Retained photos and generated PDFs are explicitly deferred until secure storage is ready. Browser print remains available with truthful snapshot wording. Checkout is disabled pending trusted reconciliation. Full offline synchronization, subscription plans, automated invitation email and enterprise roles are outside this phase. Checklist content remains pending qualified review.

P0 = required before controlled customer use. P1 = high value after the baseline. P2 = later, subject to evidence. REMOVE / DEFER = stop presenting as delivered or avoid introducing complexity. Existing useful behavior should remain until its replacement passes regression checks.

## Capability classification

| Capability | Current state | Priority / decision | Acceptance gate or rationale |
| --- | --- | --- | --- |
| Three supported trades | Present, duplicated content | P0 retain | Shared versioned definitions with independently reviewed applicability |
| Truthful positioning and report language | Overstates compliance/certification | P0 fix | Record observations and declaration without implying official approval or automatic legal compliance |
| Marketing and trade pages | Render, useful navigation | P0 correct claims; visual polish P1 | Present only available workflow and pricing; retain trade discoverability |
| Supported account sign-in/signup | Password, magic, Google code exists | P0 verify/harden | Pick enabled methods from actual provider configuration; successful and failed callbacks, allowlisted redirects, session persistence and logout tested |
| Password recovery | Missing | P0 if password auth retained | Request/redeem reset; expiry/invalid token; useful feedback |
| Business profile/onboarding | Split tables, no coherent first use | P0 | One source of identity, minimal required data, prefill verified end to end |
| Individual ownership | SQL owner RLS exists | P0 | Anonymous and second-user reads/writes/guessed IDs denied in app and Data API |
| Shared company accounts | Not implemented | Conditional P0 | Required if pilot staff need separate logins to shared records; otherwise explicitly deferred, never simulated with password sharing |
| Owner/member roles and invitations | Missing | Conditional P0 with company model | Enforced server-side/RLS; scoped invitations, removal and revoked access verified. No additional roles without a user job |
| Draft save/resume | No durable draft before final submit | P0 | Draft survives refresh/ordinary connection failure, retry cannot duplicate record, auth expiry preserves recoverable work safely |
| Trade/job form | Present | P0 improve | Accessible fields, client/server validation, local work-date semantics, trade-relevant optional fields, no loss on error |
| Checklist answers | Pass by default | P0 | Unanswered is explicit; no missing answer becomes pass; invalid JSON/states rejected server-side |
| Review and finalize | Compliance declaration plus insert | P0 | Exceptions visible, accurate attestation, final snapshot with actor/time/template version; no arbitrary rewrite after completion |
| Minimal correction history | Missing | P0 | Final records remain attributable; corrections preserve original evidence. Avoid enterprise approval workflow |
| Private photo evidence | Preview and external AI only | P0 proposed from raw intent | Owner-scoped storage and report association; byte/type/size limits, upload retry/delete, no public customer-photo URLs; include in export |
| Photo thumbnails/compression | Missing | P1 unless necessary for usable uploads | Measure real phone uploads; do not degrade evidentiary originals without policy |
| Report view/export | HTML print only | P0 | Accurate complete output on target phones/desktops, authorization and any paid entitlement enforced at actual export, no misleading signature claims |
| Stored/generated PDFs | Missing | P0 proposed to meet existing promise | Server-generated artifact or explicitly approved interim print workflow; deterministic reviewed snapshot; signed access links if stored |
| Dashboard | Last 10 plus misleading totals | P0 | Create/resume/find actions; real counts or honest labels; loading/query-error/empty states |
| Search/filter/sort/pagination | Missing list route | P0 basic | Find records by job/date/trade/status beyond first 10; clear reset and URL state; no query-builder UI |
| $10 CAD checkout | Partial | P0 if charging pilot | Verified webhook/reconciliation, idempotency, server-written entitlement; separate payment status from report state; retry/abandonment support |
| $99 crew subscription | Advertised, no implementation | REMOVE / DEFER to P1 | Do not sell until plan semantics, membership model and billing verified; existing selector currently sends invalid enum |
| Crew contacts | Add/remove exists | Retain, P1 expansion | Fix enum and destructive confirmation if kept visible; no new crew subsystem or team-access claims |
| Photo AI observations | Present but ephemeral and unvalidated | DEFER customer exposure to P1 | Optional, explicit consent/context, bounded input/output/cost, advisory language, human editing; not needed to create valid evidence |
| Supadata integration | None | DEFER | No supported product job; MCP login is unrelated |
| GPS, voice notes | Raw intent/future mentions, no implementation | P2 | Require demonstrated benefit, consent and retention decisions |
| Automated reminders/notifications | Raw future intent only | P2 | No scheduler/channel required for core reports |
| Transactional auth email | Provider integration | P0 verify | Sender/link/domain/delivery confirmed in isolated environment; no marketing messages mixed in |
| In-app report email/share service | No backend | P1 | Download/device sharing can serve early recipients; avoid new mail infrastructure until needed |
| Privacy/support/terms | Missing | P0 launch content/config | Accurate data-use/support/deletion information reviewed by business owner; no invented compliance guarantee |
| Self-service account deletion | Missing | P1 UI; P0 documented process | Define report retention, identity deletion and backups before implementation |
| Structured logs/basic health | Missing | P0 | Redacted errors, stable codes/correlation, dependency-aware diagnostics, no sensitive payloads |
| Minimal analytics taxonomy | Missing | P0 basic events | Useful first-report/failure/retrieval measurements without names/notes/photos; hosted analytics vendor optional |
| Tests and CI | Missing | P0 | Domain tests, real DB/RLS integration, key E2E, lint/type/build and migration checks; secret/dependency checks |
| Dependency remediation | Audit fails | P0 | Supported patched versions with regression; no indiscriminate major upgrades |
| Migrations and schema consolidation | Destructive reset | P0 | Additive/backfill-safe path, conflict handling, separate fresh-install fixture, tested rollback/restore |
| Deployment/env/runbooks | Missing/unverified | P0 | Development/staging/production split, required-secret contract, release gates and verified rollback |
| Backups/recovery | Unknown | P0 | Verify actual service capability; database and object storage separately; perform isolated restore drill |
| Demo/sales environment | None | P0 operational setup | Isolated, resettable synthetic records; no production auth bypass or hardcoded credentials |
| Internal support tooling | None | P0 runbook; P2 admin app | Least-privilege provider access and procedures first, no broad impersonation |
| Full offline sync/PWA | Missing | P2 | P0 requires sensible interruption recovery, not a distributed sync engine |
| Scheduling/dispatch/inventory/payroll | No evidence | DEFER | Outside core documentation job |
| Enterprise RBAC/SSO, microservices/queues | No evidence | DEFER | Not justified for ten early businesses |
| More trades/jurisdictions/custom builders | No evidence beyond extensibility | P2 | Separate reviewed templates and customer demand required |

## Proposed architecture decisions

Keep the existing Next.js App Router, React, Tailwind and Supabase architecture. Use small typed domain modules for templates, reports, profiles, authorization, validation and billing. Server mutations enforce workflow rules; RLS continues to protect direct database access. Moving UI writes behind an API without restricting the Data API would not solve the current integrity defects.

Separate work state (`draft`, `finalized`; exact names to settle with migration design), answer state (`unanswered`, `pass`, `fail`, `not_applicable`), and billing state. Never map a payment to “work compliant.” Version/snapshot templates and completed reports, including observed answers and exceptions. Keep historical labels when migrating; do not silently reinterpret old reports using new content.

Consolidate profiles after inspecting data rather than dropping either table. Add an owner/date index, validated answer payload, idempotency and trusted entitlement records. If company access is confirmed, introduce company + membership + tenant FKs and owner/member permission rules as the first data slice, before moving user-owned records. Ownership transfer can start as a controlled support procedure if not needed in app, but must not orphan records or leave a company ownerless.

## Ordered implementation slices after approval

1. **Safety and executable staging baseline (medium).** Confirm environment/data inventory; patch dependencies; safe migration mechanism; environment validation, error boundaries, initial CI and DB test harness. Exit: repeatable isolated setup and real auth fixtures.
2. **Identity and ownership (high).** Canonical profile, onboarding, supported auth/recovery/redirects; decide tenant branch before migrations. Exit: two-user/cross-owner tests and, if applicable, two-company/member-removal tests.
3. **Report truth and resilient authoring (high).** Shared versioned templates, validated answers, saved draft/resume, finalization/corrections, actor/time and mobile form. Exit: reload/failure/duplicate-save/empty-checklist regression tests; accurate completed record.
4. **Evidence and export (high).** Private photo persistence, bounded uploads and final report artifact. Exit: cross-owner file denial, expired links, partial upload recovery, mobile/desktop export QA.
5. **Retrieval and daily work (medium).** Shared navigation/primitives; action dashboard; full report list/search; account settings; empty/error states. Exit: first use and populated account, keyboard and phone checks.
6. **Billing if pilot is paid (high).** Reconcile trusted events, idempotency and export entitlement, failure/abandonment/retry. Exit: isolated Stripe test-mode evidence, no charge without access, no client-written paid state.
7. **Customer/operational release gate (medium).** Truthful public copy, reviewed content, privacy/support, logs/telemetry, demo environment, deployment/restore docs and final independent-style review. Exit: full P0 E2E/security/mobile checklist with named remaining blockers.

Establish design primitives while building these vertical slices; do not delay data integrity for a standalone visual rewrite. Each slice includes data, server authorization, UI states, telemetry, tests and documentation. Finalization of scope is Daniel's next review; production deployment remains separately unauthorized.
