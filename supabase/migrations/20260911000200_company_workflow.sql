-- Phase 2 additive workflow. Apply only to isolated staging after reviewed inventory.
-- Historical tables/data survive. Separate per-user legacy companies; never name/domain merging.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

CREATE TABLE public.ts_companies (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 200),
 business jsonb NOT NULL DEFAULT '{}', legacy_profiles jsonb NOT NULL DEFAULT '{}',
 legacy_owner_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE RESTRICT,
 created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 revision integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.ts_members (
 company_id uuid REFERENCES public.ts_companies(id) ON DELETE RESTRICT,
 user_id uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
 role text NOT NULL CHECK(role IN ('owner','supervisor','worker')), active boolean NOT NULL DEFAULT true,
 display_name text NOT NULL, joined_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(company_id,user_id)
);
CREATE TABLE public.ts_invitations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES public.ts_companies(id) ON DELETE RESTRICT,
 email text NOT NULL, role text NOT NULL CHECK(role IN ('owner','supervisor','worker')),
 token_hash text NOT NULL UNIQUE, expires_at timestamptz NOT NULL DEFAULT now()+interval '7 days',
 accepted_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT, revoked boolean NOT NULL DEFAULT false,
 created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.ts_templates (
 id text PRIMARY KEY, trade text NOT NULL CHECK(trade IN ('electrical','plumbing','roofing')),
 version text NOT NULL, snapshot jsonb NOT NULL, UNIQUE(trade,version)
);
CREATE TABLE public.ts_reports (
 id uuid PRIMARY KEY, company_id uuid NOT NULL REFERENCES public.ts_companies(id) ON DELETE RESTRICT,
 author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 template_id text NOT NULL REFERENCES public.ts_templates(id) ON DELETE RESTRICT,
 template_snapshot jsonb NOT NULL, business_snapshot jsonb NOT NULL,
 document jsonb NOT NULL, lifecycle text NOT NULL DEFAULT 'draft' CHECK(lifecycle IN ('draft','finalized')),
 revision integer NOT NULL DEFAULT 1, last_request uuid,
 amendment_of uuid REFERENCES public.ts_reports(id) ON DELETE RESTRICT, amendment_reason text,
 finalized_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT, finalized_at timestamptz,
 snapshot_version integer, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK((lifecycle='draft' AND finalized_at IS NULL AND finalized_by IS NULL AND snapshot_version IS NULL) OR
       (lifecycle='finalized' AND finalized_at IS NOT NULL AND finalized_by IS NOT NULL AND snapshot_version=1))
);
CREATE INDEX ts_reports_company_date ON public.ts_reports(company_id,updated_at DESC,id);
CREATE TABLE public.ts_actions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES public.ts_companies(id) ON DELETE RESTRICT,
 report_id uuid NOT NULL REFERENCES public.ts_reports(id) ON DELETE RESTRICT, item_id text NOT NULL,
 observation text NOT NULL, controls text NOT NULL DEFAULT '', responsible_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 target_date date, state text NOT NULL DEFAULT 'open' CHECK(state IN ('open','in_progress','awaiting_verification','closed')),
 resolution text NOT NULL DEFAULT '', verified_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT, verified_at timestamptz,
 revision integer NOT NULL DEFAULT 1, last_request uuid, UNIQUE(report_id,item_id),
 CHECK((state='closed' AND verified_by IS NOT NULL AND verified_at IS NOT NULL AND length(trim(resolution))>0) OR
       (state<>'closed' AND verified_by IS NULL AND verified_at IS NULL))
);
CREATE INDEX ts_actions_company_responsible ON public.ts_actions(company_id,responsible_id,state);
CREATE TABLE public.ts_events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, company_id uuid NOT NULL REFERENCES public.ts_companies(id) ON DELETE RESTRICT,
 actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT, kind text NOT NULL, entity_id uuid NOT NULL,
 before_value jsonb, after_value jsonb, occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ts_events_company_entity ON public.ts_events(company_id,entity_id,id);
