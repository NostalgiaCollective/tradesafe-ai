-- Preserve existing Actions assignment permissions: recording control responsibility
-- is distinct from assigning follow-up work. Worker-created follow-ups start assigned
-- to their recorder; existing supervisor/owner reassignment remains in ts_command.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
CREATE OR REPLACE FUNCTION public.ts_brief_command(command text,p jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
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
     VALUES(c,target,b.revision,s->>'id',s->>'hazard',s->>'control',CASE WHEN role_name='worker' THEN actor ELSE (s->>'responsible')::uuid END)
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
