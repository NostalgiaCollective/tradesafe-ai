-- Additive shared admission budgets. Existing reports, bytes and historical SQL stay intact.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
CREATE TABLE public.ts_resource_limits (
 key text PRIMARY KEY, window_start timestamptz NOT NULL, count integer NOT NULL CHECK(count>=0)
);
ALTER TABLE public.ts_resource_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ts_resource_limits FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.ts_resource_admit(kind text,report_id uuid,actor_id uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.ts_reports; m public.ts_members; keys text[]; limits integer[]; i integer;
BEGIN
 IF kind IS NULL OR kind NOT IN ('upload','pdf') OR actor_id IS NULL THEN RAISE EXCEPTION 'TS_invalid'; END IF;
 SELECT * INTO r FROM public.ts_reports WHERE id=report_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'TS_not_found'; END IF;
 SELECT * INTO m FROM public.ts_members WHERE company_id=r.company_id AND user_id=actor_id AND active;
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM auth.users WHERE id=actor_id AND email_confirmed_at IS NOT NULL) THEN RAISE EXCEPTION 'TS_denied'; END IF;
 IF kind='upload' AND (r.lifecycle<>'draft' OR (m.role='worker' AND r.author_id<>actor_id)) THEN RAISE EXCEPTION 'TS_denied'; END IF;
 IF kind='pdf' AND r.lifecycle<>'finalized' THEN RAISE EXCEPTION 'TS_incomplete'; END IF;
 -- Fixed slots bound this table to 16,386 rows; collisions throttle conservatively.
 keys:=ARRAY[kind||':global',kind||':company:'||right(md5(r.company_id::text),3),kind||':user:'||right(md5(actor_id::text),3)];
 limits:=CASE WHEN kind='upload' THEN ARRAY[60,30,20] ELSE ARRAY[20,10,5] END;
 PERFORM pg_catalog.pg_advisory_xact_lock(74160916);
 FOR i IN 1..3 LOOP
  INSERT INTO public.ts_resource_limits VALUES(keys[i],now(),0) ON CONFLICT DO NOTHING;
  UPDATE public.ts_resource_limits SET window_start=now(),count=0 WHERE key=keys[i] AND window_start<=now()-interval '10 minutes';
 END LOOP;
 FOR i IN 1..3 LOOP
  IF (SELECT count FROM public.ts_resource_limits WHERE key=keys[i])>=limits[i] THEN RETURN false; END IF;
 END LOOP;
 UPDATE public.ts_resource_limits SET count=count+1 WHERE key=ANY(keys);
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.ts_resource_admit(text,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ts_resource_admit(text,uuid,uuid) TO service_role;
COMMIT;
