# TradeSafe Production MVP current-state audit

Date: 2026-09-10. Baseline: `6118f7e21c8b4ba9954567d1e863093b75126a18`. Discovery only; no fixes implemented. See [repository baseline](REPOSITORY-BASELINE.md), [user jobs](USER-JOBS.md), [scope](MVP-SCOPE.md), and [discovery report](DISCOVERY-REPORT.md).

## Evidence rules

- **Runtime verified** means executed against the unchanged local application. Public-screen diagnostics used process-only nonfunctional Supabase settings; they do not establish service readiness.
- **Source verified** means the behavior or omission is established by the checked-in implementation, SQL, or a pure-function reproduction. Live deployment may differ.
- **Unknown** means external configuration, real data, or customer requirements are required. No production service was modified, and no authenticated fixture was fabricated.
- Scores are discovery judgments, not certifications. Operational screens were source-audited; their rendered authenticated behavior remains blocked by missing non-production services/accounts.

## Product and architecture map

TradeSafe targets Ontario electrical, plumbing and roofing contractors. The intended job is to document work on a phone and retrieve a professional report later. The implementation is one application with personal accounts and user-owned records. A business name is not a company tenant; crew records are contacts without logins or privileges.

| Surface | Existing behavior | Evidence / limitation |
| --- | --- | --- |
| `/` | Trade marketing, process explanation, $10/report and $99/crew pricing, login CTAs | Rendered desktop/tablet/mobile; subscriptions and certification promises not substantiated |
| `/electrical`, `/plumbing`, `/roofing` | Static trade checklist descriptions, regulations copy, explicitly labeled sample output | Each returned 200 in mobile diagnostic; no real sample PDF download |
| `/auth/login` | Password login, signup, magic-link mode, Google OAuth button | Mode switching and browser required validation work; real delivery/login/provider enablement unknown |
| `/auth/callback` | Code exchange, creates `contractor_profiles`, redirects | Missing-code redirect verified; `error=auth_failed` ignored by login UI |
| `/dashboard` | Business greeting, last 10 reports, count cards, create/view links | Auth check in layout and page; database errors treated as no records; totals count only fetched 10 |
| `/reports` | Linked from dashboard “View all” | Missing route in source and build output; authenticated navigation leads to missing page |
| `/report/new` | Four-step trade/job/checklist/review form, declaration, insert draft | Client-only state; no draft resume; source-only authenticated audit |
| `/report/[id]` | User-owned report read, checklist summary, declaration, print controls | Explicit owner check and RLS intended; no saved PDF artifact or attachments |
| `/settings` | Business/contact/licence fields, plan selector, crew add/remove | Direct Supabase writes; incompatible plan enum; trade free text conflicts with DB enum |
| `POST /api/analyze-photo` | Auth check, multipart image to Anthropic, observations returned | Anonymous request returned 401 in diagnostic; actual model call not exercised |
| `POST /api/checkout` | Auth/owner check, CAD 1,000-cent Stripe checkout | Stripe constructed before auth; anonymous request returns 500 with missing key |
| `POST /api/checkout/verify` | Retrieves Stripe session; paid session updates report to completed | Browser return drives fulfillment; no webhook; anonymous request returns 500 with missing key |

Stack: Next 16.2.1 App Router, React/React DOM 19.2.4, Tailwind 4, mostly JSX/JS. Supabase SSR 0.10.0, Supabase JS 2.101.1, Stripe 22.0.0, Anthropic SDK 0.82.0 are locked. React local state manages forms; server components load reports/dashboard; browser SDK writes settings/reports directly. There is no report service layer, centralized validation, centralized template versioning or domain model. TypeScript strict configuration exists, but its include patterns exclude application `.js`/`.jsx` files and `checkJs` is absent.

Hosting: Vercel intended, actual deployment unverified. PostgreSQL and Supabase Auth intended. Supabase Storage is described in raw architecture but not implemented. Email is delegated to Supabase Auth; delivery, templates and sender setup unknown. No notification service, scheduler, analytics, error capture service, CI, unit/integration/E2E tests or health endpoint exists. Logging consists primarily of framework errors and one raw `console.error` around AI analysis. No Supadata integration exists; CLI MCP login from the preceding task does not connect the app to Supadata.

