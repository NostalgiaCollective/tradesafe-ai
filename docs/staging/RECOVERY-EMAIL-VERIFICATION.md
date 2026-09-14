# Delivered recovery email verification — 2026-09-14

Actual email delivery and recovery are complete in **tradesafe-staging `yqkiizimbtlygovkscoh`**. Three messages were requested through the application, delivered by Resend SMTP, and read in the explicitly authorized Gmail inbox. No administrator-generated link was used in these tests. The original excluded project, six applied migrations, shared regression credentials and retained evidence were preserved. Checkout remains disabled.

## Configuration actually applied

- Resend SMTP: `smtp.resend.com`, implicit TLS port `465`, username `resend`, test sender `onboarding@resend.dev`, sender name `TradeSafe staging recovery`, minimum recipient interval 60 seconds. The sending-only key came from ignored `.staging/recovery-email.env`; it was entered in the masked field, never printed, and the clipboard was replaced immediately afterward. Saved settings were reloaded and checked.
- Installed the exact committed `supabase/templates/recovery.html`, with subject `TradeSafe staging password recovery`; compared the saved template after reload. The delivered messages contained the approved application recovery path with the token in its fragment. No message body, token or recovery URL is included in evidence.
- Site URL remains `https://localhost:3000`; the two exact redirect entries are `/auth/callback` and `/auth/recovery`. No wildcard, production DNS, paid plan or domain setup was added. The test sender is restricted to the Resend account's own email; the dedicated recovery recipient is that explicitly authorized address.
- Enabled `RECOVERY_EMAIL_ENABLED=yes` with the existing exact recipient allowlist in ignored `.staging/server.env`. Restarted only the previously identified staging app. Other services, original browser tabs and private configuration remain intact.
- Supabase automatically changed the email ceiling from 2 to **30/hour** when custom SMTP was enabled; the effective value was inspected. Other observed limits remain verification/sign-in 30 per 5 minutes and refresh 150 per 5 minutes. Application limits remain 20 dispatches globally/hour, 3/address/hour and a 60-second cooldown, enforced in the existing shared database.
- Temporarily set email OTP lifetime to **60 seconds** for the first delivered-link expiry test, then restored **3600 seconds** and verified the saved value before the two successful requests. Password policy and JWT lifetime were unchanged. No migration was added or replayed; SQL Editor migration history remains separate from absent CLI history.

## Actual results

| Case | Evidence and result |
| --- | --- |
| Expired delivered email | Gmail receipt **16:33:38 UTC**; provider-expired link rejected at **16:35:08 UTC**; no password form authorization and original password still works |
| Desktop delivered email | Gmail receipt **16:37:54 UTC**; successful password change and remaining assertions completed at **16:42:19 UTC**, following the fixes described below |
| Mobile-emulated delivered email | Gmail receipt **16:47:25 UTC**; successful recovery and assertions completed at **16:55:16 UTC**, viewport 390×844, touch/mobile emulation |
| Generic requests and duplicates | Actual application HTTP 202 response and confirmation matched for the authorized request, immediate duplicate and suppressed non-allowlisted address; only the three authorized messages were observed in the targeted inbox search |
| Recovery authorization | Separate requesting and recovering browser contexts; recovering browser initially signed in as a different synthetic account; displayed recovery identity matched the recipient; new password succeeded and old password failed for the dedicated identity |
| Refresh and reopening | Refresh before verification loses the in-memory candidate; reopening the same delivered link in the same tab now restores Continue. Refresh after verification retains valid server authorization; refresh after completion shows success |
| Session policy | Old refresh token rejected with `refresh_token_not_found`; **old access JWT still returned Data API HTTP 200**, consistent with documented access until JWT expiry |
| Invalid/reused/tampered links | Reused delivered token, malformed token and tampered candidate rejected with HTTP 401 in a fresh recovery context |
| Redirect bypasses | External, protocol-relative, encoded/double-encoded slash, encoded backslash and checkout destinations rejected: query-based attempts 403; additional redirect fields 400 |
| Retained permissions/evidence | Ordinary recovered session retained active worker membership, downloaded JPEG and PDF, and received `409 immutable` on attempted finalized-photo removal. Photo/PDF hashes matched across both successful recoveries |

