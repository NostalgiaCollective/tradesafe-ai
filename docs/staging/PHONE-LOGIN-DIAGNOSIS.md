# Physical-phone login diagnosis

Source checkpoint: `.staging/physical-phone-checkpoint.json`. September 15, 2026 UTC.

## Manual evidence

User: iPhone 14 Pro Max, Safari. Staging gate and navigation to Welcome Back passed previously. Submitting the existing synthetic account email/currentPassword returned to login without a visible error. **Physical authentication is not passed.** The reported hostname/path is the canonical staging `/auth/login`.

Pending single phone action: open `/dashboard` in the same Safari tab and report Reports, Welcome Back, a staging access prompt or other message. This distinguishes an existing server-readable session from a missing session without another password submission. Exact physical cause remains unresolved until device evidence arrives.

## Controlled diagnosis

One actual sign-in with the existing account was made in Playwright WebKit 26.6 on Windows, with iPhone 14 Pro Max emulation. Provider response: HTTP 200, intended account matched, session issued. The dashboard returned HTTP 200, then remained accessible after reload with the session cookie delivered. The saved currentPassword is valid; no reset is justified by this evidence. This is **not physical Safari evidence**.

The cookie was host-scoped to the canonical Render service, Secure, path `/`, approximately 2.9 KB. Installed Supabase SSR defaults specify SameSite Lax and script-readable cookies. WebKit's automation cookie metadata reported None; that discrepancy is not evidence that physical Safari uses None. No cookie flags or staging protection were relaxed. The staging server removes the Basic Authorization credential before passing requests to Next; it does not remove session cookies. Protected-route middleware verifies the user and redirects anonymous requests with a safe return path and no-store headers. Password login does not use an emailed callback URL.

The controlled run recorded WebKit page errors as well as successful dashboard responses; these are not asserted to explain the user's failure. Sanitized evidence is retained in `.staging/phone-login-diagnosis.json`. The final hosted verification receipt records subsequent network observations separately.

Official context: [Supabase SSR](https://supabase.com/docs/guides/auth/server-side) shares the session through application cookies. [WebKit tracking prevention](https://webkit.org/tracking-prevention/) describes third-party restrictions; those alone do not demonstrate rejection of this first-party application cookie. Do not ask the user to disable cross-site tracking protections as a speculative fix.

## Reproduced defects and corrections

1. **Silent session-loss return:** with browser cookie writes blocked and a synthetic successful provider response, the old form immediately navigated to `/dashboard`, received a 307 to login, and displayed no account error. No real provider request/account creation was used for this reproduction. The form now awaits a same-origin `/api/auth/session` check before navigation. The server verifies the user from its cookies and returns only `{ authenticated: true }`. Missing session, staging gate rejection and network/service failure produce distinct bounded messages. No identity, credentials or tokens are returned. No automatic password retries.
2. **Input before hydration:** in local WebKit, filling the visible email field then password changed email length from 22 to 0 before any provider request. The server-rendered form accepted input before React handlers were ready. Inputs and sign-in controls now remain disabled until client hydration completes. The same probe retains all 22 characters afterward. This local reproduction is not proof of the physical-device cause.

The change does not bypass browser cookie settings or guarantee physical authentication. It makes two reproducible failures explicit/preventable and allows the next device observation to narrow the remaining cause.

## Validation and boundaries

- 42 unit/integration tests passed, including new confirmation-response checks, existing session/recovery, authorization, immutable reports and evidence boundaries.
- Eight fault-injection browser cases passed locally (Chromium and WebKit): missing cookie, rejected provider credential, session-check network failure, server-confirmed navigation. Provider replies and successful destination are mocked; missing-session rejection uses the actual configured app endpoint. No real credentials used in these cases.
- Typecheck/build passed, 30 HTTP smoke checks passed; lint has zero errors and the existing font warning.
- Repeat browser fault injection with `node --use-system-ca scripts/staging/login-session-browser.mjs` against the authorized local staging launcher, or append `--hosted` after deployment. Chromium/WebKit binaries must exist under `.staging/browsers`. No TLS bypass, traces or credential logging.
- Exact commit, CI and deployment/post-deployment receipts are in `phone.loginDiagnosis` in the durable checkpoint. Initial real sign-in is distinct from the post-deployment verification sign-in, if performed.
- No password reset, recovery email, account creation, migration, data deletion, production change or checkout enablement. Previous phone/recovery/report/photo/PDF observations are retained.
