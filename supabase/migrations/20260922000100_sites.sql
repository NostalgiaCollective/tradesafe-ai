-- Staging site workspace. Explicit associations only; no historical address matching.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
CREATE TABLE public.ts_sites (
 id uuid PRIMARY KEY, company_id uuid NOT NULL REFERENCES public.ts_companies(id) ON DELETE RESTRICT,
 author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 document jsonb NOT NULL, revision integer NOT NULL DEFAULT 1,
 lifecycle text NOT NULL DEFAULT 'draft' CHECK(lifecycle='draft'), -- existing draft save hook contract
 archived boolean NOT NULL DEFAULT false, last_request uuid,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(company_id,id)
);
CREATE TABLE public.ts_site_links (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL,
 site_id uuid NOT NULL, report_id uuid UNIQUE REFERENCES public.ts_reports(id) ON DELETE RESTRICT,
 brief_id uuid UNIQUE REFERENCES public.ts_briefs(id) ON DELETE RESTRICT,
 snapshot jsonb NOT NULL, association text NOT NULL CHECK(association IN ('created_at_site','explicit_existing','amendment')),
 linked_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT, linked_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(company_id,site_id) REFERENCES public.ts_sites(company_id,id) ON DELETE RESTRICT,
 CHECK((report_id IS NULL)<>(brief_id IS NULL))
);
CREATE TABLE public.ts_site_requests (
 company_id uuid NOT NULL REFERENCES public.ts_companies(id) ON DELETE RESTRICT,
 request_id uuid NOT NULL, actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 digest text NOT NULL, result jsonb NOT NULL, PRIMARY KEY(company_id,request_id)
);
CREATE INDEX ts_sites_company_updated ON public.ts_sites(company_id,archived,updated_at DESC,id);
CREATE INDEX ts_site_links_site ON public.ts_site_links(company_id,site_id,linked_at DESC);
ALTER TABLE public.ts_sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ts_site_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ts_site_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY site_read ON public.ts_sites FOR SELECT TO authenticated USING(public.ts_role(company_id) IS NOT NULL);
CREATE POLICY site_link_read ON public.ts_site_links FOR SELECT TO authenticated USING(public.ts_role(company_id) IS NOT NULL);
REVOKE ALL ON public.ts_sites,public.ts_site_links,public.ts_site_requests FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.ts_sites,public.ts_site_links TO authenticated;
CREATE TRIGGER ts_site_links_immutable BEFORE UPDATE OR DELETE ON public.ts_site_links FOR EACH ROW EXECUTE FUNCTION public.ts_immutable();
ALTER TABLE public.ts_reports ADD COLUMN site_snapshot jsonb;

CREATE FUNCTION public.ts_site_record_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE l public.ts_site_links;
BEGIN
 IF TG_TABLE_NAME='ts_site_links' THEN
  IF NEW.report_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.ts_reports WHERE id=NEW.report_id AND company_id=NEW.company_id) THEN RAISE EXCEPTION 'TS_denied'; END IF;
  IF NEW.brief_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.ts_briefs WHERE id=NEW.brief_id AND company_id=NEW.company_id) THEN RAISE EXCEPTION 'TS_denied'; END IF;
 ELSIF TG_TABLE_NAME='ts_brief_versions' THEN
  SELECT * INTO l FROM public.ts_site_links WHERE brief_id=NEW.brief_id;
  IF FOUND THEN NEW.snapshot:=NEW.snapshot||jsonb_build_object('site',l.snapshot,'siteAssociation',jsonb_build_object('kind',l.association,'linkedAt',l.linked_at)); END IF;
 ELSIF TG_TABLE_NAME='ts_reports' THEN
  IF TG_OP='INSERT' AND NEW.amendment_of IS NOT NULL THEN
   SELECT * INTO l FROM public.ts_site_links WHERE report_id=NEW.amendment_of;
   IF FOUND THEN
    INSERT INTO public.ts_site_links(company_id,site_id,report_id,snapshot,association,linked_by)
    VALUES(NEW.company_id,l.site_id,NEW.id,l.snapshot,CASE WHEN l.association='explicit_existing' THEN 'explicit_existing' ELSE 'amendment' END,auth.uid());
   END IF;
  END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.ts_site_record_guard() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER ts_site_link_guard BEFORE INSERT ON public.ts_site_links FOR EACH ROW EXECUTE FUNCTION public.ts_site_record_guard();