CREATE TABLE public.ts_legacy_reports (
 report_id uuid PRIMARY KEY REFERENCES public.reports(id) ON DELETE RESTRICT,
 company_id uuid NOT NULL REFERENCES public.ts_companies(id) ON DELETE RESTRICT
);

-- Definer functions have fixed search paths, explicit schema names, and no arbitrary SQL.
CREATE FUNCTION public.ts_role(c uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER
SET search_path=pg_catalog,public AS $$
 SELECT role FROM public.ts_members WHERE company_id=c AND user_id=auth.uid() AND active
$$;
REVOKE ALL ON FUNCTION public.ts_role(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ts_role(uuid) TO authenticated;

ALTER TABLE public.ts_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ts_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ts_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ts_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ts_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ts_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ts_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ts_legacy_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY company_read ON public.ts_companies FOR SELECT TO authenticated USING(public.ts_role(id) IS NOT NULL);
CREATE POLICY member_read ON public.ts_members FOR SELECT TO authenticated USING(public.ts_role(company_id) IS NOT NULL);
CREATE POLICY invitation_read ON public.ts_invitations FOR SELECT TO authenticated USING(public.ts_role(company_id)='owner');
CREATE POLICY template_read ON public.ts_templates FOR SELECT TO authenticated USING(true);
CREATE POLICY report_read ON public.ts_reports FOR SELECT TO authenticated USING(public.ts_role(company_id) IS NOT NULL);
CREATE POLICY action_read ON public.ts_actions FOR SELECT TO authenticated USING(public.ts_role(company_id) IS NOT NULL);
CREATE POLICY event_read ON public.ts_events FOR SELECT TO authenticated USING(public.ts_role(company_id) IS NOT NULL);
CREATE POLICY legacy_link_read ON public.ts_legacy_reports FOR SELECT TO authenticated USING(public.ts_role(company_id) IS NOT NULL);
REVOKE ALL ON public.ts_companies,public.ts_members,public.ts_invitations,public.ts_templates,public.ts_reports,public.ts_actions,public.ts_events,public.ts_legacy_reports FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.ts_companies,public.ts_members,public.ts_invitations,public.ts_templates,public.ts_reports,public.ts_actions,public.ts_events,public.ts_legacy_reports TO authenticated;

-- Preserve both originals even when their values conflict. Precedence is explicit, not a merge.
INSERT INTO public.ts_companies(name,business,legacy_profiles,legacy_owner_id,created_by)
SELECT coalesce(nullif(trim(cp.business_name),''),nullif(trim(p.business_name),''),'Imported business'),
 coalesce(to_jsonb(cp)-'user_id'-'created_at'-'updated_at',to_jsonb(p)-'id'-'created_at','{}'::jsonb),
 jsonb_build_object('contractor_profile',to_jsonb(cp),'profile',to_jsonb(p)),u.id,u.id
FROM auth.users u LEFT JOIN public.contractor_profiles cp ON cp.user_id=u.id LEFT JOIN public.profiles p ON p.id=u.id
WHERE cp.user_id IS NOT NULL OR p.id IS NOT NULL OR EXISTS(SELECT 1 FROM public.reports r WHERE r.user_id=u.id)
 OR EXISTS(SELECT 1 FROM public.crew_members m WHERE m.user_id=u.id);
INSERT INTO public.ts_members(company_id,user_id,role,display_name)
SELECT c.id,c.legacy_owner_id,'owner',coalesce(u.email,'Legacy account') FROM public.ts_companies c JOIN auth.users u ON u.id=c.legacy_owner_id;
INSERT INTO public.ts_legacy_reports SELECT r.id,c.id FROM public.reports r JOIN public.ts_companies c ON c.legacy_owner_id=r.user_id;

-- Freeze historical values, including payment metadata. Original records are not reinterpreted.
CREATE FUNCTION public.ts_immutable() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN RAISE EXCEPTION 'TS_immutable'; END $$;
CREATE TRIGGER ts_legacy_readonly BEFORE INSERT OR UPDATE OR DELETE ON public.reports FOR EACH ROW EXECUTE FUNCTION public.ts_immutable();
REVOKE INSERT,UPDATE,DELETE ON public.reports,public.profiles,public.contractor_profiles,public.crew_members FROM PUBLIC,anon,authenticated;
CREATE POLICY ts_legacy_members ON public.reports FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.ts_legacy_reports l WHERE l.report_id=id AND public.ts_role(l.company_id) IS NOT NULL));
CREATE POLICY ts_legacy_members_required ON public.reports AS RESTRICTIVE FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.ts_legacy_reports l WHERE l.report_id=id AND public.ts_role(l.company_id) IS NOT NULL));
CREATE TRIGGER ts_event_readonly BEFORE UPDATE OR DELETE ON public.ts_events FOR EACH ROW EXECUTE FUNCTION public.ts_immutable();
CREATE TRIGGER ts_template_readonly BEFORE UPDATE OR DELETE ON public.ts_templates FOR EACH ROW EXECUTE FUNCTION public.ts_immutable();
CREATE FUNCTION public.ts_snapshot_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 IF OLD.lifecycle='finalized' THEN RAISE EXCEPTION 'TS_immutable'; END IF;
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'TS_immutable'; END IF;
 IF NEW.company_id<>OLD.company_id OR NEW.author_id<>OLD.author_id OR NEW.template_snapshot<>OLD.template_snapshot
 OR NEW.template_id<>OLD.template_id OR NEW.business_snapshot<>OLD.business_snapshot OR NEW.amendment_of IS DISTINCT FROM OLD.amendment_of THEN RAISE EXCEPTION 'TS_immutable'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER ts_snapshot_guard BEFORE UPDATE OR DELETE ON public.ts_reports FOR EACH ROW EXECUTE FUNCTION public.ts_snapshot_guard();

