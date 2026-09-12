# Isolated database setup and Phase 2 backfill

Verification follow-up (2026-09-12): numbered migration files remain unchanged and none has been executed in real Supabase by this task. Add ../staging-verification-preflight.sql to the read-only inventory to inspect CLI history without assuming absent history means a fresh database. The optional expiry fixture is generated locally, reviewed and executed once by an isolated-project operator; it is not a migration or an application expiry bypass. See ../../docs/staging/DANIEL-SETUP.md.

../schema.sql is historical destructive reset SQL. It remains unchanged and must not be executed. Fresh installation and production upgrades are separate workflows; these instructions cover isolated staging only.

## Migration order

| File | Purpose | Executed where |
| --- | --- | --- |
| 20260911000100_staging_baseline.sql | Original additive legacy tables, preserving rather than repairing unknown drift | Ephemeral PGlite only |
| 20260911000200_company_workflow.sql | Company/membership/invitation/report/action/event tables, guarded commands, RLS, legacy backfill and write freeze | Ephemeral PGlite only |
| 20260911000300_template_v1.sql | Three frozen versioned templates from the shared module | Ephemeral PGlite only |

Phase 2 migrations run once, transactionally, with recorded history. They intentionally fail if objects already exist unexpectedly. Do not make them silently idempotent over unknown functions/policies. Phase 1's fresh-install replay test does not imply Phase 2 replay is supported.

Verify the disposable project reference and absence of customer data. Run ../preflight.sql and ../phase-2-preflight.sql, inspect columns/FKs/policies/grants/functions/triggers and stop on drift. Phase 1 does not reconcile older installations; successful execution alone is not upgrade certification.

For a fresh isolated project, apply all three numbered files in order using its SQL editor and record filenames/hashes/time. For verified isolated Phase 1 schema, apply only the two Phase 2 files. A CLI alternative explicitly links the disposable project, inspects supabase migration list and supabase db push --dry-run, then applies supabase db push. Never mix SQL-editor and CLI histories without reconciliation. No remote CLI link, migration, push or reset was executed here.

## Explicit backfill rules

- Each legacy Auth user with a profile, contractor profile, report or roster receives a separate company and owner membership. Names and email domains never merge users.
- Name precedence: nonempty contractor-profile business name, profile business name, then Imported business.
- The whole contractor profile takes precedence for initial settings when present; otherwise the original profile is copied. No silent field-level merge occurs. Both full original profiles remain in legacy_profiles and are visible for owner review.
- Older field names such as electrical_license are retained, not guessed into new registration fields. Owners confirm canonical settings before relying on prefill. No qualification is verified by migration or app role.
- Old reports link to the original user's company, unchanged and read-only. Payment session fields, legacy status and checklist values are not mapped to safety observations or entitlement.
- Legacy roster entries remain historical rows. They do not become authenticated memberships. Owners invite people with their individual accounts.
- New ts_reports copy company identity and template questions/version. Amendments copy the original snapshot and require a reason. Finalized observations are never overwritten.

npm test rehearses synthetic conflicts, separate users with identical business names, profile precedence and payment preservation. Actual production schema reconciliation is separately blocked and unauthorized.

## Authority and verification

New tables enable RLS with authenticated SELECT only. Guarded commands check current membership, ownership, revisions and input. Company locks serialize membership changes with mutations. Server routes repeat authorization; direct Data API calls cannot grant ordinary table-write authority.

Finalized report/template/event guards preserve snapshots/history; legacy report writes are frozen. Foreign keys use RESTRICT. No table drop, destructive cascade, legacy data deletion or answer conversion is introduced. These controls do not restrict privileged database administrators; the app has no service-role key.

Run npm test, then npm run test:staging with verified synthetic accounts per docs/STAGING-RUNBOOK.md. Inspect actual grants/policies and attempt direct insert/update/delete with ordinary users. Real Supabase Auth/PostgREST isolation remains BLOCKED until these checks run.

## Template versioning and rollback

scripts/generate-template-migration.mjs generated the first checked-in seed from lib/domain/templates.ts and refuses overwrite. Future content changes need new stable version IDs and a new additive seed migration. Do not rewrite applied files. Content remains pending qualified review despite software validation.

Failed transactions roll back. After commit retain objects/records and use forward repair. Phase 1 is incompatible with the Phase 2 legacy-write freeze and must not be restored against that database. Use matching verified artifacts or pause staging. Never run reset/destructive down SQL. Backup/restore capabilities are unverified.
