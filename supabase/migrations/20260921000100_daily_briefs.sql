-- New staging-only recording workflow. No installation content or historical record is changed.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
CREATE TABLE public.ts_briefs (
 id uuid PRIMARY KEY, company_id uuid NOT NULL REFERENCES public.ts_companies(id) ON DELETE RESTRICT,
 author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 document jsonb NOT NULL, revision integer NOT NULL DEFAULT 1,
 lifecycle text NOT NULL DEFAULT 'draft' CHECK(lifecycle IN ('draft','recorded')),
 last_request uuid, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(company_id,id)
);
CREATE TABLE public.ts_brief_versions (
 brief_id uuid NOT NULL REFERENCES public.ts_briefs(id) ON DELETE RESTRICT, version integer NOT NULL,
 company_id uuid NOT NULL, snapshot jsonb NOT NULL, attendance uuid[] NOT NULL,
 briefing_note text NOT NULL, recorded_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 recorded_at timestamptz NOT NULL DEFAULT now(), request_id uuid NOT NULL,
 PRIMARY KEY(brief_id,version), FOREIGN KEY(company_id,brief_id) REFERENCES public.ts_briefs(company_id,id) ON DELETE RESTRICT
);
CREATE TABLE public.ts_brief_acknowledgements (
 brief_id uuid NOT NULL, version integer NOT NULL, company_id uuid NOT NULL,
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT, acknowledged_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(brief_id,version,user_id), FOREIGN KEY(brief_id,version) REFERENCES public.ts_brief_versions(brief_id,version) ON DELETE RESTRICT,
 FOREIGN KEY(company_id,brief_id) REFERENCES public.ts_briefs(company_id,id) ON DELETE RESTRICT
);
CREATE TABLE public.ts_brief_reviews (
 brief_id uuid NOT NULL, version integer NOT NULL, item_id text NOT NULL, company_id uuid NOT NULL,
 reviewed_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT, reviewed_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(brief_id,version,item_id), FOREIGN KEY(brief_id,version) REFERENCES public.ts_brief_versions(brief_id,version) ON DELETE RESTRICT,
 FOREIGN KEY(company_id,brief_id) REFERENCES public.ts_briefs(company_id,id) ON DELETE RESTRICT
);
ALTER TABLE public.ts_actions ADD COLUMN brief_id uuid REFERENCES public.ts_briefs(id) ON DELETE RESTRICT;
ALTER TABLE public.ts_actions ADD COLUMN brief_version integer;
ALTER TABLE public.ts_actions ALTER COLUMN report_id DROP NOT NULL;
ALTER TABLE public.ts_actions ADD CONSTRAINT ts_action_origin CHECK (
 (report_id IS NOT NULL AND brief_id IS NULL AND brief_version IS NULL) OR
 (report_id IS NULL AND brief_id IS NOT NULL AND brief_version IS NOT NULL)
);
ALTER TABLE public.ts_actions ADD CONSTRAINT ts_action_brief_version FOREIGN KEY(brief_id,brief_version) REFERENCES public.ts_brief_versions(brief_id,version) ON DELETE RESTRICT;
ALTER TABLE public.ts_actions ADD CONSTRAINT ts_action_brief_company FOREIGN KEY(company_id,brief_id) REFERENCES public.ts_briefs(company_id,id) ON DELETE RESTRICT;
CREATE UNIQUE INDEX ts_action_brief_item ON public.ts_actions(brief_id,item_id) WHERE brief_id IS NOT NULL;
CREATE INDEX ts_briefs_company_date ON public.ts_briefs(company_id,updated_at DESC);

ALTER TABLE public.ts_briefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ts_brief_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ts_brief_acknowledgements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ts_brief_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY brief_read ON public.ts_briefs FOR SELECT TO authenticated USING(public.ts_role(company_id) IS NOT NULL);
CREATE POLICY brief_version_read ON public.ts_brief_versions FOR SELECT TO authenticated USING(public.ts_role(company_id) IS NOT NULL);
CREATE POLICY brief_ack_read ON public.ts_brief_acknowledgements FOR SELECT TO authenticated USING(public.ts_role(company_id) IS NOT NULL);
CREATE POLICY brief_review_read ON public.ts_brief_reviews FOR SELECT TO authenticated USING(public.ts_role(company_id) IS NOT NULL);
REVOKE ALL ON public.ts_briefs,public.ts_brief_versions,public.ts_brief_acknowledgements,public.ts_brief_reviews FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.ts_briefs,public.ts_brief_versions,public.ts_brief_acknowledgements,public.ts_brief_reviews TO authenticated;
CREATE TRIGGER ts_brief_version_immutable BEFORE UPDATE OR DELETE ON public.ts_brief_versions FOR EACH ROW EXECUTE FUNCTION public.ts_immutable();
CREATE TRIGGER ts_brief_ack_immutable BEFORE UPDATE OR DELETE ON public.ts_brief_acknowledgements FOR EACH ROW EXECUTE FUNCTION public.ts_immutable();
CREATE TRIGGER ts_brief_review_immutable BEFORE UPDATE OR DELETE ON public.ts_brief_reviews FOR EACH ROW EXECUTE FUNCTION public.ts_immutable();

