-- Read-only inventory for an explicitly isolated project. No automatic repair.
SELECT current_database() AS database_name, current_user AS database_role;
SELECT c.relname,c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND starts_with(c.relname,'ts_') ORDER BY c.relname;
SELECT tablename,policyname,roles,cmd,qual,with_check FROM pg_policies
WHERE schemaname='public' AND (starts_with(tablename,'ts_') OR tablename='reports')
ORDER BY tablename,policyname;
SELECT table_name,grantee,privilege_type FROM information_schema.role_table_grants
WHERE table_schema='public' AND (starts_with(table_name,'ts_') OR table_name IN ('reports','profiles','contractor_profiles','crew_members'))
ORDER BY table_name,grantee,privilege_type;
SELECT p.proname,p.prosecdef,p.proconfig,p.proacl FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND starts_with(p.proname,'ts_') ORDER BY p.proname;
SELECT event_object_table,trigger_name,event_manipulation,action_statement FROM information_schema.triggers
WHERE trigger_schema='public' AND starts_with(trigger_name,'ts_') ORDER BY event_object_table,trigger_name;