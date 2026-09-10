# TRADESAFE PRODUCTION MVP DISCOVERY REPORT

2026-09-10 • Discovery checkpoint only • Branch `astra/production-mvp` • Starting commit `6118f7e21c8b4ba9954567d1e863093b75126a18`

**Recommendation: retain the stack and useful workflow, but do not onboard paying customers yet.** The application builds, but report truth, payment integrity, setup, recovery and real-service verification have material gaps. Application code has not been changed. Authenticated runtime discovery is blocked by missing isolated Supabase/Stripe configuration and test identities; the report explicitly separates observed UI, source findings and unknowns.

## 1. CURRENT PRODUCT

TradeSafe is an Ontario electrical, plumbing and roofing documentation app. It offers public trade pages; password/signup/magic-link/Google login UI; business settings and a crew contact list; a four-step report form; report history; a report view with browser printing; $10 CAD Stripe checkout; and optional Anthropic photo observations.

Accounts own their own records. There is no shared company membership, employee login, assignment, approval workflow or access-role system. Photos/AI observations are not persisted in reports. “PDF” currently means browser printing; there is no stored PDF generator or digital signature workflow. Advertised $99 crew subscriptions are not implemented.

## 2. CURRENT STACK

Next.js 16.2.1 App Router, React 19.2.4, Tailwind 4, mostly JS/JSX, Supabase Auth/PostgreSQL with SSR cookie adapters, Stripe and Anthropic. npm lockfile. React local form state plus direct browser database writes and server-rendered reads. Vercel is documented as intended hosting; actual deployment is unverified. No CI, test suite, migration history, error-reporting integration or verified backup configuration.

Baseline: installation succeeded; production build passed; lint failed with six errors/four warnings; npm audit reported 12 affected packages (one critical, seven high, three moderate, one low). Unconfigured local `/` returned HTTP 500. With temporary process-only nonfunctional Supabase settings, public pages/login modes and anonymous route checks could be inspected without touching production services.

## 3. EXISTING STRENGTHS

Preserve the three-trade focus, job/report snapshots, staged authoring and review, readable primary button sizes, charcoal/amber identity, useful print styles, small application footprint and established provider SDKs. Preserve owner checks and RLS as foundations; strengthen business-rule enforcement rather than replace them.

## 4. CRITICAL PRODUCT PROBLEMS

- Unobserved checklist items appear passed: the actual initializer defaults all 51 items to pass, and report rendering treats missing answers as pass.
- Work completion and payment status are the same field. A paid report is not evidence that work was completed correctly.
- Compliance declarations conflict with recorded failures and unreviewed templates. Marketing promises certification, signed PDFs and subscription functionality beyond the implemented behavior.
- No durable in-progress draft/resume, retained photo evidence or full report browsing. “View all” points to missing `/reports`.
- First-use business information is fragmented across incompatible profile paths. The roster does not provide team collaboration.

## 5. CRITICAL TECHNICAL PROBLEMS

Destructive reset SQL; duplicate profile tables; template duplication and no snapshot/version model; client-controlled lifecycle/payment fields; broad unchecked JSON; weak application type coverage; a 1,200+ line form component; missing webhook/idempotent billing fulfillment; inconsistent errors; no automated regression or deployment gates. Selecting Crew Plan sends an enum the schema rejects, and crew trade input similarly conflicts with constraints.

## 6. SECURITY RISKS

Confirmed in supplied implementation: post-login destinations are not constrained; owner RLS permits writes to payment/completion truth; app-button printing is not an entitlement boundary; paid AI input lacks server size limits/quotas and validated output shape; SDK/database failures lack safe consistent handling; reset SQL can destroy records. Live abuse/cross-account compromise was not demonstrated.

The dependency audit flags Next 16.2.1. The vendor's August security release documents fixes in 16.3.3; npm currently offers 16.3.4. Some critical advisory preconditions were not established here (for example, both Pages and App Router for the Windows issue). Patch with regression tests; do not label every audit entry an exploited vulnerability. [Vendor security release](https://nextjs.org/blog/august-2026-security-release).

No recognizable committed credential matches were found in the limited history scan. Actual live RLS/grants, cookie settings, backups and service policies remain unverified.

## 7. UX / DESIGN PROBLEMS

Public screens fit the tested 390, 768 and 1440 widths. The mobile menu and login mode switching work. Login inputs have zero associated labels, callback errors show no explanation, and important secondary text/status colors need contrast fixes. Desktop h1 is 104 px but globally forced to 32 px at both phone and tablet widths. Condensed typography is overused for operational text. Private navigation is fragmented and there are no reliable unsaved/recovery states. Authenticated screens were source-audited but cannot be called visually verified.

## 8. P0 MVP CAPABILITIES

1. Reproducible staging, safe migrations, patched dependencies and real authorization tests.
2. Working chosen auth methods, recovery, profile setup and explicit account ownership.
3. Resumable draft → explicit answers/evidence → reviewed exceptions → immutable finalization/correction record.
4. Private retained photo evidence and accurate mobile/desktop export.
5. Complete searchable report history and action-focused dashboard.
6. Trustworthy payment/entitlement reconciliation if the first pilot is paid.
7. Useful loading/error/empty states, accessible inputs, ordinary network-failure recovery.
8. Reviewed trade content, truthful copy, privacy/support processes, logs, CI and verified deployment/restore procedures.