CREATE FUNCTION public.ts_validate_brief(d jsonb,c uuid,complete boolean) RETURNS void LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE k text; step jsonb; u text;
BEGIN
 IF d IS NULL OR jsonb_typeof(d)<>'object' OR octet_length(d::text)>80000 THEN RAISE EXCEPTION 'TS_invalid'; END IF;
 FOR k IN SELECT jsonb_object_keys(d) LOOP
  IF k NOT IN ('site','date','task','contact','jurisdiction','workplace','confirmed','crew','steps','paused','pauseReason','communication','attendance','briefingNote') THEN RAISE EXCEPTION 'TS_invalid'; END IF;
 END LOOP;
 FOREACH k IN ARRAY ARRAY['site','date','task','contact','jurisdiction','workplace','pauseReason','communication','briefingNote'] LOOP
  IF jsonb_typeof(d->k) IS DISTINCT FROM 'string' OR length(d->>k)>2000 THEN RAISE EXCEPTION 'TS_invalid'; END IF;
 END LOOP;
 IF d->>'jurisdiction' NOT IN ('','CA-ON','other') OR d->>'workplace' NOT IN ('','construction','other')
 OR jsonb_typeof(d->'confirmed') IS DISTINCT FROM 'boolean' OR jsonb_typeof(d->'paused') IS DISTINCT FROM 'boolean'
 OR jsonb_typeof(d->'crew') IS DISTINCT FROM 'array' OR jsonb_array_length(d->'crew')>50
 OR jsonb_typeof(d->'attendance') IS DISTINCT FROM 'array' OR jsonb_array_length(d->'attendance')>50
 OR jsonb_typeof(d->'steps') IS DISTINCT FROM 'array' OR jsonb_array_length(d->'steps')>20 THEN RAISE EXCEPTION 'TS_invalid'; END IF;
 IF d->>'date'<>'' THEN
  IF d->>'date' !~ '^\d{4}-\d{2}-\d{2}$' THEN RAISE EXCEPTION 'TS_invalid'; END IF;
  PERFORM (d->>'date')::date;
 END IF;
 IF (SELECT count(*)<>count(DISTINCT value) FROM jsonb_array_elements_text(d->'crew')) THEN RAISE EXCEPTION 'TS_invalid'; END IF;
 FOR u IN SELECT jsonb_array_elements_text(d->'crew') LOOP
  IF NOT EXISTS(SELECT 1 FROM public.ts_members WHERE company_id=c AND user_id=u::uuid AND active) THEN RAISE EXCEPTION 'TS_denied'; END IF;
 END LOOP;
 FOR u IN SELECT jsonb_array_elements_text(d->'attendance') LOOP
  IF NOT d->'crew' ? u THEN RAISE EXCEPTION 'TS_invalid'; END IF;
 END LOOP;
 IF (SELECT count(*)<>count(DISTINCT value->>'id') FROM jsonb_array_elements(d->'steps')) THEN RAISE EXCEPTION 'TS_invalid'; END IF;
 FOR step IN SELECT * FROM jsonb_array_elements(d->'steps') LOOP
  IF jsonb_typeof(step)<>'object' THEN RAISE EXCEPTION 'TS_invalid'; END IF;
  FOR k IN SELECT jsonb_object_keys(step) LOOP
   IF k NOT IN ('id','task','hazard','control','controlState','responsible','unresolved') THEN RAISE EXCEPTION 'TS_invalid'; END IF;
  END LOOP;
  FOREACH k IN ARRAY ARRAY['id','task','hazard','control','controlState','responsible'] LOOP
   IF jsonb_typeof(step->k) IS DISTINCT FROM 'string' OR length(step->>k)>2000 THEN RAISE EXCEPTION 'TS_invalid'; END IF;
  END LOOP;
  PERFORM (step->>'id')::uuid;
  IF step->>'id'='' OR step->>'controlState' NOT IN ('proposed','reported_implemented') OR jsonb_typeof(step->'unresolved') IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION 'TS_invalid'; END IF;
  IF step->>'responsible'<>'' AND NOT EXISTS(SELECT 1 FROM public.ts_members WHERE company_id=c AND user_id=(step->>'responsible')::uuid AND active) THEN RAISE EXCEPTION 'TS_denied'; END IF;
  IF complete AND (length(trim(step->>'task'))=0 OR length(trim(step->>'hazard'))=0 OR length(trim(step->>'control'))=0 OR step->>'responsible'='') THEN RAISE EXCEPTION 'TS_incomplete'; END IF;
 END LOOP;
 IF complete AND (length(trim(d->>'site'))=0 OR d->>'date'='' OR length(trim(d->>'task'))=0 OR length(trim(d->>'contact'))=0
 OR d->>'jurisdiction'='' OR d->>'workplace'='' OR d->>'confirmed'<>'true' OR jsonb_array_length(d->'crew')=0 OR jsonb_array_length(d->'steps')=0
 OR (d->>'paused'='true' AND length(trim(d->>'pauseReason'))=0)) THEN RAISE EXCEPTION 'TS_incomplete'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.ts_validate_brief(jsonb,uuid,boolean) FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.ts_brief_command(command text,p jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE actor uuid:=auth.uid(); c uuid; target uuid; role_name text; b public.ts_briefs; v public.ts_brief_versions;
 d jsonb; s jsonb; u text; names jsonb; attendance uuid[]; action_id uuid; req uuid;
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'TS_unauthorized'; END IF;
 IF p IS NULL OR jsonb_typeof(p)<>'object' OR octet_length(p::text)>90000 THEN RAISE EXCEPTION 'TS_invalid'; END IF;
 c:=(p->>'companyId')::uuid; target:=(p->>'id')::uuid; req:=(p->>'requestId')::uuid;
 IF c IS NULL OR target IS NULL OR req IS NULL THEN RAISE EXCEPTION 'TS_invalid'; END IF;
 PERFORM 1 FROM public.ts_companies WHERE id=c FOR UPDATE;
 role_name:=public.ts_role(c); IF role_name IS NULL THEN RAISE EXCEPTION 'TS_denied'; END IF;
 SELECT * INTO b FROM public.ts_briefs WHERE id=target FOR UPDATE;
 IF command='create' THEN
  IF FOUND THEN
   IF b.company_id<>c OR b.author_id<>actor THEN RAISE EXCEPTION 'TS_denied'; END IF;
   RETURN to_jsonb(b);
  END IF;
  IF (SELECT count(*) FROM public.ts_briefs WHERE company_id=c AND created_at>now()-interval '1 day')>=100 THEN RAISE EXCEPTION 'TS_invalid'; END IF;
   d:=jsonb_build_object('site','','date','','task','','contact','','jurisdiction','','workplace','','confirmed',false,'crew','[]'::jsonb,'steps','[]'::jsonb,'paused',false,'pauseReason','','communication','','attendance','[]'::jsonb,'briefingNote','');
  IF p->>'reuseId' IS NOT NULL THEN
   SELECT * INTO b FROM public.ts_briefs WHERE id=(p->>'reuseId')::uuid AND company_id=c;
   IF NOT FOUND THEN RAISE EXCEPTION 'TS_not_found'; END IF;
   d:=d||jsonb_build_object('site',b.document->'site','contact',b.document->'contact');
  END IF;
  INSERT INTO public.ts_briefs(id,company_id,author_id,document,last_request) VALUES(target,c,actor,d,req) RETURNING * INTO b;
 ELSIF command IN ('save','revise','record','acknowledge','review_control') THEN
  IF b.id IS NULL OR b.company_id<>c THEN RAISE EXCEPTION 'TS_not_found'; END IF;
  IF command IN ('save','revise','record') AND role_name='worker' AND b.author_id<>actor THEN RAISE EXCEPTION 'TS_denied'; END IF;
  IF command IN ('save','revise') AND b.last_request=req THEN RETURN to_jsonb(b); END IF;
  IF command IN ('save','revise','record') AND (p->>'revision')::integer IS DISTINCT FROM b.revision THEN RAISE EXCEPTION 'TS_conflict'; END IF;
  IF command='save' THEN
   IF b.lifecycle<>'draft' THEN RAISE EXCEPTION 'TS_immutable'; END IF;
   PERFORM public.ts_validate_brief(p->'document',c,false);
   IF b.document=p->'document' THEN RETURN to_jsonb(b); END IF;
   UPDATE public.ts_briefs SET document=p->'document',revision=revision+1,last_request=req,updated_at=now() WHERE id=target RETURNING * INTO b;
  ELSIF command='revise' THEN
   IF b.lifecycle<>'recorded' THEN RAISE EXCEPTION 'TS_conflict'; END IF;
   UPDATE public.ts_briefs SET lifecycle='draft',document=document||jsonb_build_object('attendance','[]'::jsonb,'briefingNote',''),revision=revision+1,last_request=req,updated_at=now() WHERE id=target RETURNING * INTO b;
  ELSIF command='record' THEN
   SELECT * INTO v FROM public.ts_brief_versions WHERE brief_id=target AND version=b.revision;
   IF FOUND THEN
    IF v.request_id=req AND v.recorded_by=actor THEN RETURN to_jsonb(b); END IF;
    RAISE EXCEPTION 'TS_conflict';
   END IF;
   IF b.lifecycle<>'draft' THEN RAISE EXCEPTION 'TS_immutable'; END IF;
   PERFORM public.ts_validate_brief(b.document,c,true);
   IF length(trim(b.document->>'briefingNote'))=0 THEN RAISE EXCEPTION 'TS_incomplete'; END IF;
   attendance:='{}';
   FOR u IN SELECT jsonb_array_elements_text(b.document->'attendance') LOOP
    IF NOT b.document->'crew' ? u THEN RAISE EXCEPTION 'TS_denied'; END IF;
    IF NOT u::uuid=ANY(attendance) THEN attendance:=array_append(attendance,u::uuid); END IF;
   END LOOP;
   SELECT jsonb_agg(jsonb_build_object('id',user_id,'name',display_name) ORDER BY user_id) INTO names FROM public.ts_members WHERE company_id=c AND (b.document->'crew' ? user_id::text OR user_id=actor OR EXISTS(SELECT 1 FROM jsonb_array_elements(b.document->'steps') x WHERE x->>'responsible'=user_id::text));
   INSERT INTO public.ts_brief_versions(brief_id,version,company_id,snapshot,attendance,briefing_note,recorded_by,request_id)
   VALUES(target,b.revision,c,jsonb_build_object('document',b.document,'people',names,'company',(SELECT name FROM public.ts_companies WHERE id=c),'sourceVersion','on-construction-2026-09-21-draft-1'),attendance,b.document->>'briefingNote',actor,req);
   FOR s IN SELECT * FROM jsonb_array_elements(b.document->'steps') LOOP
    IF s->>'unresolved'='true' THEN
     action_id:=NULL;
     INSERT INTO public.ts_actions(company_id,brief_id,brief_version,item_id,observation,controls,responsible_id)
     VALUES(c,target,b.revision,s->>'id',s->>'hazard',s->>'control',(s->>'responsible')::uuid)
     ON CONFLICT(brief_id,item_id) WHERE brief_id IS NOT NULL DO NOTHING RETURNING id INTO action_id;
     IF action_id IS NOT NULL THEN INSERT INTO public.ts_events(company_id,actor_id,kind,entity_id,after_value) VALUES(c,actor,'action_opened',action_id,jsonb_build_object('state','open','brief_id',target,'version',b.revision)); END IF;
    END IF;
   END LOOP;
   UPDATE public.ts_briefs SET lifecycle='recorded',last_request=req,updated_at=now() WHERE id=target RETURNING * INTO b;
  ELSE
   IF b.lifecycle<>'recorded' OR (p->>'version')::integer IS DISTINCT FROM b.revision THEN RAISE EXCEPTION 'TS_conflict'; END IF;
   SELECT * INTO v FROM public.ts_brief_versions WHERE brief_id=target AND version=b.revision;
   IF command='acknowledge' THEN
    IF NOT v.snapshot->'document'->'crew' ? actor::text THEN RAISE EXCEPTION 'TS_denied'; END IF;
    INSERT INTO public.ts_brief_acknowledgements(brief_id,version,company_id,user_id) VALUES(target,b.revision,c,actor) ON CONFLICT DO NOTHING;
   ELSE
    IF role_name NOT IN ('owner','supervisor') THEN RAISE EXCEPTION 'TS_denied'; END IF;
    IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(v.snapshot->'document'->'steps') x WHERE x->>'id'=p->>'itemId' AND x->>'controlState'='reported_implemented') THEN RAISE EXCEPTION 'TS_incomplete'; END IF;
    INSERT INTO public.ts_brief_reviews(brief_id,version,item_id,company_id,reviewed_by) VALUES(target,b.revision,p->>'itemId',c,actor) ON CONFLICT DO NOTHING;
   END IF;
   RETURN to_jsonb(b);
  END IF;
 ELSE RAISE EXCEPTION 'TS_invalid'; END IF;
 INSERT INTO public.ts_events(company_id,actor_id,kind,entity_id,after_value) VALUES(c,actor,'brief_'||command,target,jsonb_build_object('revision',b.revision,'lifecycle',b.lifecycle));
 RETURN to_jsonb(b);
END $$;
REVOKE ALL ON FUNCTION public.ts_brief_command(text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ts_brief_command(text,jsonb) TO authenticated;
COMMIT;
