-- Explicitly unset human planning; preserve every already-saved value and event.
BEGIN;
SET LOCAL lock_timeout='5s';
ALTER TABLE public.ts_actions DROP CONSTRAINT ts_actions_priority_check;
ALTER TABLE public.ts_actions ADD CONSTRAINT ts_actions_priority_check CHECK(priority IN ('low','normal','high','unspecified'));
ALTER TABLE public.ts_actions ALTER COLUMN priority SET DEFAULT 'unspecified';
DO $migration$
DECLARE src text; needle text:='coalesce(p->>''priority'',act.priority) NOT IN (''low'',''normal'',''high'')';
BEGIN
 SELECT pg_get_functiondef('public.ts_command(text,jsonb)'::regprocedure) INTO src;
 IF strpos(src,needle)=0 THEN RAISE EXCEPTION 'Unexpected planning command definition'; END IF;
 EXECUTE replace(src,needle,'coalesce(p->>''priority'',act.priority) NOT IN (''low'',''normal'',''high'',''unspecified'')');
END $migration$;
COMMIT;
