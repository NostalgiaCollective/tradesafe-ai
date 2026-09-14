# Password recovery implementation and verification

**Current status: actual email delivery and recovery PASS.** Resend SMTP and the prepared template are configured only in tradesafe-staging. Three authorized messages were received; expired-link rejection and successful independent-context desktop/mobile recovery passed. A confirmed same-tab link-reopening defect was fixed. See the [delivered-email verification report](staging/RECOVERY-EMAIL-VERIFICATION.md) for exact results, preserved failures, effective configuration, provenance and remaining device/production limitations.

## Historical implementation report — before SMTP setup

The blocked setup statements and provider limits below describe the earlier implementation checkpoint. The delivered-email report above supersedes them; earlier diagnostic results remain preserved.

2026-09-14 email-preparation update: the user has now authorized one Gmail recipient. The connected Gmail inbox matches that recipient and is usable for receipt checks, but supplies no SMTP credential. No usable SMTP credential/provider connection was found in authorized local configuration or current browser/service access. A dedicated staging account is prepared, with worker access to existing synthetic report/photo/PDF fixtures; no email has been sent. The exact recipient and credentials are kept in ignored configuration. See [the bounded Resend setup](staging/RECOVERY-EMAIL-SETUP.md); this update supersedes earlier missing-recipient statements below. SMTP/template configuration and actual delivered-email verification remain blocked.

Implemented from `fda1b40bff0af3c59c04aa009bd3cb09603e8b88` on `astra/production-mvp`. **Implementation and automated/provider-assisted diagnostics pass; actual email delivery is BLOCKED.** No recovery email has been sent. Only verified tradesafe-staging `yqkiizimbtlygovkscoh` was changed. Original project `flhsdtshwwuddzyguyhf`, checkout, billing and design remain unchanged.

## Authorization and browser behavior