Assets: one 284,640-byte `tesla-bg.png` and Next/Vercel starter SVGs have no imports found in the current pages. A tracked favicon exists; brand suitability was not verified. External Google Fonts load Barlow Condensed and DM Mono. Do not substitute unrelated stock imagery for useful product evidence.

## Classification

### WORKING WELL

- Reproducible lockfile installation and successful production build on unchanged source.
- Distinct public pages for all three supported trades; navigation and mobile menu work in anonymous diagnostic.
- Reusable Supabase client/server adapters; actual server `getUser` checks on dashboard, report read and APIs.
- Owner-scoped RLS policies are present for all private tables; templates limited to authenticated reads. Live installation is not verified.
- Four-step report structure, explicit review step, job snapshot fields and large controls are useful foundations.
- Main branding uses a consistent charcoal/amber palette. Existing print-specific styles can be retained after correctness fixes.

### ACCEPTABLE MVP

- Modular Next.js application with Supabase; no need for a new stack or microservices.
- One operator per business can support a deliberately constrained pilot if Daniel confirms this limitation.
- Pass/fail/not-applicable vocabulary can remain, with an added unanswered state and rules for exceptions.
- Browser printing may remain an interim export option if clearly described and validated on mobile; it is not a stored or cryptographically signed PDF.
- Basic crew contact records can remain if they support report entry and are not sold as shared access.

### NEEDS REFACTOR

- `profiles` versus `contractor_profiles` duplicate identity/licence data. Callback/settings write the latter, form/report read the former. No synchronization exists.
- Checklist content duplicated in SQL seed, marketing data, form and report renderer. Report rendering depends on today's hardcoded labels instead of an immutable version/snapshot.
- A 1,200+ line form component mixes trade definitions, auth, persistence, touch behavior, photos and presentation.
- Direct report writes accept caller-controlled lifecycle/payment fields under current SQL; row ownership alone is insufficient for business rules.
- Error handling, validation, date handling, navigation, status labels and loading feedback vary by route.
- Profile queries repeat across middleware/layout/page; dashboard fetch is bounded but incomplete and counts misleadingly labeled.

### NEEDS REDESIGN

- Primary job should be capture evidence → review exceptions → finalize → retrieve/export. Current payment terminology obscures work state.
- Dashboard needs resume/create/find actions, a real full report list, and distinct query failure versus empty account states.
- Condensed font is used for nearly all operational text; narrow headings, tiny uppercase metadata, low-contrast text and repetitive accent cards weaken readability.
- Dashboard navigation disappears on report/settings pages; active location is not marked. Separate headers and inconsistent logo forms fragment the product.
- Form controls need semantic labels, field grouping, accessible status toggles, inline errors, preserved drafts and a safe exit path.
- Photo upload triggers AI immediately, before evidence retention. Evidence capture should be independent of optional analysis.

### BROKEN

| ID | Severity | Finding and evidence |
| --- | --- | --- |
| B01 | P0 | Baseline GET `/` is HTTP 500 when Supabase config is missing. `lib/supabase/middleware.js:7` constructs client for public and private routes. Build success does not reveal this failure. |
| B02 | P0 | Checklist defaults/fallbacks mark unobserved work as passed. Executed `buildChecklistState` from source: electrical 18/18, plumbing 15/15, roofing 18/18 defaults are pass. Form initialization is also gated on a `profiles` row; new callback users normally receive only `contractor_profiles`, allowing visually passed but sparsely saved checklists. Report renderer treats missing answers as pass again. |
| B03 | P0 | `reports.status='completed'` means paid. Owner `FOR ALL` policy permits changing status/payment metadata; no column restrictions or trusted transition function in schema. This is a verified policy-design defect if deployed as supplied, not a live exploit claim. |
| B04 | P0 | Report content is returned before payment and global print CSS supports browser printing. Blocking only the app print button cannot enforce an export entitlement. |
| B05 | P0 | Report declaration/footer assert compliance even with failed items; `declared` is not checked by renderer and JSON answers have no completeness/schema constraint. Stored record can misrepresent what was actually reviewed. |
| B06 | P0 | Database setup begins `DROP TABLE ... CASCADE`; running documented setup against existing data destroys records. No safe upgrade path exists. |
| B07 | P1 | Settings sends `crew_plan`; DB allows only `per_report`/`monthly`. Selecting advertised crew option makes profile save fail against supplied schema. |
| B08 | P1 | Crew trade accepts free text including blank/title case; DB accepts only lower-case electrical/plumbing/roofing or NULL. Ordinary input can fail insertion. |
| B09 | P1 | `/reports` link has no destination implementation; users cannot browse beyond newest 10. |
| B10 | P1 | OAuth failure redirects with `error=auth_failed`; rendered login shows no error. Payment verification failures are swallowed and no recovery UI appears. |
| B11 | P1 | `npm run lint`: six errors, four warnings. Five errors concern JSX `//` text, one state-in-effect violation; warnings concern fonts, image, effect deps and unused parameter. |

