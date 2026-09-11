-- Read-only inventory. Run only in the intended isolated project during Phase 1.
-- Missing application tables are expected before fresh installation.
-- Compare columns, constraints, RLS, grants and policies with the migration;
-- no automatic repair of existing drift is performed.
SELECT current_database() AS database_name, current_user AS database_role;

SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled,
       c.relforcerowsecurity AS rls_forced
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname IN
  ('profiles', 'contractor_profiles', 'crew_members', 'checklist_templates', 'reports')
ORDER BY c.relname;

SELECT table_name, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name IN
  ('profiles', 'contractor_profiles', 'crew_members', 'checklist_templates', 'reports')
ORDER BY table_name, ordinal_position;

SELECT tablename, policyname, roles, cmd, qual, with_check
FROM pg_policies WHERE schemaname = 'public'
AND tablename IN ('profiles', 'contractor_profiles', 'crew_members', 'checklist_templates', 'reports')
ORDER BY tablename, policyname;

SELECT table_name, grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND table_name IN
  ('profiles', 'contractor_profiles', 'crew_members', 'checklist_templates', 'reports')
ORDER BY table_name, grantee, privilege_type;

SELECT c.conrelid::regclass AS table_name, c.conname, pg_get_constraintdef(c.oid) AS definition
FROM pg_constraint c JOIN pg_namespace n ON n.oid = c.connamespace
WHERE n.nspname = 'public' AND c.conrelid::regclass::text IN
  ('profiles', 'contractor_profiles', 'crew_members', 'checklist_templates', 'reports')
ORDER BY table_name, c.conname;