The existing SSR cookie/PKCE sign-in callback is preserved. Recovery uses installed `@supabase/supabase-js` 2.101.1: `resetPasswordForEmail`, a separate ordinary client calling `verifyOtp({token_hash,type:'recovery'})`, and `updateUser({password})`. These are provider operations, not administrative password replacement. See the official [password flow](https://supabase.com/docs/guides/auth/passwords) and [email template guidance](https://supabase.com/docs/guides/auth/auth-email-templates).

The prepared template sends the token hash in `/auth/recovery#token_hash=…`. The fragment does not reach HTTP URL logs. The page removes it from browser history immediately and keeps it only in memory, with no analytics or screenshots. An explicit Continue button consumes the token; a mail scanner's GET does not. Refresh before verification requires reopening the original email. No token-bearing URL is logged or committed.

GET `/api/auth/recovery` creates a 256-bit random Secure/HttpOnly/SameSite=Strict `__Host-ts-recovery` cookie. It is an opaque locator, not authorization. Only successful provider recovery verification plus `getUser` creates the corresponding 15-minute database grant. Its provider session is AES-256-GCM encrypted using a domain-separated key derived from the server secret; the cookie, database grant ID and password retry digest are also domain-separated. Ordinary clients cannot read or mutate grants or call privileged grant functions. Normal login cookies, recovery flags, user IDs, destination parameters and generic callback sessions cannot create recovery authority.

The verified account email is shown before the update. Any different account already signed into that browser remains separate: recovery never copies its session or replaces ordinary cookies. A fresh link can explicitly start a new recovery context. The old context expires independently. Completed grants are one-use and clear stored provider session material.

The flow has no requesting-browser PKCE verifier dependency. Independent desktop and mobile-emulated Chromium contexts successfully opened administrator-assisted links and changed the dedicated account's password. **This proves the fragment/provider flow across browser contexts, not delivered-email or physical-device support.** Current staging is `https://localhost:3000`; a physical second device cannot reach this computer through its own localhost. Actual email-client behavior and a reachable approved HTTPS origin must be verified before claiming physical cross-device support.

## Password updates and session policy

Current staging provider policy was inspected: minimum 6 characters, no required character classes, secure-password-change and current-password-required switches off, email OTP lifetime 3600 seconds. These settings were not changed. The form/server enforce that minimum, matching confirmation, and an application cap of 72 UTF-8 bytes; the provider remains authoritative for rejection. Longer unique passwords are recommended. Before changing provider policy, update and verify the form/server rules. See [Supabase password security](https://supabase.com/docs/guides/auth/password-security).

Durable grant states are `verified → updating → changed → complete`, with a 90-second lease, attempt UUID and HMAC of the exact requested password. Concurrent or different-password retries fail explicitly. If a request may have committed remotely, a resumed attempt first proves the same password with ordinary provider sign-in for the verified user; no plaintext password is stored. Definitive initial weak/unchanged-password rejection returns the grant to verified. Uncertain failures leave a visible retry state. Refresh can recover committed success after a lost HTTP response. A failed verification response before grant persistence may consume the email token; request a new link if status remains unverified.

Completion requires provider global sign-out and durable completion acknowledgement. Users then sign in again. All refresh sessions for the recovered identity are revoked; sessions of a different account are not targeted. **Already-issued access JWTs can remain usable until expiry, particularly through direct Data API access.** This is the provider's documented [sign-out limitation](https://supabase.com/docs/reference/javascript/auth-signout). Staging diagnostics observed `refresh_token_not_found`, immediate rejection by Auth `getUser`, and **HTTP 200 with the old JWT through Data API**. The UI does not promise immediate universal revocation. No JWT-lifetime/provider session setting was changed.

## Redirect and abuse controls

The recovery flow uses only the exact configured HTTPS application origin and fixed `/auth/recovery` and `/auth/login` paths. It accepts no return destination. Mutation requests require exact Origin, JSON content type and the expected field set; query strings are rejected. External/protocol-relative/encoded/backslash/double-encoded destinations and callback/payment destinations were tested. Bodies are limited to 4096 bytes. Responses are private/no-store; the recovery page has no-referrer and noindex headers.

Postgres serializes throttle decisions across all instances, without trusting spoofable forwarding headers or process memory. Per fixed one-hour window: 20 request dispatches globally, 3 per address with a 60-second cooldown; separately 60 token-verification attempts globally and 6 per recovery browser. HMAC subjects map to 4096 fixed slots per operation, bounding counters at 8194 rows without deleting records. Rare collisions conservatively share a quota. Global limits can be exhausted by an attacker; edge controls/CAPTCHA and volume tuning remain production work. Direct Supabase Auth bypasses the application endpoint and remains governed by provider controls.

Observed staging provider limits: 2 emails/hour, verification 30/5 minutes, sign-in/sign-up 30/5 minutes and refresh 150/5 minutes. Supabase also documents recovery resend cooldowns and provider limits in its [rate-limit reference](https://supabase.com/docs/guides/auth/rate-limits). These were inspected, not increased. No new paid service was configured.

When enabled, a valid request returns the same HTTP 202 generic conditional confirmation for an unknown account, throttled/suppressed recipient, provider rejection and ambiguous network failure. It never claims email receipt or guaranteed dispatch. Account-specific errors are not returned. Request timing can still differ, and the provider has its own observable behavior. Global missing configuration/DB availability failures return a truthful generic 503. The disabled button is only UX; shared server controls enforce the limits.

## Email setup still required

The Dashboard confirms custom SMTP is absent and template editing requires it. No authorized recovery recipient, SMTP credential or inbox-capture credential exists in the task's saved configuration. The default provider's best-effort sending service is limited and restricted; see [SMTP configuration](https://supabase.com/docs/guides/auth/auth-smtp). An organization login address is not assumed authorized for testing.

To finish this bounded task:

1. Supply an explicitly authorized test recipient and access to its inbox/capture service, plus an existing no-cost SMTP service or its credentials. Store secrets only in ignored local configuration or provider secret settings. Do not put credentials in chat or Git.
2. Configure custom SMTP in **tradesafe-staging only** and install `supabase/templates/recovery.html`. Keep Site URL exactly `https://localhost:3000` for same-computer testing; add only `https://localhost:3000/auth/recovery` to the provider redirect allowlist, preserving `/auth/callback`. No wildcard or production DNS change is needed.
3. In ignored `.staging/server.env`, set `RECOVERY_EMAIL_ENABLED=yes` and `RECOVERY_ALLOWED_EMAILS` to the exact authorized recipient(s), comma-separated. Restart only the existing staging launcher after checking its process/port. Until then email dispatch stays disabled. The ordinary shared regression configuration remains unchanged.
4. Use a dedicated recovery identity for that recipient. Request and receive an actual email, open its delivered link in an independent browser, change the password, prove old/new password behavior and session policy, and check company/report/photo/PDF access. Test delivered expired/reused/tampered links, duplicate/interrupted requests and provider throttles/failures. Preserve sanitized failed-run evidence. Do not substitute administrator-generated links for delivery evidence.

Server deployment requires the existing server-only Supabase credential, a canonical HTTPS origin, and this migration. Missing setup fails closed. Rotating the server key invalidates outstanding recovery envelopes/digests; users must request new links. Completed session ciphertext is cleared; expired incomplete grants remain encrypted pending an approved retention/cleanup policy.

## Applied migration and actual results

The five prior file hashes matched the Phase 3 journal. Before recovery SQL: 15 RLS public tables, 3 templates, 54 evidence rows, 11 exports, both immutable snapshot columns, private buckets and cleanup guard present; no recovery tables and no CLI history.

`20260914000200_password_recovery.sql` applied once through staging SQL Editor on 2026-09-14. SHA256: **`6ce9dada314ce60f0c2b650ef3704f3359b7f69cf8f1484cfb587734ff7d712e`**. Postchecks confirm RLS and service-only functions, with ordinary grant/counter reads and RPC bypasses denied. No old migration was replayed. CLI history is still absent: do not `db push` blindly. Existing evidence/export counts remain unchanged.

| Verification | Actual result and provenance |
| --- | --- |
| Recovery/provider/browser diagnostics | 7/7 groups PASS, 2026-09-14 14:16–14:52 UTC, working tree based on `fda1b40`; administrator-assisted links, **zero emails** |
| Session/throttle follow-up | 2/2 PASS at 15:19 UTC, same base/dirty tree; independent server clients observe persistent cooldown; old-JWT Data API access recorded honestly |
| Local quality | 35 tests PASS, including targeted auth/membership/evidence/export and new recovery tests; lint/typecheck/build PASS, one existing layout-font warning |
| Production smoke | 30/30 PASS, including recovery pages and fail-closed routes |
| Mocked failures | Provider/network/suppression/rate-limit confirmations identical; update interruption, wrong identity, grant expiry/lease/duplicate completion and ciphertext tampering tested |
| Real email request/receipt/delivered-link flow | **BLOCKED**, no SMTP/template or authorized inbox/recipient; no email sent |
| Real provider-expired delivered link and physical second device | **NOT VERIFIED**; database expiry/local tests and reused/tampered provider diagnostics do not substitute |

Raw sanitized diagnostic evidence is under ignored `test-results/password-recovery/2026-09-14T14-16-27.961Z/diagnostics.json` and `extra-2026-09-14T15-19-05.655Z.json`. Saved dedicated credentials/tokens are in ignored `.staging/password-recovery-diagnostic-private.json`; never print or stage it. Failed browser attempts remain recorded: the harness initially selected Next's route announcer and filled the previous page's email input before navigation completed; corrected selectors/navigation passed. No records were deleted or credentials changed to manufacture a pass. The final request-dispatch extraction was covered by local tests after provider diagnostics; it does not change verified password/session handling. Final delivery SHA/CI are recorded in ignored `.staging/password-recovery-delivery.json` after push.

Remaining production blockers: actual recovery email delivery and reachable-device verification, qualified content review, privacy/retention and support policy, broader abuse controls, backup/restore drill, deployment secret rotation/validation, and billing reconciliation. Checkout remains disabled. **Next bounded action is completing the missing recovery email setup and its live verification**, not starting billing or redesign.
