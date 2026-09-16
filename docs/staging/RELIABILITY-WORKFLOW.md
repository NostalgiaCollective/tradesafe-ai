# Backend reliability and workflow usability — 2026-09-16

## Recovery and bounded checklist

Recovered HEAD `e4b4a545a84af0376fbbb11f2d6d7ded0bc24386`; only unrelated `raw/` is untracked. Fresh hosted identity confirms `fc633773f273c4447da7f4031993ff63e3910f2c`, the expected staging branch/project/origin. Prior passing evidence is retained in the photo-limit, Phase 2, Phase 3 and recovery records.

Daniel reports **“This is successful.”** This is an overall user report. It does not separately establish photo size, device/browser, Saved state, thumbnail, caption, reload or PDF results.

- [x] Account workflow: hide unconfigured Google/unverified magic-link entry points; truthful signup/session confirmation; clear create/join/resume actions; validate with synthetic accounts without unauthorized email.
- [x] Recoverable operations: bounded client requests, immediate duplicate guards, stable retries for corrective actions and creation, accessible nearby pending/success/error feedback, preserve unsaved input and immutable evidence.
- [x] Everyday usability: photo shortcut, inline required-field guidance, useful empty states, collapsed optional upload troubleshooting, keyboard/mobile checks.
- [x] Backend admission: enforce shared user/company/global budgets before image/PDF work, bound per-process concurrency, fail closed, return actionable retry guidance, sanitized operation diagnostics. One additive migration only after exact staging inventory and local tests.
- [x] Restore preparation: executable manifest/target validation and verification procedure; execute only with an already-authorized isolated compatible target. Prepare concrete privacy/retention/content-review proposals without activating deletion or publishing content.
- [ ] Delivery: focused real server/browser tests (auth boundaries, interrupted/duplicate operations, session recovery, retained photo/PDF), small commits, exact-commit CI, existing staging deployment and identity verification.

## Confirmed gaps / reuse

Provider settings inspected read-only: email enabled, signup enabled, confirmation required, Google disabled. Existing UI still offers Google and magic links without availability checks. Delivered recovery email evidence is historical and does not authorize a new signup/magic-link dispatch. No new email will be sent in this phase without applicable recipient/test authorization.

Draft saves already retain a request ID/document while retrying; uploads already retain evidence IDs, selection and caption; finalization/export already have database idempotency/leases. Reuse these protections. Corrective-action retries currently create new IDs, general client requests have no timeout, several controls lack synchronous duplicate guards, PDF errors can expose raw transport messages, and upload diagnostics are always expanded. The account without a company loses shell user context on the dashboard.

Existing image limits, private storage, company authorization and PDF leases are retained. Expensive decoding/rendering currently lacks shared admission budgets. Restore plan exists but no authorized isolated target or PostgreSQL/Supabase restore toolchain has been identified; never restore to active staging.

Live progress and exact recovery action: ignored `.staging/reliability-workflow-checkpoint.json`. Production readiness is not claimed.

## Implementation and local verification milestone

The first five checklist items are implemented or prepared; delivered-email verification and the actual restore drill remain blocked as described above. Company/report/amendment creation, invitation acceptance, finalization, uploads, PDF export and corrective actions now have synchronous duplicate guards and nearby feedback. Client waits are bounded, ambiguous failures retain input, and corrective-action retries keep the original request ID. Draft recovery retains its existing idempotency. No offline storage is promised. Google/magic-link entry points default off and require explicit public configuration only after provider/callback/delivery verification.

Uploads and PDF generation now use service-only, shared admission budgets plus per-process concurrency limits. Per ten minutes: uploads 20/user, 30/company, 60/global; PDFs 5/user, 10/company, 20/global. Fixed hash slots cap quota-row growth and may conservatively share a limit on collision. These are staging starting limits, not measured production capacity. Per process, at most two uploads and one PDF execute; multiple processes still share database quotas. Failed admitted attempts consume budget. Existing retained-byte reads remain available. Incoming image streams and server Storage requests time out after 30 seconds; operation logs contain only fixed event/kind/outcome/duration or sanitized error codes. Existing photo/PDF limits and integrity controls are unchanged.

The additive `20260916000100_resource_admission.sql` was applied **once** to verified isolated staging on 2026-09-16 at 06:35:52 UTC. SHA256: `c7255c8c65600ef7a6800a379ad80e3c76af7149750c24378f709f6fffee5728`. RLS, service-only function execution and denied ordinary/service table access were checked. The six historical migrations were not replayed. Do not apply this migration again; recover from the checkpoint and inspect current state.

Local verification: 49 automated tests, typecheck, production build and 30 HTTP smoke checks passed. Lint has zero errors and one pre-existing font warning. Real Chromium mobile-sized application tests against isolated staging passed new provider confirmation without email, company/first-report creation, manual invitation acceptance, interrupted autosave and corrective-action responses with identical retry IDs, expired-session reauthentication in another tab, a real 3–5 MiB photo upload and caption/thumbnail reload, cross-company/photo/PDF denial, finalized-edit denial with a valid document, PDF download, amendment retention and real resource-limit rejection. Original retained PDF bytes still match their hash. Tests preserve their synthetic accounts/reports in ignored journals.

Signup pending/success copy, slow-response duplicate guarding and keyboard switching were separately tested with a fully intercepted provider response: this is **mocked UI evidence**, not delivered-email proof. Actual provider confirmation used a generated synthetic challenge without dispatch. No new emails were sent. No physical-device subresults are inferred. Reuse the prior exact-5-MiB/above-limit and normalization evidence; this phase's unit boundary tests also pass.

Run `node --use-system-ca scripts/staging/reliability-workflow.mjs` for local recovery; on this workstation use automatic approval review for access to existing system certificate trust. Do not disable certificate validation. For hosted verification, set `EXPECTED_COMMIT` to the exact verified deployment SHA and add `--hosted`. The journal resumes completed cases and preserves fixtures. Final CI/deployment/hosted results and exact next action belong in the durable checkpoint; a prior journal pass is not evidence of a new deployed identity.
