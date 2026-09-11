# Isolated database baseline

`../schema.sql` is historical, destructive reset SQL. Do not run it. It is preserved unchanged for discovery comparison.

`20260911000100_staging_baseline.sql` is an additive **fresh-install staging** migration. It creates the five application tables, owner policies, grants and timestamp triggers only when those tables do not exist. It never replaces existing tables, policies, records or triggers. It has a transaction and bounded lock/statement timeouts. New foreign keys use `RESTRICT`, so removing an auth user cannot silently erase reports. Account deletion needs a separate retention procedure.

This retains the existing `draft`/`completed` report column and broad owner mutation rules for compatibility. It does **not** establish trusted billing state or safe finalization. There is no company tenant model. Do not interpret these ownership policies as company isolation or production approval.

The application uses `lib/domain/templates.ts`. The unused `checklist_templates` table is retained for schema compatibility and intentionally not seeded with another copy of the definitions.

## Test locally, without Supabase credentials

From the repository root, use Node 24 and run:

```sh
npm ci --ignore-scripts
npm test
```

The PostgreSQL tests use an ephemeral PGlite database, synthetic UUIDs and a small `auth.uid()` fixture. They execute the actual migration twice, check record/policy preservation, reject anonymous/cross-user operations, and verify that a pre-existing drifted table is not altered. They do not contact Supabase. This does not verify Supabase's real Auth service, PostgREST, default grants, extensions or hosted policies.

## Fresh isolated Supabase project

1. Create a disposable Supabase project dedicated to staging. Verify its organization and project reference in the provider console. Do not link a production project or import customer data.
2. Review `../preflight.sql` in that project's SQL editor. On a fresh project the application tables should be absent. Existing application tables mean this is not a fresh install: stop and inventory drift.
3. Apply **only** `20260911000100_staging_baseline.sql` through the isolated project's SQL editor. Do not select historical `schema.sql` or a reset command.
4. Run preflight again. Inspect columns, RLS, policies, grants and constraints. Create two synthetic users through Supabase Auth and perform the staging checks in `docs/STAGING-RUNBOOK.md` with their ordinary public-key sessions.
5. Record the project reference, migration filename/hash, execution time and test results in your internal release record. Never record keys, passwords or session tokens.

If your team uses the Supabase CLI, initialize local CLI configuration and explicitly link the disposable project. Run `supabase migration list` and `supabase db push --dry-run`, review the linked reference and planned file, then `supabase db push`. The SQL-editor and CLI-history workflows are alternatives: do not mix them without reconciling migration history. No CLI link, push, reset or remote migration was executed during Phase 1.

## Existing installations and production upgrades

Fresh-install setup and production upgrades are separate workflows. This initial migration deliberately leaves existing schema drift untouched; a successful replay is not a compatibility certificate. Existing RLS or grants may be weaker than the fresh baseline.

Inventory and export the actual schema/policies/grants, verify backups and restore capability, compare preflight results with expected fields, and write a **new**, explicitly reviewed additive migration for any required reconciliation. Rehearse against an isolated schema copy using synthetic data. Get separate authorization before any production operation. Never replace a previously applied migration file to rewrite history.

## Rollback

A failure before commit rolls back the migration transaction. After commit, do not create a destructive down migration. Roll back the app release while leaving additive tables intact, or repair with a reviewed forward migration. For disposable staging, a new isolated project is preferable to resetting an ambiguous linked database. Production recovery requires a verified provider backup/restore procedure; none has been verified here.
