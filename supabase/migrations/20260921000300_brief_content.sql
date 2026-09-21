-- Versioned, source-linked draft content. Existing briefs/versions are never backfilled.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
CREATE TABLE public.ts_brief_content (
 version text PRIMARY KEY CHECK(length(version)<=100), payload jsonb NOT NULL CHECK(jsonb_typeof(payload)='object' AND payload->>'version'=version AND payload->>'reviewStatus'='draft' AND octet_length(payload::text)<60000),
 created_by text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.ts_brief_content_reviewers (
 user_id uuid NOT NULL REFERENCES auth.users(id), version text NOT NULL REFERENCES public.ts_brief_content(version),
 reviewer_name text NOT NULL CHECK(length(trim(reviewer_name)) BETWEEN 1 AND 200),
 qualification_scope text NOT NULL CHECK(length(trim(qualification_scope)) BETWEEN 1 AND 2000),
 authorization_ref text NOT NULL CHECK(length(trim(authorization_ref)) BETWEEN 1 AND 500),
 granted_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL, revoked_at timestamptz,
 PRIMARY KEY(user_id,version)
);
CREATE TABLE public.ts_brief_content_decisions (
 sequence bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, version text NOT NULL REFERENCES public.ts_brief_content(version),
 state text NOT NULL CHECK(state IN ('reviewed','superseded')), actor_id uuid NOT NULL REFERENCES auth.users(id),
 reviewer_name text NOT NULL, qualification_scope text NOT NULL, authorization_ref text NOT NULL,
 decision_ref text NOT NULL CHECK(length(trim(decision_ref)) BETWEEN 1 AND 500), notes text NOT NULL CHECK(length(trim(notes)) BETWEEN 1 AND 2000),
 recorded_at timestamptz NOT NULL DEFAULT now(), request_id uuid NOT NULL, UNIQUE(version,request_id)
);
ALTER TABLE public.ts_brief_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ts_brief_content_reviewers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ts_brief_content_decisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY content_member_read ON public.ts_brief_content FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.ts_members WHERE user_id=auth.uid() AND active));
CREATE POLICY content_decision_member_read ON public.ts_brief_content_decisions FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.ts_members WHERE user_id=auth.uid() AND active));
REVOKE ALL ON public.ts_brief_content,public.ts_brief_content_reviewers,public.ts_brief_content_decisions FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.ts_brief_content,public.ts_brief_content_decisions TO authenticated;
CREATE VIEW public.ts_brief_content_catalog WITH(security_invoker=true) AS
 SELECT c.*,coalesce(d.state,'draft') AS state,to_jsonb(d) AS decision FROM public.ts_brief_content c
 LEFT JOIN LATERAL (SELECT * FROM public.ts_brief_content_decisions WHERE version=c.version ORDER BY sequence DESC LIMIT 1) d ON true;
