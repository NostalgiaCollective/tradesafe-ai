# Daniel: isolated Supabase setup for Phase 2

No isolated Supabase project was identifiable from this checkout on 2026-09-12. No remote preflight, migration, fixture SQL, authentication or customer-data operation has been performed.

Blank ignored files are already prepared locally: **.env.staging.local** and **.staging/isolation.json**. Existing .env and other operator configuration were preserved. Fill these files privately; do not paste keys, passwords, cookies or invitation links into chat.

## 1. Choose a genuinely disposable project

Open the [Supabase Dashboard](https://supabase.com/dashboard). If an existing project is intended for this work, confirm its organization, project ID, creation/source and data inventory. A name containing “staging” is insufficient.

Otherwise choose an organization with available free project capacity, select New project, and create a blank project for synthetic TradeSafe testing. Check the displayed plan/cost before creation; if it would add a charge, stop rather than create billable infrastructure. Do not clone a production database or attach production integrations. Keep the database password in your password manager; the application tests do not need it.

In Project Settings / General, record the project ID/reference privately. It must match the project URL's hostname. In Table Editor/Auth/Storage and configured integrations, confirm that records are absent or exclusively synthetic and that no customer imports, production webhooks or production service connections exist.

Run the read-only inventory files from section 3 and save the results privately under .staging/. Then complete .staging/isolation.json:

- projectRef: the exact project reference
- appOrigin: https://localhost:3000 for the prepared local launcher
- verifiedBy and verifiedAt: the responsible operator and ISO timestamp
- syntheticOnly, noProductionConnections and inventoryReviewed: true only after actually checking those facts

This file records a human-verified inventory; it is not evidence created automatically by the test runner.

## 2. Fill the ignored environment file

From the project's Connect dialog, copy its URL and publishable key. Alternatively use Settings > API Keys. Use the **publishable** key in the existing NEXT_PUBLIC_SUPABASE_ANON_KEY variable; that application variable accepts publishable keys as well as legacy anon keys. Never use a secret/service-role key. [Official API key guidance](https://supabase.com/docs/guides/getting-started/api-keys)

Fill .env.staging.local with the names already present:

| Name | Value to provide privately |
| --- | --- |
| APP_ENV | staging |
| NEXT_PUBLIC_APP_URL | https://localhost:3000 |
| NEXT_PUBLIC_SUPABASE_URL | The exact project HTTPS origin, no trailing path or query |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | Project publishable key |
| STAGING_ISOLATED_PROJECT_REF | Exact project reference |
| STAGING_ALLOW_SYNTHETIC_WRITES | yes, only after isolation inventory review |
| STAGING_OWNER_EMAIL / STAGING_OWNER_PASSWORD | First distinct synthetic account |
| STAGING_SUPERVISOR_EMAIL / STAGING_SUPERVISOR_PASSWORD | Second distinct synthetic account |
| STAGING_WORKER_EMAIL / STAGING_WORKER_PASSWORD | Third distinct synthetic account |
| STAGING_OUTSIDER_EMAIL / STAGING_OUTSIDER_PASSWORD | Fourth distinct synthetic account |

Use unique controlled email identities/aliases and distinct strong passwords. Quote dotenv values containing #, spaces or other special characters. Do not add Stripe/Anthropic keys; this phase does not use them.

The loader reads this dedicated file and explicit process variables, not .env/.env.local. Existing process variables take precedence and must not point at production. The checker prints variable names/presence and validation reasons only.

## 3. Review schema/history, then apply only missing migrations

In the **verified project's SQL Editor**, open a new query and run these repository files separately:

1. supabase/preflight.sql
2. supabase/phase-2-preflight.sql
3. supabase/staging-verification-preflight.sql

Review existing public tables, grants, RLS policies, protected functions/triggers and recorded migration versions. Missing CLI history does not prove that no SQL was previously executed. Save query results privately without keys or tokens.

For a blank project with no application tables, apply these exact files in order:

1. supabase/migrations/20260911000100_staging_baseline.sql
2. supabase/migrations/20260911000200_company_workflow.sql
3. supabase/migrations/20260911000300_template_v1.sql

For an existing verified Phase 1 schema, apply only the two missing Phase 2 files. If the schema or history differs, stop and report the drift; do not rerun files, reset the database, repair migration history blindly or execute supabase/schema.sql.

After each file, record filename/hash/time/result privately and rerun the inventory. SQL-editor execution and CLI history are separate: do not later use db push blindly over manually applied migrations. See [migration instructions](../../supabase/migrations/README.md) and [Supabase migration documentation](https://supabase.com/docs/guides/local-development/database-migrations).

## 4. Create four verified synthetic identities

In Authentication > Users, use Add user / Create new user when available to create the four synthetic email/password identities. Confirm only these synthetic users using the console's confirmation control. Keep ordinary email confirmation enabled; do not weaken global authentication to make tests pass.

If that console action is unavailable, use the app's normal Create Account flow with controlled inboxes and complete each confirmation email after starting the isolated app. No real customer identities should be used. Auth's user record must have email_confirmed_at populated; the harness checks it rather than trusting editable metadata. [Official user/verification model](https://supabase.com/docs/guides/auth/users)

In Authentication > URL Configuration set Site URL to https://localhost:3000 and allow the exact https://localhost:3000/auth/callback redirect. Configure only intended methods; Google need not be enabled for these password-based tests. [Official redirect guidance](https://supabase.com/docs/guides/auth/redirect-urls)

## 5. Validate and launch the isolated app

From this repository, Node 24 / PowerShell:

~~~powershell
npm.cmd run check:staging
npm.cmd run staging:install-browser
npm.cmd run staging:dev
~~~

The first command must succeed before tests write anything. Browser installation is a local development dependency download, not infrastructure creation. The launcher uses Next's documented experimental HTTPS development server; approve local certificate trust only for this local development setup. If TLS fails, fix certificate trust; never set NODE_TLS_REJECT_UNAUTHORIZED=0 or disable browser certificate checks.

The launcher uses .next-staging, preserves .next for unconfigured smoke checks, omits synthetic test passwords from its child process, and disables Stripe/Anthropic keys. It is not a deployment. Stop it with Ctrl+C when finished.

## 6. Prepare a real expired-invitation fixture

Ordinary members cannot backdate an invitation. Do not add an expiry bypass to the application or give the authorization tests a privileged key.

~~~powershell
npm.cmd run staging:prepare-expiry
~~~

After authenticating the owner/worker normally, this writes local ignored files only:

- .staging/expired-invitation.sql: narrowly scoped synthetic insert statements with random IDs and a token digest.
- .staging/expired-invitation.json: private token companion for the test; never print, screenshot or share this file.

Review and run the SQL file **once** in the same verified project's SQL Editor, after the migrations. Record its execution privately. It creates a separate synthetic company and an already-expired invitation; it does not alter application expiry rules or existing records. The generator refuses to overwrite files. If interrupted, inspect partial files/history rather than retrying blindly.

## 7. Run real browser and Data API checks

For a fresh set of accounts, run the browser scenarios before the API suite so initial onboarding can be exercised:

~~~powershell
npm.cmd run test:staging:browser -- --project=desktop
npm.cmd run test:staging
~~~

The browser suite also supports --project=phone. To exercise **fresh** phone onboarding after desktop tests, use a fresh four-account synthetic set in the ignored configuration; existing records are deliberately retained. Regenerate the expiry fixture only through a separately reviewed setup for those identities. Other phone scenarios can run on existing synthetic accounts, but reused-account onboarding is marked BLOCKED, not passed. Do not erase companies or users just to make onboarding pass.

Both runners preserve synthetic records. No destructive cleanup or production operation is included. Do not override the safe reporter or enable traces/videos while entering credentials. Capture only authenticated synthetic operational screens, with email fields/invitation links masked or absent.

Results:
- test-results/staging-integration.json: commit, project fingerprint and named scenario outcomes; no credentials
- test-results/staging-browser.json: commit and named browser outcomes
- test-results/staging-evidence/: explicitly captured synthetic observation screenshots after successful sign-in

No file existing here proves a pass: inspect status and the tested commit. The current files record BLOCKED runs.

## Additional manual verification before calling Phase 2 verified

- **Natural session expiry:** the automated cookie-removal scenario tests session loss, not elapsed JWT expiry. In the isolated project, record the configured token lifetime; use a disposable session, prevent refresh, allow the real server-issued token to expire, and verify that save fails safely with inputs retained and re-login/retry recovers. Do not change production token settings or fake the database clock.
- **Print:** automated print-media assertions do not prove printer/PDF output fidelity. Inspect actual browser print preview for desktop/phone, original concerns, actor/time/template/snapshot and amendment linkage.
- **Visibility:** inspect all relevant role screens, error text/focus, actual touch behavior and remaining navigation checks in STAGING-RUNBOOK.md. Static old screenshots are not E2E evidence.
- **Migration integrity:** record actual executed files and provider results; PGlite results cannot certify hosted policy/default-grant behavior.

When setup is ready, tell Codex only **“staging configured”** and whether the reviewed migrations/expiry fixture were executed. Keep all values in the ignored files. The next work is live preflight reconciliation and execution of these tests, followed by bounded fixes.
