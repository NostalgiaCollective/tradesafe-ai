# Shared phone demo

The separate practice company is labelled **DEMO — SYNTHETIC DATA**. Visitors use `/demo`, not the engineering sign-in or staging gate credentials. The prepared kitchen job contains fictional scope, a submitted observation, a labelled training-panel photo and an open follow-up. No signup, email or company setup is required. The in-app **Try this** guide uses the existing recording controls. Public instructions contain no credentials.

## Access boundary

`PHONE_DEMO_CONFIG` is a private, server-only runtime value on the existing Render staging service. It is disabled when absent, invalid, disabled explicitly, or outside the exact isolated project/local CI environment. The visitor alias/passphrase authenticates only this demo entry. The underlying dedicated Supabase account has a different unshared random password; its tokens never go to JavaScript, localStorage, URLs or JSON responses. The server uses ordinary user RLS, not service-role reads, for visitor work.

A one-hour, authenticated-encryption HttpOnly/Secure/SameSite=Strict cookie grants the narrow demo perimeter path set. The server checks Auth and exactly one active supervisor membership in the configured practice company on each request. Revocation is not cached. Engineering Basic authentication remains unchanged. Static framework assets and the bounded demo login are the only newly anonymous routes. Cross-origin mutations are refused. Login admits at most 20 attempts/minute and two concurrent attempts per existing single server process, with 1 KiB/5-second input limits and bounded provider calls. These counters reset on process restart; Supabase also applies its own Auth limits. This is a small shared demonstration, not an abuse-proof public launch or a distributed limiter.

Demo server RPCs allow existing report/concern recording and action progress only within normal permissions. Company/account management, invitations, billing, content approvals, external messaging, credential checks, control reviews and worker acknowledgements are unavailable. Internal demo action progress/closure is shared simulation; it is not individual attribution, a qualification, or safety approval. Company/site labels and saved job notes identify exports as synthetic. No visitor activity constitutes an observed participant test.

Draft revisions, idempotent retries, private evidence authorization, size limits and immutable submission/finalization rules remain in force. Concurrent visitors share saved records; stale edits require review. No timer or reset job deletes visitor work. Input must be fictional, including uploaded photos. The existing electrical record download and site evidence package retain their separate scopes.

## Private preparation and maintenance

Run `node --use-system-ca scripts/staging/prepare-phone-demo.mjs` only from the existing isolated staging checkout. It journals IDs before creating dedicated synthetic identities and records through existing Auth/admin provisioning and ordinary account RPCs. Auth accounts are provider-assisted demo identities, not verified human signup evidence. No email is sent. Reruns reuse the prepared site/job and do not reset saved edits, passwords or removed membership. An initial unpublished fixture using an engineering coordinator is retained privately but is not the shared demo; the final company contains dedicated demo identities only.

- Operator file: `.staging/phone-demo-private.json` (contains hidden maintenance material; never send this whole file).
- Shareable visitor-only text: `.staging/phone-demo-share.txt`. Its readiness marker is removed only after hosted verification.
- Runtime transfer: `.staging/phone-demo-runtime.env`. Base64 is encoding, not encryption: treat this file and Render value as secrets. Never commit or print them.
- Hosted test/delivery receipts: `.staging/phone-demo-hosted.json`, `.staging/phone-demo-delivery.md` and the durable checkpoint. These receipts, not this implementation document, establish delivery.

**Immediate revocation:** `node --use-system-ca scripts/staging/manage-phone-demo.mjs revoke`. Uses only the dedicated coordinator to revoke the shared account's membership. Verify new login and existing-session requests fail; all records remain. No reactivation is automatic.

**Passphrase refresh:** `node --use-system-ca scripts/staging/manage-phone-demo.mjs rotate` prepares `.staging/phone-demo-rotation-private.json` and `.staging/phone-demo-rotation.env`; it does not activate them. Apply only `PHONE_DEMO_CONFIG` on the same Render service, preserving every other variable and its current exact-CI-passing commit. The new encryption key invalidates prior demo cookies after activation. Verify old credentials/cookies fail and new credentials open the same saved records, then promote the private pending file and replace the visitor-only share text. No Supabase password reset or data reset is required. If membership was revoked, keep it revoked until Daniel separately chooses to reopen the demo.

No migration, paid service, public storage, domain, email, production or qualified-content approval is part of this feature. Free staging can take time to wake. Physical phone acceptance remains pending until Daniel or a visitor reports it.