Retained artifact SHA256 values: photo `a4afdb8b208e66413d9fb4cdfeeb041134a16519098d79f0a4918ae092428fec`; PDF `75e5b18fb9a7bc971399c1fc0dfa3cfbce48511d0862a7ca8bad4c4de7cfd9f9`. Existing PDF layout was verified in Phase 3; this slice checked authorized byte-preserving access, without regenerating evidence.

The Gmail connector confirmed actual inbox receipt and supplied the delivered link privately. The browser Gmail session belonged to a different account, so it was not used to inspect message contents. Links were transported to ignored local test state using a temporary RSA-OAEP encrypted handoff; decryption stayed local. No screenshots/traces of recovery material were taken. Passwords were generated/saved before attempts, and only the dedicated identity's ignored credential state was updated afterward.

## Confirmed defect and preserved failed runs

The first desktop delivered-link run reproduced a functional defect: reopening the link after a refresh can change only the URL fragment, leaving the component mounted. Initial-load-only fragment parsing failed to restore Continue. `RecoveryForm` now listens for `hashchange`, strips each candidate fragment immediately, and removes its listener on cleanup, including React Strict Mode. A fragment still grants no authority; provider verification remains mandatory. The same unconsumed email link passed after the fix, including refresh/reopen on desktop and mobile.

Two harness issues were also preserved: an initial request timed out before dispatch (provider `recovery_sent_at` was null and inbox search empty before retry), and the finalized-photo mutation assertion initially expected 403 where the correct response was `409 immutable`. The second issue occurred after password success; remaining assertions resumed without another password change. No records were deleted or migrations altered to manufacture passes.

## Provenance and resumption

Live runs used base commit `3fd1a42558efb3e6e272cca68b91e747d78cf715` plus the uncommitted delivery harness; successful desktop/mobile recovery included the `RecoveryForm` defect fix delivered with this report. They were not tests of the untouched base commit. Safe per-operation timestamps, dirty-tree provenance, failed runs and artifact hashes are retained in `.staging/recovery-email-tests.json` and `test-results/recovery-email/2026-09-14T16-28-55.962Z/results.json`.

The durable `.staging/recovery-email-delivery-checkpoint.json` records configuration, sanitized receipt IDs/times, the tested component hash, exact next step and final commit/push/CI receipt. Private identity/current password, pre-attempt passwords/sessions and delivered links remain in their respective ignored recovery-email files. Never print or stage them. `scripts/staging/recovery-delivery.mjs request|verify expired|desktop|mobile` refuses blind resends, preserves failures and skips passed operations. Do not rerun completed cases merely to increase counts.

Local quality: **35 tests**, **30 production smoke checks**, lint, typecheck and production build pass. Lint retains one pre-existing layout-font warning. The previous seven provider-assisted diagnostic groups and two session/throttle checks remain historical evidence, distinct from these actual delivered-email cases. Provider/network failure injection remains **mocked** evidence from those tests; no live SMTP outage was manufactured. Exact final commit CI is recorded in the delivery checkpoint after push.

## Supported scope and next task

Verified: delivered links work in independent Chromium browser contexts, desktop and mobile emulation, without a requesting-browser PKCE verifier. This does **not** establish physical second-device or Safari/Firefox support. `localhost` on another device identifies that device, so a reachable approved HTTPS staging origin is required for a real cross-device email-client check.

Production blockers remain: a reviewed sender/domain and reachable HTTPS origin, physical-device/mail-client coverage, qualified content review, privacy/retention and support policy, broader abuse controls, backup/restore drill, secret rotation/operations, and billing reconciliation. Existing JWTs retain access until expiry; application/provider timing can differ and generic confirmations do not guarantee delivery. Free test-domain delivery is deliberately single-recipient, not production email readiness.

**Next bounded task:** establish an approved reachable staging HTTPS origin and verify a delivered recovery link on a physical second device, with explicit authorization for any hosting/domain change. Billing and redesign remain outside this work.