Shared company accounts and owner/member access become P0 if separate staff logins are needed for the initial pilot. Otherwise constrain the pilot to one named operator per business; never use shared passwords as the substitute.

## 9. DEFERRED CAPABILITIES

Crew subscriptions until validated; AI photo analysis until advisory safeguards and privacy/cost controls exist; GPS, voice, reminders, complex notifications, dispatch, inventory, payroll, enterprise RBAC/SSO, multi-jurisdiction content, elaborate admin tooling and full offline synchronization. Supadata has no established product job here. Retain useful crew contacts without implying access rights.

## 10. RECOMMENDED ARCHITECTURE

Keep a modular Next.js/Supabase application. Introduce small typed report/template/profile/auth/billing modules with shared validation and tested server mutations. Preserve RLS as the database boundary, including direct API access. Separate answer, work and billing states. Snapshot reviewed templates and finalized evidence. Consolidate profile data through additive/backfilled migrations, not table resets. Use private storage and authorized export links; isolate optional AI. Add company/membership tables only if pilot requirements call for shared work.

## 11. REDESIGN DIRECTION

Proposed navigation: **Home** (create/resume/attention), **Reports** (find/filter/retrieve), **Business** (identity/settings), with a prominent **New report** action. Keep `/dashboard`, introduce real `/reports`, preserve `/report/new` and `/report/[id]`; put authenticated pages under one shared shell without gratuitous URL churn.

Use practical charcoal/amber branding, a more readable body face, deliberate spacing, consistent status labels and 48–64 px primary touch targets. On phones prioritize save state, next action, minimal re-entry and visible exceptions. Photo capture should serve retained evidence before optional AI. No decorative charts or unsupported compliance badges.

## 12. IMPLEMENTATION PLAN

1. Staging/config/dependency baseline, safe migration tooling and CI skeleton.
2. Canonical identity/auth/onboarding; settle account versus company ownership and enforce boundaries.
3. Versioned templates, honest answer states, saved drafts, validation and finalization/corrections.
4. Private evidence persistence and authorized report export.
5. Shared design primitives/navigation, useful dashboard and searchable report list.
6. Idempotent billing/reconciliation if paid pilot; remove unsupported subscription sales surface.
7. Reviewed public copy, support/privacy, observability, E2E/security/mobile QA and restore/release documentation.

Each slice includes data, server rules, UI states, accessibility, telemetry and risk-focused tests. Produce later-phase documentation as those decisions are implemented. Stop after this report until Daniel authorizes implementation.

## 13. RISK LEVEL

| Change | Risk | Main safeguard |
| --- | --- | --- |
| Documentation/public copy | LOW | Review claims with accountable content owner |
| Shared UI/navigation | MEDIUM | Mobile/keyboard/route regression checks |
| Dependency patching | MEDIUM | Supported versions, clean build and E2E |
| Auth/profile consolidation | HIGH | Staging data inventory, additive migration, recovery tests |
| Company model, if required | HIGH | Explicit migration ownership and cross-company/removal tests |
| Template/report lifecycle | HIGH | Preserve old snapshots, server validation, immutable finalization |
| Private files/export | HIGH | Ownership, upload bounds, link expiration and retry tests |
| Billing | HIGH | Stripe test-mode webhook/replay/abandonment tests, isolated entitlement |
| CI/observability/release setup | MEDIUM | Redaction, environment separation, verified rollback/restore |

## 14. ESTIMATED CHANGE SURFACE

Most of the small application's functional areas will change, but not its stack: `app/auth`, `lib/supabase`, `middleware.js`/future `proxy.ts`, `supabase/schema.sql` plus new safe migrations, report routes/form/export, billing/photo APIs, dashboard/settings, shared components, global styles and marketing copy. Add domain validation/services, storage handling, tests, CI, environment example and operations docs. Preserve URLs and existing data through migrations. This is substantial product work, not a stylesheet patch; no defensible calendar estimate until data and pilot scope are known.

## 15. QUESTIONS REQUIRING DANIEL

1. Do the first pilot businesses need **separate staff logins sharing company reports**, or is **one named operator per business** acceptable initially?
2. Is anything already deployed or holding real customer records? Identify the existing deployment and which **isolated Supabase/Stripe test environment** we should use. Provide credentials through local environment configuration, not chat.
3. Should the first pilot charge **$10 CAD per report**, or operate as a controlled unpaid trial while workflows are validated?
4. Who will approve Ontario trade checklist content and the statements made on reports before customers rely on them?

See [full audit](PRODUCTION-MVP-AUDIT.md), [scope classification](MVP-SCOPE.md), [user jobs](USER-JOBS.md) and [integrity baseline](REPOSITORY-BASELINE.md) for the evidence, scorecard and test limits. **Production use remains blocked; this checkpoint is ready for discovery review, not launch.**