REVOKE ALL ON public.ts_brief_content_catalog FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.ts_brief_content_catalog TO authenticated;
CREATE TRIGGER content_immutable BEFORE UPDATE OR DELETE ON public.ts_brief_content FOR EACH ROW EXECUTE FUNCTION public.ts_immutable();
CREATE TRIGGER content_decision_immutable BEFORE UPDATE OR DELETE ON public.ts_brief_content_decisions FOR EACH ROW EXECUTE FUNCTION public.ts_immutable();
INSERT INTO public.ts_brief_content(version,payload,created_by) VALUES('on-plumbing-materials-2026-09-21-v1',$content${"version":"on-plumbing-materials-2026-09-21-v1","title":"Moving plumbing materials at ground level","taskId":"plumbing-materials-ground","jurisdiction":"CA-ON","workplace":"construction","authoredBy":"TradeSafe draft-content engineering","authoredAt":"2026-09-21","reviewStatus":"draft","applicability":"Optional pilot for moving pipe, fittings and packaged plumbing supplies along a ground-level Ontario construction route. Confirm this task and context yourself.","limits":"Not a complete assessment or lifting plan. Excludes hoisting, powered-equipment operation, stairs, work at heights, excavation, energized work, hazardous substances and unusual loads. Add other hazards and obtain task-specific direction. No lifting capacity, qualification, compliance or permission to begin work is determined here.","sources":[{"id":"ohsa","authority":"Ontario Legislature","title":"Occupational Health and Safety Act, R.S.O. 1990, c. O.1","url":"https://www.ontario.ca/laws/statute/90o01","download":"https://www.ontario.ca/laws/docs/90o01_e.doc","section":"ss. 25(2)(a),(d),(h), 27(2)(a),(c), 28(1)(c),(d)","kind":"Legislation","jurisdiction":"Ontario; statutory applicability and actual legal roles require assessment","published":null,"effective":null,"consolidationFrom":"2025-11-27","currencyThrough":"2026-09-16","lastAmendment":"2025, c. 13, Sched. 4","retrieved":"2026-09-21","verification":"Verified full official rendered text and displayed consolidation period in ordinary browser. Text-fetch tool returned 403. Currency is the displayed e-Laws date, not the retrieval date; individual amendment commencement dates not separately verified."},{"id":"construction","authority":"Ontario Lieutenant Governor in Council","title":"O. Reg. 213/91: Construction Projects","url":"https://www.ontario.ca/laws/regulation/910213","download":"https://www.ontario.ca/laws/docs/910213_e.doc","section":"Housekeeping: ss. 35(1), 37(1), 38, 39, 45(1)","kind":"Legislation","jurisdiction":"Ontario construction projects; actual project/task applicability must be confirmed","published":null,"effective":null,"consolidationFrom":"2026-04-20","currencyThrough":"2026-09-16","lastAmendment":"O. Reg. 116/26","retrieved":"2026-09-21","verification":"Verified exact sections in full official browser-rendered text. Consolidation period and currency date verified; individual provision commencement dates not separately verified. No search snippet substituted for legislation."},{"id":"ministry-light","authority":"Ontario Ministry of Labour, Immigration, Training and Skills Development","title":"Achieve compliance on construction sites: housekeeping and general requirements","url":"https://www.ontario.ca/page/achieve-compliance-construction-sites-housekeeping-and-general-requirements","section":"Housekeeping: Defining adequately lit; overview and limitations","kind":"Official ministry guidance, not legislation","jurisdiction":"Ontario construction; guidance about O. Reg. 213/91 s. 45","published":"2022-07-28","effective":null,"revised":"2025-10-30","retrieved":"2026-09-21","verification":"Full official browser-rendered page, publication and update dates verified. Referenced Lighting Handbook technical-standard text was not obtained or reproduced; no numeric lighting threshold is included in the pilot."},{"id":"ccohs-mmh","authority":"Canadian Centre for Occupational Health and Safety","title":"MMH - General Practice","url":"https://www.ccohs.ca/oshanswers/ergonomics/mmh/generalpractice.html","section":"What should you do before lifting?","kind":"Supporting guidance, not legislation","jurisdiction":"General Canadian guidance; site/task assessment required","published":null,"effective":null,"revised":"2019-06-04","confirmedCurrent":"2025-01-21","pageModified":"2026-09-17","retrieved":"2026-09-21","verification":"Full public HTML verified, including distinct fact-sheet revision, current-confirmation and page-modified dates."},{"id":"ccohs-flow","authority":"Canadian Centre for Occupational Health and Safety","title":"MMH - Materials Flow","url":"https://www.ccohs.ca/oshanswers/ergonomics/mmh/materials_flow.html","section":"What can be done to reduce the amount of times material is moved or handled?","kind":"Supporting guidance, not legislation","jurisdiction":"General Canadian guidance; proposed application to plumbing supplies","published":null,"effective":null,"revised":"2025-03-12","pageModified":"2025-08-28","retrieved":"2026-09-21","verification":"Full public HTML and displayed fact-sheet/page dates verified."},{"id":"ihsa-mmh","authority":"Infrastructure Health & Safety Association","title":"Safety Talk: Back care — Basic manual material handling","url":"https://www.ihsa.ca/pdfs/safety_talks/back_care_basic_manual-material-handling.pdf","section":"Printed pp. 155–156: Explain dangers; Identify controls; two-person lifting discussion","kind":"Supporting guidance, not legislation","jurisdiction":"Construction guidance; task-specific suitability requires review","published":null,"effective":null,"revised":null,"retrieved":"2026-09-21","verification":"Full two-page public PDF text verified from official IHSA Safety Talks link. No publication/revision date shown in the document. Detailed lifting procedures are not reproduced."}],"prompts":[{"id":"material-route","version":1,"title":"Check the route and destination","wording":"What could obstruct the route or destination, or make hazards hard to see? Record what needs changing and who will check it.","task":"plumbing-materials-ground","applicability":"Before moving supplies on the selected ground-level route, and when site conditions change.","sourceIds":["construction","ministry-light","ccohs-mmh"],"rationale":"Links access, housekeeping and visibility to this movement task.","limits":"Does not measure lighting or determine that a route is safe; other hazards may require a different assessment.","reviewStatus":"draft","reviewQuestions":"Confirm section mapping and whether route/visibility wording is useful without implying a complete access assessment."},{"id":"material-effort","version":1,"title":"Reduce handling effort","wording":"Can this move be avoided or shortened? What suitable handling aid or task-specific help is needed for this load? Record any uncertainty before choosing a control.","task":"plumbing-materials-ground","applicability":"When supplies need to be lifted, carried, pushed or pulled within the pilot scope.","sourceIds":["ccohs-flow","ccohs-mmh","ihsa-mmh"],"rationale":"Encourages reducing manual handling before relying on an individual lifting technique.","limits":"No universal weight limit, team-lift approval, equipment selection or competency assessment. Powered-equipment operation is outside this pilot.","reviewStatus":"draft","reviewQuestions":"Confirm ergonomics scope, exclusions and referral wording for awkward pipe or heavy packaged supplies."},{"id":"material-stability","version":1,"title":"Keep materials stable","wording":"What could roll, shift or fall while supplies are unpacked, moved or set down? Record the proposed restraint or storage arrangement and its responsible person.","task":"plumbing-materials-ground","applicability":"Handling and placing pipe, fittings or packaged supplies; pay attention when removing restraints or packaging.","sourceIds":["construction","ccohs-mmh"],"rationale":"Connects material movement, restraint removal and stable storage to the task.","limits":"Not a rigging plan or engineered storage design. A proposed arrangement is not confirmed implemented.","reviewStatus":"draft","reviewQuestions":"Confirm s. 37(1), 38 and 39 mapping, language for stored pipe, and limits on non-engineered suggestions."},{"id":"material-briefing","version":1,"title":"Discuss concerns before the move","wording":"What does the crew need to know about this move, and which concerns remain unresolved? Record who was actually told and any pause; saving alone sends no message.","task":"plumbing-materials-ground","applicability":"Before briefing the participating crew, and after a material change to the task or controls.","sourceIds":["ohsa","ihsa-mmh"],"rationale":"Supports a task discussion and an accurate communication record.","limits":"App roles are not legal-role appointments. Attendance and acknowledgement do not establish understanding, qualifications or work authorization; app pause is not the statutory refusal process.","reviewStatus":"draft","reviewQuestions":"Confirm duty attribution and that communication/acknowledgement wording cannot be read as discharging statutory obligations."}]}$content$::jsonb,'TradeSafe draft-content engineering');
-- Reviewer appointments require a separately authorized operator action with verified
-- identity, qualification scope, decision reference and expiry. No grant is seeded.
CREATE FUNCTION public.ts_review_brief_content(p jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE a uuid:=auth.uid(); g public.ts_brief_content_reviewers; old public.ts_brief_content_decisions; result public.ts_brief_content_decisions; previous text;
BEGIN
 IF a IS NULL THEN RAISE EXCEPTION 'TS_unauthorized'; END IF;
 IF p IS NULL OR jsonb_typeof(p)<>'object' OR octet_length(p::text)>6000 OR p->>'state' NOT IN ('reviewed','superseded') OR p->>'state' IS NULL OR p->>'requestId' IS NULL THEN RAISE EXCEPTION 'TS_invalid'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.ts_members WHERE user_id=a AND active) THEN RAISE EXCEPTION 'TS_denied'; END IF;
 SELECT * INTO g FROM public.ts_brief_content_reviewers WHERE user_id=a AND version=p->>'version' AND revoked_at IS NULL AND expires_at>now();
 IF NOT FOUND THEN RAISE EXCEPTION 'TS_denied'; END IF;
 PERFORM 1 FROM public.ts_brief_content WHERE version=g.version FOR UPDATE;
 SELECT * INTO old FROM public.ts_brief_content_decisions WHERE version=g.version AND request_id=(p->>'requestId')::uuid;
 IF FOUND THEN
  IF old.actor_id<>a OR old.state<>p->>'state' OR old.decision_ref IS DISTINCT FROM p->>'decisionRef' OR old.notes IS DISTINCT FROM p->>'notes' THEN RAISE EXCEPTION 'TS_conflict'; END IF;
  RETURN to_jsonb(old);
 END IF;
 SELECT state INTO previous FROM public.ts_brief_content_decisions WHERE version=g.version ORDER BY sequence DESC LIMIT 1;
 IF coalesce(previous,'draft') IS DISTINCT FROM p->>'expectedState' OR previous='superseded' OR previous=p->>'state' THEN RAISE EXCEPTION 'TS_conflict'; END IF;
 INSERT INTO public.ts_brief_content_decisions(version,state,actor_id,reviewer_name,qualification_scope,authorization_ref,decision_ref,notes,request_id)
 VALUES(g.version,p->>'state',a,g.reviewer_name,g.qualification_scope,g.authorization_ref,p->>'decisionRef',p->>'notes',(p->>'requestId')::uuid) RETURNING * INTO result;
 RETURN to_jsonb(result);
