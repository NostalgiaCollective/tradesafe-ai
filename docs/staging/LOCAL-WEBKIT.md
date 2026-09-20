# Disposable local WebKit verification

This supplements hosted staging checks. It is not physical iPhone acceptance, external email delivery, a recovery drill, or production readiness.

The public repository's existing standard GitHub Ubuntu runner starts a new Supabase CLI stack in `.ci-local`, installs the unchanged migrations into that empty database, builds the real Next application against loopback services and executes WebKit with mobile emulation. No hosted environment file, remote project link, staging secret or external SMTP relay is used. Local Auth confirmation is required and its messages are captured by the local SMTP sink. The harness refuses existing local stack directories or app environment files, rejects noncanonical API targets, blocks external browser requests and suppresses credential/token-bearing diagnostics. No browser traces, screenshots, captured mail or private test artifacts are uploaded. A sanitized result is written to the Actions job summary, with executed and skipped counts; skipped tests fail this gate.

Coverage: local signup/captured confirmation, password sign-in, company creation, draft save/reload; actual 3.6 MB synthetic photo upload and caption/image reload, normalization, finalization, private PDF generation/download/content, immutable originals, separate amendment save/reload; cross-company/RLS, direct-write, role-escalation, anonymous and revoked-member evidence/PDF/save denial. Additional permission actors are provider-assisted synthetic fixtures.

Run: the `local-webkit` job in `.github/workflows/quality.yml`. It uses pinned Supabase CLI 2.117.0 and the locked Playwright WebKit engine. `node scripts/ci/local-browser.mjs` runs only on the Linux GitHub runner for this repository. The ordinary `quality` job, including the npm audit gate, remains unchanged. No application deployment is needed for test-harness-only changes; any later deployable change must pass both jobs for its exact commit before staging deployment.

Initial preparation: 58 unit/database checks, lint (existing font warning), typecheck and discovery of three local WebKit scenarios passed on Windows. Discovery is not browser execution. The exact execution receipt belongs in the durable checkpoint and Actions run summary.

## Deferred email/domain gates

Daniel selected `tradesafeapp.ca` as an intended future domain but has not purchased it; no purchase budget or domain changes are authorized. It must not appear in active app URLs, SMTP sender configuration or authentication redirects. Continue using the current Render staging origin and preserve working login/recovery. Verified-domain setup and genuine fresh-signup delivery remain explicitly deferred. Reconfirm the final unused recipient and dispatch authorization before any future real email test. Existing accounts and prior evidence remain intact.

## References

- [Supabase local development](https://supabase.com/docs/guides/local-development)
- [Pinned CLI configuration](https://github.com/supabase/cli/blob/v2.117.0/apps/cli-go/pkg/config/templates/config.toml)
- [GitHub Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions): standard runners in public repositories are free; this job adds no paid runner or artifact/cache storage.