CREATE TRIGGER ts_site_brief_snapshot BEFORE INSERT ON public.ts_brief_versions FOR EACH ROW EXECUTE FUNCTION public.ts_site_record_guard();
CREATE TRIGGER ts_site_amendment AFTER INSERT ON public.ts_reports FOR EACH ROW EXECUTE FUNCTION public.ts_site_record_guard();
-- Inherit original site provenance, never today's renamed site, when creating an amendment.
CREATE FUNCTION public.ts_site_report_snapshot() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 IF TG_OP='INSERT' AND NEW.amendment_of IS NOT NULL THEN
  SELECT site_snapshot INTO NEW.site_snapshot FROM public.ts_reports WHERE id=NEW.amendment_of;
 ELSIF TG_OP='UPDATE' AND OLD.site_snapshot IS NOT NULL AND NEW.site_snapshot IS DISTINCT FROM OLD.site_snapshot THEN RAISE EXCEPTION 'TS_immutable'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.ts_site_report_snapshot() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER ts_site_report_snapshot BEFORE INSERT OR UPDATE ON public.ts_reports FOR EACH ROW EXECUTE FUNCTION public.ts_site_report_snapshot();

CREATE VIEW public.ts_site_actions WITH (security_invoker=true) AS
 SELECT a.*,l.site_id FROM public.ts_actions a JOIN public.ts_site_links l ON (l.report_id=a.report_id OR l.brief_id=a.brief_id) AND l.company_id=a.company_id;
GRANT SELECT ON public.ts_site_actions TO authenticated;