### MISSING

- Password reset/update flow; tested recovery, expiration and logout failure behavior.
- Server-side report validation and finalization rules; saved draft/resume, duplicate-save prevention and correction history.
- Private photo storage, attachment ownership/limits, retention/delete behavior and report inclusion.
- Real PDF artifact generation/signature workflow and durable export delivery as advertised.
- Reliable billing reconciliation/webhook, idempotency, entitlement isolation and subscription implementation.
- Search/filter/pagination; company membership/invitations/roles; true team access.
- Environment example, non-destructive migrations, CI gates, meaningful tests, deployment/rollback/restore runbooks.
- Privacy/terms/support surfaces, content ownership/review process, minimal diagnostic/analytics taxonomy.
- Product error boundaries, coherent missing-record response, dedicated loading/error pages, useful support correlation.

### UNKNOWN / REQUIREMENT NEEDED

- Whether any deployment currently has customers or records; live schema, grants and storage policies may differ from SQL.
- Actual Vercel/Supabase projects, domains, service region, email provider, provider enablement and backup tier.
- Whether first pilot is owner-operated or needs separate staff logins and company ownership of records.
- Final commercial offer: paid per-report, pilot access or actual subscription; tax/refund/support policies are not documented.
- Qualified reviewer for electrical/plumbing/roofing templates and claims; record retention/deletion policy.
- Real field network conditions, phone/browser mix, gloves and first-customer acceptance criteria.

## Scorecard (1 poor; 10 verified and robust)

These scores include uncertainty in readiness, not invented evidence of failure.

