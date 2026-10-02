-- Human-entered planning only. Existing state/assignment/verification rules remain.
BEGIN;
SET LOCAL lock_timeout='5s';
ALTER TABLE public.ts_actions ADD COLUMN priority text NOT NULL DEFAULT 'normal' CHECK(priority IN ('low','normal','high'));
ALTER TABLE public.ts_actions ADD COLUMN priority_rank integer GENERATED ALWAYS AS (CASE priority WHEN 'high' THEN 0 WHEN 'normal' THEN 1 ELSE 2 END) STORED;
CREATE INDEX ts_actions_planning ON public.ts_actions(company_id,target_date,id) WHERE state<>'closed';
CREATE TABLE public.ts_action_requests(actor_id uuid NOT NULL REFERENCES auth.users(id),request_id uuid NOT NULL,action_id uuid NOT NULL REFERENCES public.ts_actions(id),payload jsonb NOT NULL,PRIMARY KEY(actor_id,request_id));
ALTER TABLE public.ts_action_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ts_action_requests FROM PUBLIC,anon,authenticated;
CREATE TRIGGER action_request_immutable BEFORE UPDATE OR DELETE ON public.ts_action_requests FOR EACH ROW EXECUTE FUNCTION public.ts_immutable();
DO $migration$
DECLARE src text; needle text;
BEGIN
 SELECT pg_get_functiondef('public.ts_command(text,jsonb)'::regprocedure) INTO src;
 needle:='IF act.last_request=req THEN RETURN to_jsonb(act); END IF;';
 IF strpos(src,needle)=0 THEN RAISE EXCEPTION 'Unexpected action command definition'; END IF;
 src:=replace(src,needle,$code$
  IF EXISTS(SELECT 1 FROM public.ts_action_requests WHERE actor_id=actor AND request_id=req) THEN
   IF NOT EXISTS(SELECT 1 FROM public.ts_action_requests WHERE actor_id=actor AND request_id=req AND action_id=act.id AND payload=p) THEN RAISE EXCEPTION 'TS_conflict'; END IF;
   RETURN to_jsonb(act);
  END IF;
  IF role_name='worker' AND (nullif(p->>'targetDate','')::date IS DISTINCT FROM act.target_date OR coalesce(p->>'priority',act.priority) IS DISTINCT FROM act.priority) THEN RAISE EXCEPTION 'TS_denied'; END IF;
  IF coalesce(p->>'priority',act.priority) NOT IN ('low','normal','high') OR (nullif(p->>'targetDate','') IS NOT NULL AND (nullif(p->>'targetDate','')::date<'2000-01-01' OR nullif(p->>'targetDate','')::date>'2100-12-31')) THEN RAISE EXCEPTION 'TS_invalid'; END IF;
  IF act.last_request=req THEN RETURN to_jsonb(act); END IF;
 $code$);
 needle:='UPDATE public.ts_actions SET controls=p->>''controls'',responsible_id=';
 IF strpos(src,needle)=0 THEN RAISE EXCEPTION 'Unexpected action update definition'; END IF;
 src:=replace(src,needle,'UPDATE public.ts_actions SET priority=coalesce(p->>''priority'',act.priority),controls=p->>''controls'',responsible_id=');
 needle:='VALUES(c,actor,''action_updated'',act.id,before_act,to_jsonb(act));';
 IF strpos(src,needle)=0 THEN RAISE EXCEPTION 'Unexpected action audit definition'; END IF;
 src:=replace(src,needle,needle||' INSERT INTO public.ts_action_requests VALUES(actor,req,act.id,p);');
 EXECUTE src;
 -- Append columns to existing security-invoker projections; never replace their access rules.
 SELECT pg_get_viewdef('public.ts_site_actions',true) INTO src;
 -- Wrap the existing projection to preserve its exact column order.
 EXECUTE 'CREATE OR REPLACE VIEW public.ts_site_actions WITH(security_invoker=true) AS SELECT old.*,a.priority,a.priority_rank FROM ('||rtrim(src,E';\n ')||') old JOIN public.ts_actions a ON a.id=old.id';
 SELECT pg_get_viewdef('public.ts_action_ownership',true) INTO src;
 EXECUTE 'CREATE OR REPLACE VIEW public.ts_action_ownership WITH(security_invoker=true) AS SELECT old.*,a.priority,a.priority_rank FROM ('||rtrim(src,E';\n ')||') old JOIN public.ts_actions a ON a.id=old.id';
END $migration$;
COMMIT;
