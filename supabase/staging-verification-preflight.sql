-- READ ONLY. Run in the operator-verified isolated project before any migration/fixture writes.
-- Pair with preflight.sql and phase-2-preflight.sql. Never infer isolation from a project name.
SELECT current_database() AS database_name, current_user AS database_role, version() AS postgres_version;
SELECT schemaname, tablename FROM pg_tables
WHERE schemaname IN ('public','supabase_migrations') ORDER BY schemaname,tablename;
DO $inventory$
DECLARE versions jsonb;
BEGIN
 IF to_regclass('supabase_migrations.schema_migrations') IS NULL THEN
  RAISE NOTICE 'No CLI migration history found. SQL-editor executions may still exist: inspect schema before applying anything.';
 ELSE
  EXECUTE 'SELECT jsonb_agg(version ORDER BY version) FROM supabase_migrations.schema_migrations' INTO versions;
  RAISE NOTICE 'Recorded migration versions: %',coalesce(versions,'[]'::jsonb);
 END IF;
END $inventory$;
SELECT extname,extversion FROM pg_extension ORDER BY extname;