| Dimension | Criterion | Score | Reason |
| --- | --- | ---: | --- |
| Product | Purpose clarity | 7 | Clear trade-report job, overstated compliance promise |
| Product | Usefulness | 5 | Useful structure; evidence/export incomplete |
| Product | Workflow coherence | 4 | Form sequence reasonable, payment/work state conflated |
| Product | Time to value | 4 | Repeated identity entry, missing onboarding, no saved draft |
| Product | Onboarding | 2 | Signup drops into empty account; profile mismatch |
| Product | User trust | 2 | Default passes, unsupported certification/signature claims |
| Product | Business readiness | 2 | No reliable paid fulfillment or verified live flow |
| UX | Navigation | 4 | Public links work; missing report list, fragmented app nav |
| UX | Information architecture | 4 | Small route surface, inconsistent task organization |
| UX | Mobile usability | 5 | Public screens fit, large primary controls; private screens not rendered |
| UX | Field usability | 3 | No resume/network resilience; photo loss and dense type |
| UX | Form usability | 4 | Staged form; unsafe defaults and inconsistent validation |
| UX | Cognitive load | 4 | Repeated credential fields, AI panel interrupts checklist |
| UX | Accessibility | 3 | Unassociated labels; low-contrast status controls |
| UX | Empty states | 4 | First-report CTA exists; errors masquerade as empty |
| UX | Error handling | 2 | Hidden callback/payment failures and browser alerts |
| UX | Action feedback | 4 | Spinners/toasts exist; incomplete failure/unsaved states |
| Visual | Hierarchy | 5 | Strong public desktop heading, weak operational hierarchy |
| Visual | Typography | 4 | Condensed throughout; mobile global h1 override |
| Visual | Spacing | 5 | Consistent utilities, excessive public vertical space |
| Visual | Component consistency | 4 | Some shared CSS, duplicated page primitives |
| Visual | Credibility | 4 | Cohesive palette, prototype copy and unsupported claims |
| Visual | Responsive behavior | 5 | Public fit at 390/768/1440, private QA blocked |
| Visual | Brand coherence | 6 | Amber/charcoal retained; icons/logos inconsistent |
| Engineering | Architecture | 5 | Suitable stack; domain logic embedded in UI |
| Engineering | Maintainability | 3 | Large form and duplicated templates |
| Engineering | Duplication | 2 | Multiple template/profile sources |
| Engineering | Coupling | 3 | UI tied to raw DB rows and billing lifecycle |
| Engineering | Type safety | 2 | Main JS/JSX not meaningfully checked by TS configuration |
| Engineering | Error handling | 2 | Unchecked reads, thrown SDK errors, swallowed verification |
| Engineering | Data integrity | 2 | Arbitrary JSON, unsafe defaults, mutable finalized records |
| Engineering | API design | 4 | Small routes with auth checks; weak contracts/idempotency |
| Engineering | State management | 4 | Local state appropriate, unsaved work lost |
| Engineering | Dependency health | 2 | 12 audit entries including critical Next advisory |
| Security | Authentication | 4 | Established provider and getUser; live configuration unknown |
| Security | Authorization | 4 | Owner checks/RLS present; lifecycle writes too broad |
| Security | Role enforcement | 2 | No access roles; crew role is descriptive text only |
| Security | Session handling | 4 | Cookie adapter exists; persistence/expiry/recovery unverified |
| Security | Secret handling | 6 | Ignored env, server secrets; limited scan clean |
| Security | Input validation | 2 | Browser constraints, largely unvalidated JSON/multipart |
| Security | Output encoding | 6 | React text rendering, no raw HTML sink found; AI shape unchecked |
| Security | File handling | 2 | No byte/size validation or controlled retention |
| Security | API exposure | 3 | Auth gates exist; exceptions outside error boundaries |
| Security | Rate limiting | 1 | No application limit on paid AI/checkout routes |
| Security | Tenant isolation | 3 | Personal RLS exists; live policies untested, company isolation absent |
| Security | Sensitive logging | 4 | Raw provider exception logged, no redaction standard |
| Production | Configuration | 2 | Missing service settings, no environment contract |
| Production | Migrations | 1 | Destructive reset SQL only |
| Production | Deployment | 3 | Build works; actual deployment/release controls unknown |
| Production | Logging | 2 | Ad hoc logs, no request correlation |
| Production | Monitoring | 1 | No repository configuration or verified external evidence |
| Production | Backups | 1 | Unknown, no restore evidence; score reflects readiness uncertainty |
| Production | Error reporting | 1 | No capture/recovery framework |
| Production | Testing | 1 | No existing automated suite |
| Production | CI | 1 | No workflow |
| Production | Operational documentation | 1 | Starter README, no service/deploy/restore instructions |

## Security review: confirmed design concerns and limits

