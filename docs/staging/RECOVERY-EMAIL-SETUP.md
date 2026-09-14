# Controlled recovery email setup — 2026-09-14

The authorized recipient is recorded privately in `.staging/recovery-email.env`; do not broaden it. The connected Gmail profile matches and can be used for receipt verification. Gmail connector access does not supply an SMTP credential. Existing task-local environment files/process configuration contain no usable SMTP provider secret; the staging Dashboard still has default email only. No matching provider account-setup messages were found in a targeted inbox search. Resend browser access requires login. No unrelated project was inspected or modified.

## Recommended bounded option: Resend Free

Resend's [free transactional plan](https://resend.com/pricing) is $0/month, up to 3,000 messages/month and 100/day; its [transactional product page](https://resend.com/products/transactional-emails) states no credit card is required. Remain on Free, with no payment method, add-on or paid upgrade. Paid overages are not needed for this test.

The [test-domain policy](https://resend.com/docs/knowledge-base/403-error-resend-dev-domain) permits `onboarding@resend.dev` only to the email address associated with the Resend account. Therefore create/sign in using the exact authorized recipient. This avoids buying or configuring a domain for this single-recipient test. Other recipients or a custom sender require a verified owned domain and DNS records; those changes are outside this preparation.

[SMTP is supported](https://resend.com/docs/send-with-smtp): `smtp.resend.com`, port 465 with implicit TLS, username `resend`, API key as password. The guide lists a verified domain for normal sending and shows the test sender in its SMTP example; the recipient exception above is the basis for this bounded test. SMTP delivery has not been tested yet because no key is available. If the account imposes additional restrictions, stop and reconcile them rather than silently adding a domain or upgrading. [Supabase SMTP configuration is documented by Resend](https://resend.com/docs/send-with-supabase-smtp).

This is simpler here than SMTP services requiring a work-domain signup, or using a personal Gmail app password: the test sender is already provided, the recipient is deliberately limited to the account owner, and one sending-only key can be isolated to this staging test. No general production email recommendation is implied.

## Preparation actually completed

- `node --use-system-ca scripts/staging/prepare-recovery-email.mjs` ran against verified staging, based on `fd3caab8e5dda6a4e7bada623632dff5cf644cbb` plus the new preparation script. It checked for an existing matching account before creating the dedicated fixture, saved its marker/password before remote creation, and confirmed existing finalized report/ready photo/ready export access through its ordinary session. No recovery/confirmation email was sent.
- Private identity state: `.staging/recovery-email-account.json`. Safe result checkpoint: `.staging/recovery-email-preparation.json`. Do not rerun completed diagnostics or print private identity state. If preparation is interrupted, the marker and stored ID distinguish this fixture from an unrelated account; the script refuses to reset/repurpose an unknown existing user.
- Exact recipient appended to the existing ignored `.staging/server.env` allowlist; all prior configuration preserved. Email dispatch remains disabled.
- The exact `https://localhost:3000/auth/recovery` provider redirect was added once and checked after reload; existing `/auth/callback` preserved. Site URL unchanged. SMTP and recovery template remain unconfigured because the Dashboard requires SMTP before template editing.
- Six applied migrations, all existing synthetic evidence and the original excluded Supabase project remain unchanged. Application code is unchanged; lint passes with the existing layout-font warning. Earlier recovery diagnostics were not repeated.

## Exact missing manual action

1. Open [Resend signup](https://resend.com/signup), choose Free, and use the same email as `RECOVERY_TEST_EMAIL` in the prepared local file. Complete account/email verification; do not add a payment method or domain.
2. In [API Keys](https://resend.com/api-keys), create `TradeSafe staging recovery` with sending-only permission (`sending_access`), without a custom-domain restriction. Resend documents [key permissions](https://resend.com/docs/api-reference/api-keys/create-api-key).
3. Paste that key after the existing blank `SMTP_PASSWORD=` in ignored `.staging/recovery-email.env`. Do not paste it into chat, logs, screenshots or Git. Leave the other prepared fields unchanged and tell the agent it is saved.

The agent can then configure only tradesafe-staging SMTP, install `supabase/templates/recovery.html`, verify effective sender/recipient/limits, enable the allowlisted app dispatch, restart only the required staging service and request the actual recovery email. Use the connected Gmail inbox without exposing token-bearing message bodies or links in tool output. Record sanitized receipt/time/message ID and exercise the delivered link privately. If manual inbox inspection is needed, ask only for that action. Preserve all earlier results and clearly distinguish actual delivery from previous administrator-assisted diagnostics.