CREATE FUNCTION public.ts_site_command(command text,p jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE actor uuid:=auth.uid(); c uuid; target uuid; req uuid; role_name text; s public.ts_sites; prior public.ts_site_requests;
 l public.ts_site_links; r public.ts_reports; b public.ts_briefs; d jsonb; result jsonb; fingerprint text; snap jsonb; kind text;
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'TS_unauthorized'; END IF;
 IF p IS NULL OR jsonb_typeof(p)<>'object' OR octet_length(p::text)>16000 THEN RAISE EXCEPTION 'TS_invalid'; END IF;
 c:=(p->>'companyId')::uuid;target:=(p->>'id')::uuid;req:=(p->>'requestId')::uuid;
 IF c IS NULL OR target IS NULL OR req IS NULL THEN RAISE EXCEPTION 'TS_invalid'; END IF;
 PERFORM 1 FROM public.ts_companies WHERE id=c FOR UPDATE;
 role_name:=public.ts_role(c);IF role_name IS NULL THEN RAISE EXCEPTION 'TS_denied'; END IF;
 fingerprint:=encode(sha256(convert_to(command||p::text,'UTF8')),'hex');
 SELECT * INTO prior FROM public.ts_site_requests WHERE company_id=c AND request_id=req;
 IF FOUND THEN
  IF prior.actor_id<>actor OR prior.digest<>fingerprint THEN RAISE EXCEPTION 'TS_conflict'; END IF;
  RETURN prior.result;
 END IF;
 IF command IN ('create','save','archive','restore') THEN
  SELECT * INTO s FROM public.ts_sites WHERE id=target FOR UPDATE;
  IF command='create' THEN
   IF FOUND THEN RAISE EXCEPTION 'TS_conflict'; END IF;
   IF (SELECT count(*) FROM public.ts_sites WHERE company_id=c AND created_at>now()-interval '1 day')>=100 THEN RAISE EXCEPTION 'TS_invalid'; END IF;
  ELSE
   IF s.id IS NULL OR s.company_id<>c THEN RAISE EXCEPTION 'TS_not_found'; END IF;
   IF role_name='worker' AND (s.author_id<>actor OR command IN ('archive','restore')) THEN RAISE EXCEPTION 'TS_denied'; END IF;
   IF (p->>'revision')::integer IS DISTINCT FROM s.revision THEN RAISE EXCEPTION 'TS_conflict'; END IF;
  END IF;
  IF command IN ('create','save') THEN
   d:=p->'document';
   IF d IS NULL OR jsonb_typeof(d)<>'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(d) k WHERE k NOT IN ('name','address','instructions')) THEN RAISE EXCEPTION 'TS_invalid'; END IF;
   IF jsonb_typeof(d->'name') IS DISTINCT FROM 'string' OR length(trim(d->>'name')) NOT BETWEEN 1 AND 200
    OR jsonb_typeof(d->'address') IS DISTINCT FROM 'string' OR length(trim(d->>'address')) NOT BETWEEN 1 AND 1000
    OR jsonb_typeof(d->'instructions') IS DISTINCT FROM 'string' OR length(d->>'instructions')>4000 THEN RAISE EXCEPTION 'TS_invalid'; END IF;
   IF command='create' THEN INSERT INTO public.ts_sites(id,company_id,author_id,document,last_request) VALUES(target,c,actor,d,req) RETURNING * INTO s;
   ELSE
    IF s.archived THEN RAISE EXCEPTION 'TS_site_archived'; END IF;
    UPDATE public.ts_sites SET document=d,revision=revision+1,last_request=req,updated_at=now() WHERE id=target RETURNING * INTO s;
   END IF;
  ELSE UPDATE public.ts_sites SET archived=command='archive',revision=revision+1,last_request=req,updated_at=now() WHERE id=target RETURNING * INTO s;
  END IF;
  result:=to_jsonb(s);
 ELSIF command IN ('create_brief','create_report','link_brief','link_report') THEN
  SELECT * INTO s FROM public.ts_sites WHERE id=(p->>'siteId')::uuid AND company_id=c FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'TS_not_found'; END IF;
  IF s.archived THEN RAISE EXCEPTION 'TS_site_archived'; END IF;
  snap:=jsonb_build_object('id',s.id,'revision',s.revision,'name',s.document->'name','address',s.document->'address','instructions',s.document->'instructions');
  kind:=CASE WHEN command LIKE 'create_%' THEN 'created_at_site' ELSE 'explicit_existing' END;
  IF command LIKE '%brief' THEN
   SELECT * INTO b FROM public.ts_briefs WHERE id=target;
   IF command='create_brief' THEN
    IF FOUND THEN RAISE EXCEPTION 'TS_conflict'; END IF;
    PERFORM public.ts_brief_command('create',p-'reuseId');
    SELECT * INTO b FROM public.ts_briefs WHERE id=target;
    d:=b.document||jsonb_build_object('site',s.document->>'name'||' — '||(s.document->>'address'));
    -- Task reuse is deliberate and from an explicitly linked same-site brief only.
    IF nullif(p->>'reuseId','') IS NOT NULL THEN
     SELECT x.document->>'task' INTO kind FROM public.ts_briefs x JOIN public.ts_site_links y ON y.brief_id=x.id
     WHERE x.id=(p->>'reuseId')::uuid AND x.company_id=c AND y.site_id=s.id;
     IF NOT FOUND THEN RAISE EXCEPTION 'TS_denied'; END IF;
     d:=d||jsonb_build_object('task',kind);kind:='created_at_site';
    END IF;
    UPDATE public.ts_briefs SET document=d WHERE id=target RETURNING * INTO b;
   END IF;
   IF b.id IS NULL OR b.company_id<>c THEN RAISE EXCEPTION 'TS_not_found'; END IF;
   IF role_name='worker' AND b.author_id<>actor THEN RAISE EXCEPTION 'TS_denied'; END IF;
   SELECT * INTO l FROM public.ts_site_links WHERE brief_id=target;
   IF FOUND THEN RAISE EXCEPTION 'TS_conflict'; END IF;
   INSERT INTO public.ts_site_links(company_id,site_id,brief_id,snapshot,association,linked_by) VALUES(c,s.id,target,snap,kind,actor);
   result:=to_jsonb(b);
  ELSE
   SELECT * INTO r FROM public.ts_reports WHERE id=target;
   IF command='create_report' THEN
    IF FOUND THEN RAISE EXCEPTION 'TS_conflict'; END IF;
    PERFORM public.ts_command('create_report',p);
    UPDATE public.ts_reports SET site_snapshot=snap,document=jsonb_set(document,'{job,address}',s.document->'address') WHERE id=target RETURNING * INTO r;
   END IF;
   IF r.id IS NULL OR r.company_id<>c THEN RAISE EXCEPTION 'TS_not_found'; END IF;
   IF role_name='worker' AND r.author_id<>actor THEN RAISE EXCEPTION 'TS_denied'; END IF;
   SELECT * INTO l FROM public.ts_site_links WHERE report_id=target;
   IF FOUND THEN RAISE EXCEPTION 'TS_conflict'; END IF;
   INSERT INTO public.ts_site_links(company_id,site_id,report_id,snapshot,association,linked_by) VALUES(c,s.id,target,snap,kind,actor);
   result:=to_jsonb(r);
  END IF;
 ELSE RAISE EXCEPTION 'TS_invalid'; END IF;
 INSERT INTO public.ts_site_requests VALUES(c,req,actor,fingerprint,result);
 INSERT INTO public.ts_events(company_id,actor_id,kind,entity_id,after_value) VALUES(c,actor,'site_'||command,target,jsonb_build_object('siteId',s.id,'revision',s.revision));
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.ts_site_command(text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ts_site_command(text,jsonb) TO authenticated;
COMMIT;