CREATE FUNCTION public.ts_validate_document(d jsonb,t jsonb,final boolean) RETURNS void LANGUAGE plpgsql
SET search_path=pg_catalog,public AS $$
DECLARE i jsonb; a jsonb; k text; s text;
BEGIN
 IF d IS NULL OR jsonb_typeof(d)<>'object' OR octet_length(d::text)>100000 OR jsonb_typeof(d->'job') IS DISTINCT FROM 'object'
 OR jsonb_typeof(d->'answers') IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'TS_invalid'; END IF;
 FOR k IN SELECT jsonb_object_keys(d) LOOP IF k NOT IN ('job','answers') THEN RAISE EXCEPTION 'TS_invalid'; END IF; END LOOP;
 FOREACH k IN ARRAY ARRAY['address','client','date'] LOOP
  IF jsonb_typeof(d->'job'->k) IS DISTINCT FROM 'string' OR length(d->'job'->>k)>1000 THEN RAISE EXCEPTION 'TS_invalid'; END IF;
 END LOOP;
 IF (d->'job'->>'date')<>'' THEN
  IF (d->'job'->>'date') !~ '^\d{4}-\d{2}-\d{2}$' THEN RAISE EXCEPTION 'TS_invalid'; END IF;
  PERFORM (d->'job'->>'date')::date;
 END IF;
 FOR k,a IN SELECT * FROM jsonb_each(d->'answers') LOOP
  IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(t->'items') x WHERE x->>'id'=k) OR jsonb_typeof(a)<>'object'
  OR coalesce(a->>'state','') NOT IN ('unanswered','meets','attention','not_applicable','unable')
  OR jsonb_typeof(a->'note') IS DISTINCT FROM 'string' OR jsonb_typeof(a->'controls') IS DISTINCT FROM 'string'
  OR length(a->>'note')>4000 OR length(a->>'controls')>4000 THEN RAISE EXCEPTION 'TS_invalid'; END IF;
 END LOOP;
 IF final THEN
  IF length(trim(d->'job'->>'address'))=0 OR coalesce(d->'job'->>'date','')='' THEN RAISE EXCEPTION 'TS_incomplete'; END IF;
  FOR i IN SELECT * FROM jsonb_array_elements(t->'items') LOOP
   a:=d->'answers'->(i->>'id'); s:=coalesce(a->>'state','unanswered');
   IF s='unanswered' OR (s<>'meets' AND length(trim(coalesce(a->>'note','')))=0) THEN RAISE EXCEPTION 'TS_incomplete'; END IF;
  END LOOP;
 END IF;
