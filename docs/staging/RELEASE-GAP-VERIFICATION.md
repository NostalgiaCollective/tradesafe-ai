# Release-verification gap closure — 2026-09-16

Recovered local/remote `73e01fe5f3873b4b1186891a0b350637d275a4ab` with no newer work; only preserved `raw/` was untracked. Gated hosted identity matched that commit, branch, origin and isolated project. Existing 49-test/30-smoke/14-hosted-workflow evidence is retained, not rerun to replace blocked checks. Daniel's “This is successful.” remains an overall statement only.

## WebKit: infrastructure block identified

Pinned Playwright uses WebKit 26.6, revision 2359. The supported `playwright install webkit` command completed against the existing workspace installation. Windows Code Integrity events **3033 and 3077**, at **2026-09-16 07:01:45 UTC**, identify `Playwright.exe` attempting to load `icuin77.dll` and being blocked by signing/policy requirements. The recorded launch exit is `0xC0E90002`. This happened before navigation, so it is not a TradeSafe page failure. Installation presence does not overcome enforcement.

No security policy, certificate validation, binary identity or global permission was changed. No repeated blocked launch or relocation/downgrade workaround was attempted. WSL is not installed, and no existing approved local Linux/container alternative was found. Real hosted WebKit workflows remain **blocked and unperformed in this phase**. Historical Windows WebKit upload transport errors are separate evidence, not startup recovery or physical Safari success. Next: an administrator-approved runtime or existing approved macOS/Linux target; install the pinned browser normally, then run real login/draft/photo/PDF and failure-recovery checks against the verified hosted SHA.

References: [Playwright browser installation](https://playwright.dev/docs/browsers), [Microsoft App Control event IDs](https://learn.microsoft.com/en-us/windows/security/application-security/application-control/app-control-for-business/operations/event-id-explanations). Event 3077 is enforcement evidence; do not disable the control to get a pass.

## Fresh signup: independent checks and exact pending test

Read-only provider settings: email/signup enabled, confirmation required, Google disabled. The confirmation template uses `{{ .ConfirmationURL }}` with subject “Confirm your email address”. Site URL is hosted staging; exact hosted and localhost callback/recovery URLs are configured. SMTP is enabled through Resend, with `onboarding@resend.dev` and the existing recovery-oriented sender name. No settings were edited.

Gmail connector profile and a narrow metadata-only search for today's confirmation messages from the test sender succeeded; no matching IDs were returned. This establishes connector access, not delivery or permission to send. No fresh-signup recipient/test authorization was found. Recovery identity remains untouched; recovery emails are not signup proof. Sender restrictions must be satisfied before dispatch; an alias is not assumed permitted or authorized.

`scripts/staging/signup-preflight.mjs` sends **no email**: all browser Auth requests are intercepted. It checks required email/password and length, provider-rejection feedback/input retention, real callback missing/invalid-code rejection and external-redirect containment. A mocked rejection on live `73e01fe` reproduced misleading “Sign-in” wording during signup. The narrow fix names account creation and advises checking inbox/spam before retrying while preserving input and login behavior. The local fixed version passed four groups; final exact-commit hosted results are in the checkpoint. Three login-session regressions, two restore-validator tests, lint and typecheck passed. Mocked failures remain distinct from actual provider/settings/server callback checks.

Reuse prior actual synthetic-provider confirmation, company/report creation and invitation acceptance from `RELIABILITY-WORKFLOW.md`. Generated challenges sent no email and do not prove the delivered confirmation/PKCE flow.

Pending one-email procedure, only after authorization:

1. Record Daniel's authorization for **one signup confirmation email** to a named, unused, controlled address accepted by the sender, plus authorized inbox access. Verify address absence using a read-only exact-match staging Auth inventory. Do not delete/reuse recovery accounts or assume aliases work. Record build/project/origin and sender/redirect settings privately.
2. Save the new synthetic fixture/password privately before submission. Retain the initiating browser context for PKCE. Submit actual Create Account once; journal request/response time and user ID privately. A success message is not delivery. If uncertain, inspect Auth/inbox before any resend.
3. Search only that recipient/sender/time window, including spam. Record receipt ID/time and expected link origin, never the token/link/body in public logs. Open the original link in the intended initiating browser context; observe gate/callback. For physical iPhone testing, leave the link unconsumed for Daniel and record mail app/browser/version. Same-context success does not establish cross-device success.
4. Verify provider-confirmed email, password sign-in and server session. Create a synthetic company **or** accept a manual invitation for that identity; create/save/reload the first draft. Check intended company access and no automatic membership elsewhere. Preserve all fixtures and original records.
5. Check reused-link rejection in an independent context without another email. Record failures, timestamps and provenance. Expired-link delivery and other cross-device contexts require separately authorized cases; do not silently resend. Physical tests remain pending until individually reported.

Exact gap: unused recipient, explicit signup-test dispatch authorization, and evidence the current sender permits it. Inbox access does not close this gap.

## Restore: no executable target exists

Inspected PATH, installed-program directories, Docker/PostgreSQL services, conventional localhost ports 5432/54321/54322/54323, workspace manifests/descriptors and ignored staging configuration. No Docker/Podman, `pg_dump`, `pg_restore`, Supabase CLI, running compatible target, target authorization descriptor, archive manifest or protected independent archive destination was found. `wsl --list --quiet` reports WSL is not installed. No database export credential/service configuration was identified; the Storage service credential is not a PostgreSQL dump credential.

The [restore procedure](BACKUP-RESTORE-DRILL.md) and offline validator remain prepared. Their two focused tests passed, including corrupt/missing artifact rejection and prohibited-target refusal. These are synthetic validator tests, **not restoration**. No archive capture, schema restore, relationship/RLS validation on restored data, restored photo/PDF integrity, restored-application usability, RPO or RTO measurement was performed. PGlite fixtures and staging reads are not substitutes.

Exact prerequisite: already-authorized empty isolated Supabase-compatible destination with outbound email/payment/AI disabled; compatible tooling/database access; protected archive destination with space; source/target identity and quiet-capture inventory. Then execute the procedure once, preserve all source data, and measure results. Never restore to active staging or production.

The [single decision register](RELEASE-DECISIONS.md) records owners, proposals and implications. Production readiness is not established.