END $$;
REVOKE ALL ON FUNCTION public.ts_review_brief_content(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ts_review_brief_content(jsonb) TO authenticated;
CREATE FUNCTION public.ts_brief_content_review_permission(content_version text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT EXISTS(SELECT 1 FROM public.ts_brief_content_reviewers WHERE user_id=auth.uid() AND version=content_version AND revoked_at IS NULL AND expires_at>now()) AND EXISTS(SELECT 1 FROM public.ts_members WHERE user_id=auth.uid() AND active)
$$;
REVOKE ALL ON FUNCTION public.ts_brief_content_review_permission(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ts_brief_content_review_permission(text) TO authenticated;
CREATE OR REPLACE FUNCTION public.ts_validate_brief(d jsonb,c uuid,complete boolean) RETURNS void LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE k text; step jsonb; u text;
BEGIN
 IF d IS NULL OR jsonb_typeof(d)<>'object' OR octet_length(d::text)>80000 THEN RAISE EXCEPTION 'TS_invalid'; END IF;
 FOR k IN SELECT jsonb_object_keys(d) LOOP
  IF k NOT IN ('site','date','task','contact','jurisdiction','workplace','confirmed','crew','steps','paused','pauseReason','communication','attendance','briefingNote','contentVersion','promptTask') THEN RAISE EXCEPTION 'TS_invalid'; END IF;
 END LOOP;
 IF d ? 'contentVersion' AND (jsonb_typeof(d->'contentVersion') IS DISTINCT FROM 'string' OR NOT EXISTS(SELECT 1 FROM public.ts_brief_content WHERE version=d->>'contentVersion')) THEN RAISE EXCEPTION 'TS_invalid'; END IF;
 IF d ? 'promptTask' AND (jsonb_typeof(d->'promptTask') IS DISTINCT FROM 'string' OR length(d->>'promptTask')>100) THEN RAISE EXCEPTION 'TS_invalid'; END IF;
 IF coalesce(d->>'promptTask','')<>'' AND (d->>'jurisdiction'<>'CA-ON' OR d->>'workplace'<>'construction' OR NOT EXISTS(SELECT 1 FROM public.ts_brief_content WHERE version=d->>'contentVersion' AND payload->>'taskId'=d->>'promptTask')) THEN RAISE EXCEPTION 'TS_invalid'; END IF;
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
  IF p ? 'contentVersion' THEN
   IF jsonb_typeof(p->'contentVersion') IS DISTINCT FROM 'string' OR NOT EXISTS(SELECT 1 FROM public.ts_brief_content WHERE version=p->>'contentVersion') THEN RAISE EXCEPTION 'TS_invalid'; END IF;
   d:=d||jsonb_build_object('contentVersion',p->>'contentVersion','promptTask','');
  END IF;
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
   VALUES(target,b.revision,c,jsonb_build_object('document',b.document,'people',names,'company',(SELECT name FROM public.ts_companies WHERE id=c),'sourceVersion',coalesce(b.document->>'contentVersion','unknown'),'content',(SELECT to_jsonb(x) FROM public.ts_brief_content_catalog x WHERE x.version=b.document->>'contentVersion')),attendance,b.document->>'briefingNote',actor,req);
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