END $$;
REVOKE ALL ON FUNCTION public.ts_validate_document(jsonb,jsonb,boolean) FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.ts_command(command text,p jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public AS $$
DECLARE actor uuid:=auth.uid(); c uuid; role_name text; target uuid; r public.ts_reports; oldr public.ts_reports;
 comp public.ts_companies; inv public.ts_invitations; act public.ts_actions; before_act jsonb;
 t public.ts_templates; d jsonb; item jsonb; answer jsonb; mail text; token text; req uuid;
 result jsonb; before_value jsonb; new_role text; old_member public.ts_members;
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'TS_unauthorized'; END IF;
 IF p IS NULL OR jsonb_typeof(p)<>'object' OR octet_length(p::text)>120000 THEN RAISE EXCEPTION 'TS_invalid'; END IF;
 req:=(p->>'requestId')::uuid;
 IF command='create_company' THEN
  c:=(p->>'id')::uuid;
  IF c IS NULL OR length(trim(coalesce(p->>'name',''))) NOT BETWEEN 1 AND 200 THEN RAISE EXCEPTION 'TS_invalid'; END IF;
  INSERT INTO public.ts_companies(id,name,created_by) VALUES(c,trim(p->>'name'),actor) ON CONFLICT(id) DO NOTHING;
  SELECT * INTO comp FROM public.ts_companies WHERE id=c FOR UPDATE;
  IF comp.created_by<>actor THEN RAISE EXCEPTION 'TS_denied'; END IF;
  INSERT INTO public.ts_members(company_id,user_id,role,display_name) SELECT c,actor,'owner',coalesce(email,'Company member') FROM auth.users WHERE id=actor ON CONFLICT DO NOTHING;
  IF public.ts_role(c) IS NULL THEN RAISE EXCEPTION 'TS_denied'; END IF;
  RETURN to_jsonb(comp);
 END IF;
 IF command='accept_invitation' THEN
  -- Token digest uses built-in SHA-256; raw tokens never enter database storage/events.
  SELECT * INTO inv FROM public.ts_invitations WHERE token_hash=encode(sha256(convert_to(coalesce(p->>'token',''),'UTF8')),'hex');
  IF NOT FOUND THEN RAISE EXCEPTION 'TS_invitation'; END IF;
  PERFORM 1 FROM public.ts_companies WHERE id=inv.company_id FOR UPDATE;
  SELECT * INTO inv FROM public.ts_invitations WHERE id=inv.id FOR UPDATE;
  SELECT lower(email) INTO mail FROM auth.users WHERE id=actor AND email_confirmed_at IS NOT NULL;
  IF mail IS NULL OR mail<>inv.email OR inv.revoked OR inv.expires_at<=now() OR (inv.accepted_by IS NOT NULL AND inv.accepted_by<>actor) THEN RAISE EXCEPTION 'TS_invitation'; END IF;
  IF inv.accepted_by=actor THEN
   IF public.ts_role(inv.company_id) IS NULL THEN RAISE EXCEPTION 'TS_invitation'; END IF;
   RETURN jsonb_build_object('company_id',inv.company_id);
  END IF;
  INSERT INTO public.ts_members(company_id,user_id,role,display_name) VALUES(inv.company_id,actor,inv.role,mail)
  ON CONFLICT(company_id,user_id) DO UPDATE SET active=true,role=excluded.role WHERE NOT public.ts_members.active;
  UPDATE public.ts_invitations SET accepted_by=actor WHERE id=inv.id;
  INSERT INTO public.ts_events(company_id,actor_id,kind,entity_id,after_value) VALUES(inv.company_id,actor,'invitation_accepted',actor,jsonb_build_object('role',public.ts_role(inv.company_id)));
  RETURN jsonb_build_object('company_id',inv.company_id);
 END IF;
 c:=(p->>'companyId')::uuid;
 -- The company lock establishes a consistent membership/permission boundary for each command.
 SELECT * INTO comp FROM public.ts_companies WHERE id=c FOR UPDATE;
 role_name:=public.ts_role(c);
 IF role_name IS NULL THEN RAISE EXCEPTION 'TS_denied'; END IF;

 IF command='save_company' THEN
  IF role_name<>'owner' THEN RAISE EXCEPTION 'TS_denied'; END IF;
  IF p->>'revision' IS NULL THEN RAISE EXCEPTION 'TS_invalid'; END IF;
  IF comp.revision<>(p->>'revision')::integer THEN RAISE EXCEPTION 'TS_conflict'; END IF;
  IF length(trim(coalesce(p->>'name',''))) NOT BETWEEN 1 AND 200 OR jsonb_typeof(p->'business') IS DISTINCT FROM 'object' OR octet_length((p->'business')::text)>20000 THEN RAISE EXCEPTION 'TS_invalid'; END IF;
  IF EXISTS(SELECT 1 FROM jsonb_each(p->'business') b WHERE jsonb_typeof(b.value) NOT IN ('string','null') OR length(b.value #>> '{}')>1000) THEN RAISE EXCEPTION 'TS_invalid'; END IF;
  UPDATE public.ts_companies SET name=trim(p->>'name'),business=p->'business',revision=revision+1 WHERE id=c RETURNING * INTO comp;
  RETURN to_jsonb(comp);
 ELSIF command='invite' THEN
  IF role_name<>'owner' THEN RAISE EXCEPTION 'TS_denied'; END IF;
  mail:=lower(trim(p->>'email')); new_role:=p->>'role'; token:=p->>'token';
  IF mail IS NULL OR mail !~ '^[^ @]+@[^ @]+\.[^ @]+$' OR length(mail)>254 OR coalesce(new_role,'') NOT IN ('owner','supervisor','worker') OR coalesce(token,'') !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'TS_invalid'; END IF;
  INSERT INTO public.ts_invitations(company_id,email,role,token_hash,created_by)
  VALUES(c,mail,new_role,encode(sha256(convert_to(token,'UTF8')),'hex'),actor) RETURNING * INTO inv;
  INSERT INTO public.ts_events(company_id,actor_id,kind,entity_id,after_value) VALUES(c,actor,'invitation_created',inv.id,jsonb_build_object('role',new_role));
  RETURN jsonb_build_object('id',inv.id,'expires_at',inv.expires_at);
 ELSIF command='revoke_invitation' THEN
  IF role_name<>'owner' THEN RAISE EXCEPTION 'TS_denied'; END IF;
  UPDATE public.ts_invitations SET revoked=true WHERE id=(p->>'id')::uuid AND company_id=c RETURNING * INTO inv;
  IF NOT FOUND THEN RAISE EXCEPTION 'TS_not_found'; END IF;
  INSERT INTO public.ts_events(company_id,actor_id,kind,entity_id) VALUES(c,actor,'invitation_revoked',inv.id);
  RETURN jsonb_build_object('revoked',true);
 ELSIF command='member' THEN
  IF role_name<>'owner' THEN RAISE EXCEPTION 'TS_denied'; END IF;
  target:=(p->>'userId')::uuid; new_role:=p->>'role';
  SELECT * INTO old_member FROM public.ts_members WHERE company_id=c AND user_id=target;
  IF NOT FOUND OR new_role IS NULL OR new_role NOT IN ('owner','supervisor','worker','remove') THEN RAISE EXCEPTION 'TS_invalid'; END IF;
  IF old_member.active AND old_member.role='owner' AND new_role<>'owner' AND
    (SELECT count(*) FROM public.ts_members WHERE company_id=c AND active AND role='owner')<=1 THEN RAISE EXCEPTION 'TS_last_owner'; END IF;
  UPDATE public.ts_members SET active=(new_role<>'remove'),role=CASE WHEN new_role='remove' THEN role ELSE new_role END WHERE company_id=c AND user_id=target;
  INSERT INTO public.ts_events(company_id,actor_id,kind,entity_id,before_value,after_value) VALUES(c,actor,'membership_changed',target,to_jsonb(old_member),jsonb_build_object('role',new_role));
  RETURN jsonb_build_object('updated',true);
 ELSIF command IN ('create_report','amend') THEN
  target:=(p->>'id')::uuid;
  SELECT * INTO r FROM public.ts_reports WHERE id=target;
  IF FOUND THEN
   IF r.company_id<>c OR r.author_id<>actor OR r.amendment_of IS DISTINCT FROM (p->>'amendmentOf')::uuid THEN RAISE EXCEPTION 'TS_denied'; END IF;
   RETURN to_jsonb(r);
  END IF;
  IF target IS NULL THEN RAISE EXCEPTION 'TS_invalid'; END IF;
  IF command='amend' THEN
   SELECT * INTO oldr FROM public.ts_reports WHERE id=(p->>'amendmentOf')::uuid AND company_id=c;
   IF NOT FOUND OR oldr.lifecycle<>'finalized' THEN RAISE EXCEPTION 'TS_not_found'; END IF;
   IF role_name='worker' AND oldr.author_id<>actor THEN RAISE EXCEPTION 'TS_denied'; END IF;
   IF length(trim(coalesce(p->>'reason',''))) NOT BETWEEN 1 AND 4000 THEN RAISE EXCEPTION 'TS_invalid'; END IF;
   SELECT * INTO t FROM public.ts_templates WHERE id=oldr.template_id;
   d:=oldr.document;
  ELSE
   SELECT * INTO t FROM public.ts_templates WHERE id=p->>'templateId';
   IF NOT FOUND THEN RAISE EXCEPTION 'TS_invalid'; END IF;
   SELECT jsonb_build_object('job',jsonb_build_object('address','','client','','date',''),'answers',jsonb_object_agg(i->>'id',jsonb_build_object('state','unanswered','note','','controls','')))
   INTO d FROM jsonb_array_elements(t.snapshot->'items') i;
  END IF;
  INSERT INTO public.ts_reports(id,company_id,author_id,template_id,template_snapshot,business_snapshot,document,amendment_of,amendment_reason)
  VALUES(target,c,actor,t.id,t.snapshot,CASE WHEN command='amend' THEN oldr.business_snapshot ELSE jsonb_build_object('name',comp.name,'details',comp.business) END,d,
  CASE WHEN command='amend' THEN oldr.id ELSE NULL END,CASE WHEN command='amend' THEN trim(p->>'reason') ELSE NULL END) RETURNING * INTO r;
  INSERT INTO public.ts_events(company_id,actor_id,kind,entity_id,after_value) VALUES(c,actor,command,r.id,jsonb_build_object('amendment_of',r.amendment_of));
  RETURN to_jsonb(r);
 ELSIF command IN ('save_report','finalize') THEN
  SELECT * INTO r FROM public.ts_reports WHERE id=(p->>'id')::uuid AND company_id=c FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'TS_not_found'; END IF;
  IF role_name='worker' AND r.author_id<>actor THEN RAISE EXCEPTION 'TS_denied'; END IF;
  IF req IS NULL OR p->>'revision' IS NULL THEN RAISE EXCEPTION 'TS_invalid'; END IF;
  IF r.last_request=req THEN RETURN to_jsonb(r); END IF;
  IF r.lifecycle<>'draft' THEN RAISE EXCEPTION 'TS_immutable'; END IF;
  IF r.revision<>(p->>'revision')::integer THEN RAISE EXCEPTION 'TS_conflict'; END IF;
  IF command='save_report' THEN
   PERFORM public.ts_validate_document(p->'document',r.template_snapshot,false);
   UPDATE public.ts_reports SET document=p->'document',revision=revision+1,last_request=req,updated_at=now() WHERE id=r.id RETURNING * INTO r;
  ELSE
   IF p->'acknowledged' IS DISTINCT FROM 'true'::jsonb THEN RAISE EXCEPTION 'TS_incomplete'; END IF;
   PERFORM public.ts_validate_document(r.document,r.template_snapshot,true);
   UPDATE public.ts_reports SET lifecycle='finalized',finalized_by=actor,finalized_at=now(),snapshot_version=1,revision=revision+1,last_request=req,updated_at=now() WHERE id=r.id RETURNING * INTO r;
   FOR item IN SELECT * FROM jsonb_array_elements(r.template_snapshot->'items') LOOP
    answer:=r.document->'answers'->(item->>'id');
    IF answer->>'state' IN ('attention','unable') THEN
     INSERT INTO public.ts_actions(company_id,report_id,item_id,observation,controls,responsible_id)
     VALUES(c,r.id,item->>'id',answer->>'note',answer->>'controls',actor) RETURNING * INTO act;
     INSERT INTO public.ts_events(company_id,actor_id,kind,entity_id,after_value) VALUES(c,actor,'action_opened',act.id,to_jsonb(act));
    END IF;
   END LOOP;
  END IF;
  INSERT INTO public.ts_events(company_id,actor_id,kind,entity_id,after_value) VALUES(c,actor,command,r.id,jsonb_build_object('revision',r.revision,'lifecycle',r.lifecycle));
  RETURN to_jsonb(r);
 ELSIF command='update_action' THEN
  SELECT * INTO act FROM public.ts_actions WHERE id=(p->>'id')::uuid AND company_id=c FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'TS_not_found'; END IF;
  IF role_name='worker' AND (act.responsible_id<>actor OR p->>'state'='closed' OR act.state='closed' OR (p->>'responsibleId')::uuid IS DISTINCT FROM act.responsible_id) THEN RAISE EXCEPTION 'TS_denied'; END IF;
  IF req IS NULL OR p->>'revision' IS NULL THEN RAISE EXCEPTION 'TS_invalid'; END IF;
  IF act.last_request=req THEN RETURN to_jsonb(act); END IF;
  IF act.revision<>(p->>'revision')::integer THEN RAISE EXCEPTION 'TS_conflict'; END IF;
  IF p->>'state' IS NULL OR p->>'state' NOT IN ('open','in_progress','awaiting_verification','closed') OR NOT EXISTS(SELECT 1 FROM public.ts_members WHERE company_id=c AND user_id=(p->>'responsibleId')::uuid AND active) THEN RAISE EXCEPTION 'TS_invalid'; END IF;
  IF act.state='closed' AND p->>'state'<>'open' THEN RAISE EXCEPTION 'TS_invalid'; END IF;
  IF jsonb_typeof(p->'controls') IS DISTINCT FROM 'string' OR jsonb_typeof(p->'resolution') IS DISTINCT FROM 'string' OR length(p->>'controls')>4000 OR length(p->>'resolution')>4000 THEN RAISE EXCEPTION 'TS_invalid'; END IF;
  IF p->>'state' IN ('closed','awaiting_verification') AND length(trim(p->>'resolution'))=0 THEN RAISE EXCEPTION 'TS_incomplete'; END IF;
  before_act:=to_jsonb(act);
  UPDATE public.ts_actions SET controls=p->>'controls',responsible_id=(p->>'responsibleId')::uuid,target_date=nullif(p->>'targetDate','')::date,
   state=p->>'state',resolution=p->>'resolution',revision=revision+1,last_request=req,
   verified_by=CASE WHEN p->>'state'='closed' THEN actor ELSE NULL END,verified_at=CASE WHEN p->>'state'='closed' THEN now() ELSE NULL END
  WHERE id=act.id RETURNING * INTO act;
  INSERT INTO public.ts_events(company_id,actor_id,kind,entity_id,before_value,after_value) VALUES(c,actor,'action_updated',act.id,before_act,to_jsonb(act));
  RETURN to_jsonb(act);
 END IF;
 RAISE EXCEPTION 'TS_invalid';
END $$;
REVOKE ALL ON FUNCTION public.ts_command(text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ts_command(text,jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.ts_immutable(),public.ts_snapshot_guard() FROM PUBLIC,anon,authenticated;
COMMIT;
