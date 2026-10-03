-- Private pilot feedback and per-account guidance. No historical record changes.
BEGIN;
SET LOCAL lock_timeout='5s';
CREATE TABLE public.ts_pilot_preferences (
 company_id uuid NOT NULL REFERENCES public.ts_companies(id), user_id uuid NOT NULL REFERENCES auth.users(id),
 dismissed boolean NOT NULL DEFAULT false, updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(company_id,user_id)
);
CREATE TABLE public.ts_pilot_feedback (
 id uuid PRIMARY KEY, company_id uuid NOT NULL REFERENCES public.ts_companies(id), author_id uuid NOT NULL REFERENCES auth.users(id),
 kind text NOT NULL CHECK(kind IN ('problem','suggestion')), task text NOT NULL CHECK(length(btrim(task)) BETWEEN 1 AND 200),
 description text NOT NULL CHECK(length(btrim(description)) BETWEEN 1 AND 2000), expectation text NOT NULL CHECK(length(expectation)<=2000),
 app_version text NOT NULL CHECK(length(app_version)<=64), route text NOT NULL CHECK(route ~ '^/[a-zA-Z0-9/_-]*$' AND length(route)<=200),
 status text NOT NULL DEFAULT 'received' CHECK(status IN ('received','investigating','resolved')),
 revision integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ts_pilot_feedback_company ON public.ts_pilot_feedback(company_id,created_at DESC,id);
CREATE TABLE public.ts_pilot_requests (
 company_id uuid NOT NULL REFERENCES public.ts_companies(id), request_id uuid NOT NULL, actor_id uuid NOT NULL REFERENCES auth.users(id),
 payload jsonb NOT NULL, result jsonb NOT NULL, PRIMARY KEY(company_id,request_id)
);
CREATE TABLE public.ts_pilot_feedback_history (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, feedback_id uuid NOT NULL REFERENCES public.ts_pilot_feedback(id),
 company_id uuid NOT NULL REFERENCES public.ts_companies(id), actor_id uuid NOT NULL REFERENCES auth.users(id),
 previous_status text NOT NULL, new_status text NOT NULL, occurred_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ts_companies ADD COLUMN practice boolean NOT NULL DEFAULT false;
ALTER TABLE public.ts_pilot_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ts_pilot_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ts_pilot_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ts_pilot_feedback_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY pilot_preferences_read ON public.ts_pilot_preferences FOR SELECT TO authenticated USING(user_id=auth.uid() AND public.ts_role(company_id) IS NOT NULL);
CREATE POLICY pilot_feedback_read ON public.ts_pilot_feedback FOR SELECT TO authenticated USING(public.ts_role(company_id) IS NOT NULL AND (author_id=auth.uid() OR public.ts_role(company_id)='owner'));
CREATE POLICY pilot_history_read ON public.ts_pilot_feedback_history FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.ts_pilot_feedback f WHERE f.id=feedback_id));
REVOKE ALL ON public.ts_pilot_preferences,public.ts_pilot_feedback,public.ts_pilot_requests,public.ts_pilot_feedback_history FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.ts_pilot_preferences,public.ts_pilot_feedback,public.ts_pilot_feedback_history TO authenticated;
CREATE FUNCTION public.ts_pilot_command(command text,p jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE actor uuid:=auth.uid(); company uuid:=(p->>'companyId')::uuid; role text; req uuid:=(p->>'requestId')::uuid; prior public.ts_pilot_requests; f public.ts_pilot_feedback; result jsonb; next_status text;
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'TS_unauthorized'; END IF;
 -- Share the existing membership-command lock; revocation cannot race a write.
 PERFORM 1 FROM public.ts_companies WHERE id=company FOR UPDATE;
 role:=public.ts_role(company);IF role IS NULL THEN RAISE EXCEPTION 'TS_denied'; END IF;
 -- Recheck current privileges even when returning an earlier retry receipt.
 IF command IN ('status','practice') AND role<>'owner' THEN RAISE EXCEPTION 'TS_denied';END IF;
 IF req IS NULL OR octet_length(p::text)>16000 THEN RAISE EXCEPTION 'TS_invalid'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(company::text,17));
 SELECT * INTO prior FROM public.ts_pilot_requests WHERE company_id=company AND request_id=req;
 IF FOUND THEN IF prior.actor_id<>actor OR prior.payload<>jsonb_build_object('command',command,'p',p) THEN RAISE EXCEPTION 'TS_conflict'; END IF;RETURN prior.result;END IF;
 IF command='practice' THEN
  IF role<>'owner' THEN RAISE EXCEPTION 'TS_denied';END IF;
  IF NOT (SELECT practice FROM public.ts_companies WHERE id=company) THEN
   IF EXISTS(SELECT 1 FROM public.ts_sites WHERE company_id=company) OR EXISTS(SELECT 1 FROM public.ts_reports WHERE company_id=company) OR EXISTS(SELECT 1 FROM public.ts_briefs WHERE company_id=company) THEN RAISE EXCEPTION 'TS_conflict';END IF;
   UPDATE public.ts_companies SET practice=true,name='PRACTICE — '||left(name,150) WHERE id=company;
  END IF;result:=jsonb_build_object('practice',true);
 ELSIF command='guidance' THEN
  INSERT INTO public.ts_pilot_preferences VALUES(company,actor,(p->>'dismissed')::boolean,now()) ON CONFLICT(company_id,user_id) DO UPDATE SET dismissed=excluded.dismissed,updated_at=now();result:=jsonb_build_object('dismissed',(p->>'dismissed')::boolean);
 ELSIF command='submit' THEN
  IF (SELECT count(*) FROM public.ts_pilot_feedback WHERE author_id=actor AND created_at>now()-interval '1 hour')>=10 THEN RAISE EXCEPTION 'TS_invalid';END IF;
  INSERT INTO public.ts_pilot_feedback(id,company_id,author_id,kind,task,description,expectation,app_version,route) VALUES((p->>'id')::uuid,company,actor,p->>'kind',p->>'task',p->>'description',coalesce(p->>'expectation',''),p->>'appVersion',p->>'route') RETURNING * INTO f;
  result:=to_jsonb(f);
 ELSIF command='status' THEN
  IF role<>'owner' THEN RAISE EXCEPTION 'TS_denied';END IF;
  SELECT * INTO f FROM public.ts_pilot_feedback WHERE id=(p->>'id')::uuid AND company_id=company FOR UPDATE;
  IF f.id IS NULL THEN RAISE EXCEPTION 'TS_not_found';END IF;
  IF f.revision<>(p->>'revision')::integer OR p->>'revision' IS NULL THEN RAISE EXCEPTION 'TS_conflict';END IF;
  next_status:=p->>'status';IF next_status IS NULL OR next_status NOT IN ('received','investigating','resolved') OR next_status=f.status THEN RAISE EXCEPTION 'TS_invalid';END IF;
  INSERT INTO public.ts_pilot_feedback_history(feedback_id,company_id,actor_id,previous_status,new_status) VALUES(f.id,company,actor,f.status,next_status);
  UPDATE public.ts_pilot_feedback SET status=next_status,revision=revision+1,updated_at=now() WHERE id=f.id RETURNING * INTO f;result:=to_jsonb(f);
 ELSE RAISE EXCEPTION 'TS_invalid';END IF;
 INSERT INTO public.ts_pilot_requests VALUES(company,req,actor,jsonb_build_object('command',command,'p',p),result);RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.ts_pilot_command(text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ts_pilot_command(text,jsonb) TO authenticated;
-- Practice labels flow into existing company/site snapshots and their exports.
CREATE FUNCTION public.ts_practice_label() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 IF TG_TABLE_NAME='ts_companies' THEN
  IF OLD.practice AND NOT NEW.practice THEN RAISE EXCEPTION 'TS_immutable';END IF;
  IF NEW.practice AND NEW.name NOT LIKE 'PRACTICE — %' THEN NEW.name:='PRACTICE — '||left(NEW.name,150);END IF;
 ELSE
  IF EXISTS(SELECT 1 FROM public.ts_companies WHERE id=NEW.company_id AND practice) AND coalesce(NEW.document->>'name','') NOT LIKE 'PRACTICE — %' THEN NEW.document:=jsonb_set(NEW.document,'{name}',to_jsonb('PRACTICE — '||left(NEW.document->>'name',170)));END IF;
 END IF;RETURN NEW;
END $$;
CREATE TRIGGER ts_practice_company BEFORE UPDATE ON public.ts_companies FOR EACH ROW EXECUTE FUNCTION public.ts_practice_label();
CREATE TRIGGER ts_practice_site BEFORE INSERT OR UPDATE ON public.ts_sites FOR EACH ROW EXECUTE FUNCTION public.ts_practice_label();
COMMIT;