1. **Untrusted post-login destination.** `app/auth/login/page.jsx` takes `redirect` directly from search parameters and assigns it to `window.location.href` after password login. External destinations are not constrained. Callback also concatenates origin with unsanitized redirect. Fix with a shared relative-path allowlist and consistent URL construction. Not tested with a real login or external destination.
2. **Mutable payment/finalization truth.** Current RLS protects row ownership but not field-level business authority. Isolate server-written entitlements and finalization transitions; test direct Data API calls as well as app APIs. [Supabase explains the distinction between row and column access](https://supabase.com/docs/guides/database/postgres/column-level-security).
3. **Unbounded paid AI input.** Authentication exists, but no server-side size limit, byte signature validation, image dimension limit or application quota exists. The handler buffers the entire file before checking the declared MIME prefix. No schema validation enforces an array of bounded strings in model output. Actual abuse or cloud limit configuration is not verified.
4. **Dependency findings.** npm reports Next 16.2.1 affected, with 16.3.4 offered as a non-major fix at audit time. Vendor August release patched issues in 16.3.3. The Windows critical advisory requires both routers; this repository has only App Router, so that precondition was not established. The AVIF issue requires attacker-controlled images reaching optimization, which was not demonstrated. App Router middleware-bypass advisories merit priority even though data reads also have auth/RLS defenses. [Vendor security release](https://nextjs.org/blog/august-2026-security-release).
5. **Disclosure/error handling.** Raw database errors are surfaced in report submission; provider errors logged wholesale; malformed JSON/SDK failures lack consistent catches. No evidence of leaked credentials was found.
6. **Destructive setup and unrestricted own-record changes.** DB schema permits owner deletes/edits of report evidence including declared/completed values. There is no immutable completion snapshot or edit history. Account deletion cascades data deletion. Retention implications require a policy before production migration design.

No confirmed SQL injection, arbitrary cross-account read, service-role exposure, or raw HTML XSS sink was found in source. That is not a penetration-test result. Live RLS/grants, CSRF defenses, cookie attributes, production headers, CORS, HTTPS, auth provider settings and access revocation remain to be exercised on an isolated environment. Do not treat private pages redirecting as proof of data isolation.

## Data model audit

| Entity | Ownership / purpose | Constraints and lifecycle | Important issue |
| --- | --- | --- | --- |
| `auth.users` | Supabase identity | External schema/config unverified | Account lifecycle cascades all attached rows |
| `profiles` | PK user id; identity/licences for report prefill | FK cascade; business name default empty; created timestamp; own select/update/insert | No current application writer; duplicates contractor profile |
| `contractor_profiles` | PK user_id; business, contact, credentials, plan | FK cascade; plan enum; created/updated trigger; own select/update/insert | Settings and callback use this; plan not a payment entitlement |
| `crew_members` | User-owned contact roster | UUID PK; user FK cascade; name NOT NULL; free role; trade enum; creation time; own all | No member identity, invitations, report relation or tenant permission; missing `(user_id, created_at)` index |
| `checklist_templates` | Global published items | UUID PK; trade enum; category/label/sort/required/reference; authenticated read | Unused by form/render, no version/publishing workflow, no natural uniqueness |
| `reports` | User-owned job evidence snapshot | UUID PK; FK cascade; trade/status enums; job/client/date; JSONB; declared; Stripe id; timestamps | JSON default array vs actual object; no shape/version, finalization/payment integrity, Stripe uniqueness, owner/date index or idempotency key |

NOT NULL text does not prevent empty/whitespace values. Optional fields should be trade/context-specific. No company FK, report-to-crew relationship or attachment entity exists. There is no N+1 report query loop in dashboard; repeated profile/auth queries are the more immediate inefficiency. Do not introduce soft deletion everywhere: decide archival, completion immutability and legal retention first. Migrate additive fields, backfill with a documented conflict policy, validate, then retire duplicate data only after inspection and backup.

## Core workflow audit

| Workflow | Current entry and success | Failure / empty state | Required next behavior |
| --- | --- | --- | --- |
| Sign in / first use | Login → callback → dashboard | Basic errors for SDK-returned failures; callback failures silent; no recovery | Verified chosen auth methods, allowed redirect, clear failure/recovery, concise business setup |
| Configure business | Settings → direct upsert → toast | Profile read errors ignored; plan can invalidate whole save | One canonical profile; optional fields; accessible validation and saved confirmation |
| Capture report | New → trade → job → checklist → declaration → insert | In-memory work disappears on reload; missing answers look passed; raw errors | Persist/resume draft, explicit answers, safe retries, reviewed exceptions and truthful declaration |
| Capture photos | Select photo → provider request → local observations | UI disappears/unmounts; no retention | Private evidence upload independent of optional AI, progress/retry/delete and report association |
| Retrieve/export | Dashboard last 10 → report → pay/print | Missing all-reports route; failed billing return disappears | Full searchable list; immutable finalized view/export; explicit billing state, recovery |
| Crew roster | Settings add/remove | No confirmation on remove; enum validation fails | Retain contact meaning, constrain trade selection, confirm removal; no implied team access |

No workflow telemetry exists. Proposed events: `onboarding_completed`, `report_draft_created`, `report_draft_resumed`, `report_finalized`, `report_exported`, `checkout_started`, `payment_confirmed`, `workflow_failed`; use opaque IDs/error codes and exclude names, addresses, photos, notes, credentials and payment details. Company events only if actual membership is selected. Full taxonomy belongs to implementation.

## Runtime evidence and QA limits

| Check | Result |
| --- | --- |
| Unconfigured application `/` | HTTP 500 missing Supabase URL/key, confirmed in browser |
| Public diagnostic `/` at 1440×1000, 390×900, 768×900 | Rendered, screenshots inspected; no document horizontal overflow |
| Typography | h1 computed 104 px desktop; 32 px at both 390 and 768 due to global `!important` rule |
| Mobile menu → Get Started | Menu opens and navigation reaches login after route settles |
| Three trade routes at 390 px | HTTP 200, no measured document overflow; roofing full-page screenshot inspected |
| Login at 390×844 | Fits viewport; email/password each have zero associated labels; required-empty submission blocked by native browser validation |
| Signup / password / magic-link mode switching | Visible headings/buttons change correctly |
| Anonymous dashboard/new/settings/report id | Each responds 307 to login with relative redirect query |
| Anonymous photo API | 401 in diagnostic |
| Anonymous checkout and verify APIs | 500 because missing Stripe key is evaluated before auth |
| Callback without code | 307 to login with auth_failed; rendered error text count zero |
| Checklist pure function | 18 electrical, 15 plumbing, 18 roofing answers all default to pass |
| Contrast from explicit CSS tokens | White on success green 2.28:1; white on danger red 3.76:1. Both below 4.5:1 for small status text. Gray600 on #0f0f0f about 2.54:1. Not a full WCAG conformance audit. |

Not run: real signup/email/OAuth/login/logout/expiry/recovery, report create/edit/finalize/export, authenticated dashboard/settings rendering, billing charge/webhook/retry, AI model call, authenticated/anonymous/cross-owner database and storage isolation, customer-role matrix, populated-account search, mobile print dialog/PDF output, slow/offline authenticated flows, restore drill. These require an isolated configured environment and safe test identities. No production customer writes or real charges attempted.

Build timings are compilation measurements, not user performance. Public developer-server first GET compiled/rendered in approximately 665 ms with diagnostic settings; this is not production latency or a Core Web Vitals baseline. No authenticated query latency, production bundle transfer baseline, Lighthouse score or field-network performance claim is justified.

## Dependency disposition

- Keep Next/React/Tailwind/Supabase. Patch affected dependencies with tests; do not run audit fix --force.
- Keep Stripe only for the confirmed paid offer; isolate its domain from report completion.
- Anthropic SDK currently powers one optional photo feature. Its advisory concerns a filesystem memory tool not used here; package match confirmed, that exploit path not established. Defer customer-facing AI until privacy, limits and reviewed output are defined.
- Audit includes tooling/transitives `@babel/core`, `@humanfs/node`, `baseline-browser-mapping`, `brace-expansion`, `browserslist`, `js-yaml`, `nanoid`, `postcss`, `sharp`, `ws`, plus Next and Anthropic. npm counts affected packages rather than unique exploitable application vulnerabilities.
- No direct dependency was conclusively unused. TypeScript/types are tooling, but current configuration gives weak application coverage. Starter assets are candidates for removal after brand/asset checks.

## Trust, privacy and operational gates

Current data includes account email, business/contact details, licence/certificate/insurance identifiers, crew names, job address, homeowner/client name, supervising person, work date, answers and notes. Photos are sent through the server to Anthropic; no first-party persistent photo storage exists. Stripe receives job address in checkout description. Google Fonts introduces external browser requests. Minimize optional identity fields and do not send job addresses to billing if not needed.

No retention period, deletion/export process, processing-region policy or subprocessor disclosure is established. No legal compliance certification is claimed by this audit. Marketing references to Ontario College of Trades are stale: the official successor states that it replaced the former body. This is one verified content defect, not a comprehensive legal review of all checklists. [Official trades information](https://www.skilledtradesontario.ca/about-trades/trades-information/).

Before controlled customer use: safe migrations and actual backup/restore evidence; isolated service setup; reviewed templates and truthful report language; completed P0 workflow tests; server-side data/payment integrity and cross-owner checks; dependency remediation; onboarding/support/privacy surfaces; release/rollback instructions and monitoring. If separate staff logins are required, tenant membership and isolation become an additional P0 gate.
