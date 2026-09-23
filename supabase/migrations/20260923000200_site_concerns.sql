-- Standalone observations; original trade reports, PDFs and briefing versions stay intact.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
CREATE TABLE public.ts_concerns (
 id uuid PRIMARY KEY, company_id uuid NOT NULL REFERENCES public.ts_companies(id),
 site_id uuid NOT NULL, author_id uuid NOT NULL REFERENCES auth.users(id),
 site_snapshot jsonb NOT NULL, document jsonb NOT NULL,
 revision integer NOT NULL DEFAULT 1, lifecycle text NOT NULL DEFAULT 'draft' CHECK(lifecycle IN ('draft','submitted')),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), submitted_at timestamptz,
 UNIQUE(company_id,id), FOREIGN KEY(company_id,site_id) REFERENCES public.ts_sites(company_id,id),
 CHECK((lifecycle='submitted')=(submitted_at IS NOT NULL))
);
ALTER TABLE public.ts_actions ADD COLUMN concern_id uuid;
ALTER TABLE public.ts_actions ADD CONSTRAINT ts_action_concern_company FOREIGN KEY(company_id,concern_id) REFERENCES public.ts_concerns(company_id,id);
ALTER TABLE public.ts_actions DROP CONSTRAINT ts_action_origin;
ALTER TABLE public.ts_actions ADD CONSTRAINT ts_action_origin CHECK (
 (report_id IS NOT NULL AND brief_id IS NULL AND brief_version IS NULL AND concern_id IS NULL) OR
 (report_id IS NULL AND brief_id IS NOT NULL AND brief_version IS NOT NULL AND concern_id IS NULL) OR
 (report_id IS NULL AND brief_id IS NULL AND brief_version IS NULL AND concern_id IS NOT NULL));
CREATE UNIQUE INDEX ts_action_concern ON public.ts_actions(concern_id) WHERE concern_id IS NOT NULL;
ALTER TABLE public.ts_events ADD COLUMN concern_id uuid REFERENCES public.ts_concerns(id);
CREATE TABLE public.ts_concern_notes (
 id uuid PRIMARY KEY, concern_id uuid NOT NULL, company_id uuid NOT NULL, actor_id uuid NOT NULL REFERENCES auth.users(id),
 note text NOT NULL CHECK(length(trim(note)) BETWEEN 1 AND 4000), recorded_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(company_id,concern_id) REFERENCES public.ts_concerns(company_id,id)
);
CREATE TABLE public.ts_concern_requests (
 actor_id uuid NOT NULL, request_id uuid NOT NULL, payload jsonb NOT NULL, concern_id uuid NOT NULL REFERENCES public.ts_concerns(id),
 PRIMARY KEY(actor_id,request_id)
);
CREATE TABLE public.ts_concern_photos (
 id uuid PRIMARY KEY, company_id uuid NOT NULL, concern_id uuid NOT NULL,
 uploader_id uuid NOT NULL REFERENCES auth.users(id), uploader_label text NOT NULL,
 caption text NOT NULL CHECK(length(trim(caption)) BETWEEN 1 AND 1000),
 object_path text NOT NULL UNIQUE, sha256 text NOT NULL CHECK(sha256 ~ '^[a-f0-9]{64}$'),
 byte_size integer NOT NULL CHECK(byte_size BETWEEN 1 AND 3145728),
 width integer NOT NULL CHECK(width BETWEEN 1 AND 2400), height integer NOT NULL CHECK(height BETWEEN 1 AND 2400),
 state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','ready','removed')),
 reserved_at timestamptz NOT NULL DEFAULT now(), uploaded_at timestamptz, removed_at timestamptz,
 FOREIGN KEY(company_id,concern_id) REFERENCES public.ts_concerns(company_id,id), CHECK(state<>'ready' OR uploaded_at IS NOT NULL)
);
CREATE INDEX ts_concerns_site ON public.ts_concerns(company_id,site_id,created_at DESC);
CREATE INDEX ts_concern_photos_parent ON public.ts_concern_photos(concern_id);
CREATE FUNCTION public.ts_concern_access(target uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT EXISTS(SELECT 1 FROM public.ts_concerns c JOIN public.ts_members m ON m.company_id=c.company_id AND m.user_id=auth.uid() AND m.active
 WHERE c.id=target AND (c.author_id=auth.uid() OR (c.lifecycle='submitted' AND (m.role IN ('owner','supervisor') OR EXISTS(SELECT 1 FROM public.ts_actions a WHERE a.concern_id=c.id AND a.responsible_id=auth.uid())))))
$$;
REVOKE ALL ON FUNCTION public.ts_concern_access(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ts_concern_access(uuid) TO authenticated;
ALTER TABLE public.ts_concerns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ts_concern_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ts_concern_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ts_concern_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY concern_read ON public.ts_concerns FOR SELECT TO authenticated USING(public.ts_concern_access(id));
CREATE POLICY concern_photo_read ON public.ts_concern_photos FOR SELECT TO authenticated USING(public.ts_concern_access(concern_id));
CREATE POLICY concern_note_read ON public.ts_concern_notes FOR SELECT TO authenticated USING(public.ts_concern_access(concern_id));
CREATE POLICY concern_action_scope ON public.ts_actions AS RESTRICTIVE FOR SELECT TO authenticated USING(concern_id IS NULL OR public.ts_concern_access(concern_id));
CREATE POLICY concern_event_scope ON public.ts_events AS RESTRICTIVE FOR SELECT TO authenticated USING(concern_id IS NULL OR public.ts_concern_access(concern_id));
REVOKE ALL ON public.ts_concerns,public.ts_concern_photos,public.ts_concern_notes,public.ts_concern_requests FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.ts_concerns,public.ts_concern_photos,public.ts_concern_notes TO authenticated;
GRANT ALL ON public.ts_concerns,public.ts_concern_photos,public.ts_concern_notes TO service_role;
CREATE TRIGGER concern_note_immutable BEFORE UPDATE OR DELETE ON public.ts_concern_notes FOR EACH ROW EXECUTE FUNCTION public.ts_immutable();
CREATE TRIGGER concern_request_immutable BEFORE UPDATE OR DELETE ON public.ts_concern_requests FOR EACH ROW EXECUTE FUNCTION public.ts_immutable();
CREATE FUNCTION public.ts_concern_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 IF TG_OP='DELETE' OR OLD.lifecycle='submitted' OR (to_jsonb(NEW)-'document'-'revision'-'lifecycle'-'updated_at'-'submitted_at') IS DISTINCT FROM (to_jsonb(OLD)-'document'-'revision'-'lifecycle'-'updated_at'-'submitted_at') THEN RAISE EXCEPTION 'TS_immutable'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER concern_immutable BEFORE UPDATE OR DELETE ON public.ts_concerns FOR EACH ROW EXECUTE FUNCTION public.ts_concern_guard();
CREATE FUNCTION public.ts_concern_event_scope() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 IF NEW.kind IN ('action_opened','action_updated') THEN SELECT concern_id INTO NEW.concern_id FROM public.ts_actions WHERE id=NEW.entity_id; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER concern_event_scope BEFORE INSERT ON public.ts_events FOR EACH ROW EXECUTE FUNCTION public.ts_concern_event_scope();
CREATE FUNCTION public.ts_concern_command(command text,p jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE actor uuid:=auth.uid(); c public.ts_concerns; s public.ts_sites; old_req public.ts_concern_requests; target uuid; req uuid; d jsonb; k text; act uuid;
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'TS_unauthorized'; END IF;
 IF p IS NULL OR jsonb_typeof(p)<>'object' OR octet_length(p::text)>16000 THEN RAISE EXCEPTION 'TS_invalid'; END IF;
 target:=(p->>'id')::uuid; req:=(p->>'requestId')::uuid;
 IF target IS NULL OR req IS NULL THEN RAISE EXCEPTION 'TS_invalid'; END IF;
 IF command='create' THEN SELECT * INTO s FROM public.ts_sites WHERE id=(p->>'siteId')::uuid;
 ELSE SELECT * INTO c FROM public.ts_concerns WHERE id=target; SELECT * INTO s FROM public.ts_sites WHERE id=c.site_id; END IF;
 IF s.id IS NULL THEN RAISE EXCEPTION 'TS_not_found'; END IF;
 PERFORM 1 FROM public.ts_companies WHERE id=s.company_id FOR UPDATE;
 IF public.ts_role(s.company_id) IS NULL THEN RAISE EXCEPTION 'TS_denied'; END IF;
 SELECT * INTO s FROM public.ts_sites WHERE id=s.id;
 SELECT * INTO c FROM public.ts_concerns WHERE id=target FOR UPDATE;
 IF c.id IS NOT NULL AND (c.site_id<>s.id OR NOT public.ts_concern_access(c.id)) THEN RAISE EXCEPTION 'TS_denied'; END IF;
 SELECT * INTO old_req FROM public.ts_concern_requests WHERE actor_id=actor AND request_id=req;
 IF FOUND THEN
  IF old_req.payload IS DISTINCT FROM jsonb_build_object('command',command,'p',p) OR old_req.concern_id<>target THEN RAISE EXCEPTION 'TS_conflict'; END IF;
  RETURN to_jsonb(c);
 END IF;
 IF command IN ('create','save') THEN
  IF command='create' AND c.id IS NOT NULL THEN RAISE EXCEPTION 'TS_conflict'; END IF;
  IF command='create' AND s.archived THEN RAISE EXCEPTION 'TS_denied'; END IF;
  IF command='save' THEN
   IF c.id IS NULL THEN RAISE EXCEPTION 'TS_not_found'; END IF;
   IF c.author_id<>actor THEN RAISE EXCEPTION 'TS_denied'; END IF;
   IF c.lifecycle<>'draft' THEN RAISE EXCEPTION 'TS_immutable'; END IF;
   IF c.revision IS DISTINCT FROM (p->>'revision')::integer THEN RAISE EXCEPTION 'TS_conflict'; END IF;
  END IF;
  d:=p->'document';
  IF d IS NULL OR jsonb_typeof(d)<>'object' OR (d-ARRAY['observation','location','immediate','observedAt'])<>'{}'::jsonb THEN RAISE EXCEPTION 'TS_invalid'; END IF;
  FOREACH k IN ARRAY ARRAY['observation','location','immediate','observedAt'] LOOP
   IF jsonb_typeof(d->k) IS DISTINCT FROM 'string' OR length(d->>k)>4000 THEN RAISE EXCEPTION 'TS_invalid'; END IF;
  END LOOP;
  IF length(d->>'location')>1000 OR length(d->>'observedAt')>80 THEN RAISE EXCEPTION 'TS_invalid'; END IF;
  IF d->>'observedAt'<>'' THEN
   IF d->>'observedAt' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}([.][0-9]{1,3})?Z$' THEN RAISE EXCEPTION 'TS_invalid'; END IF;
   PERFORM (d->>'observedAt')::timestamptz;
  END IF;
  IF command='create' THEN
   IF (SELECT count(*) FROM public.ts_concerns WHERE company_id=s.company_id AND created_at>now()-interval '1 day')>=100 THEN RAISE EXCEPTION 'TS_invalid'; END IF;
   INSERT INTO public.ts_concerns(id,company_id,site_id,author_id,site_snapshot,document) VALUES(target,s.company_id,s.id,actor,jsonb_build_object('name',s.document->'name','address',s.document->'address','revision',s.revision),d) RETURNING * INTO c;
  ELSE UPDATE public.ts_concerns SET document=d,revision=revision+1,updated_at=now() WHERE id=target RETURNING * INTO c; END IF;
 ELSIF command='submit' THEN
  IF c.author_id IS DISTINCT FROM actor THEN RAISE EXCEPTION 'TS_denied'; END IF;
  IF c.lifecycle<>'draft' THEN RAISE EXCEPTION 'TS_immutable'; END IF;
  IF c.revision IS DISTINCT FROM (p->>'revision')::integer THEN RAISE EXCEPTION 'TS_conflict'; END IF;
  IF length(trim(c.document->>'observation'))=0 OR length(trim(c.document->>'location'))=0 THEN RAISE EXCEPTION 'TS_incomplete'; END IF;
  IF EXISTS(SELECT 1 FROM public.ts_concern_photos WHERE concern_id=target AND state='pending') THEN RAISE EXCEPTION 'TS_evidence_pending'; END IF;
  UPDATE public.ts_concerns SET lifecycle='submitted',submitted_at=now(),updated_at=now() WHERE id=target RETURNING * INTO c;
  INSERT INTO public.ts_actions(company_id,concern_id,item_id,observation,controls,responsible_id) VALUES(c.company_id,target,target::text,c.document->>'observation',c.document->>'immediate',actor) RETURNING id INTO act;
  INSERT INTO public.ts_events(company_id,actor_id,kind,entity_id,after_value) VALUES(c.company_id,actor,'action_opened',act,jsonb_build_object('state','open','concern_id',target));
 ELSIF command='note' THEN
  IF c.lifecycle<>'submitted' OR (c.author_id<>actor AND public.ts_role(c.company_id) NOT IN ('owner','supervisor')) THEN RAISE EXCEPTION 'TS_denied'; END IF;
  IF (SELECT count(*) FROM public.ts_concern_notes WHERE concern_id=target)>=100 OR jsonb_typeof(p->'note') IS DISTINCT FROM 'string' THEN RAISE EXCEPTION 'TS_invalid'; END IF;
  INSERT INTO public.ts_concern_notes(id,concern_id,company_id,actor_id,note) VALUES(req,target,c.company_id,actor,trim(p->>'note'));
 ELSE RAISE EXCEPTION 'TS_invalid'; END IF;
 INSERT INTO public.ts_concern_requests VALUES(actor,req,jsonb_build_object('command',command,'p',p),target);
 INSERT INTO public.ts_events(company_id,actor_id,kind,entity_id,concern_id,after_value) VALUES(c.company_id,actor,'concern_'||command,target,target,jsonb_build_object('revision',c.revision,'lifecycle',c.lifecycle));
 RETURN to_jsonb(c);
END $$;
REVOKE ALL ON FUNCTION public.ts_concern_command(text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ts_concern_command(text,jsonb) TO authenticated;
CREATE FUNCTION public.ts_concern_photo(command text,p jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE c public.ts_concerns; e public.ts_concern_photos; actor uuid:=auth.uid();
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'TS_unauthorized'; END IF;
 IF p IS NULL OR jsonb_typeof(p)<>'object' OR octet_length(p::text)>5000 THEN RAISE EXCEPTION 'TS_invalid'; END IF;
 SELECT * INTO c FROM public.ts_concerns WHERE id=(p->>'concernId')::uuid;
 IF NOT FOUND THEN RAISE EXCEPTION 'TS_not_found'; END IF;
 PERFORM 1 FROM public.ts_companies WHERE id=c.company_id FOR UPDATE;
 SELECT * INTO c FROM public.ts_concerns WHERE id=c.id FOR UPDATE;
 IF public.ts_role(c.company_id) IS NULL OR c.author_id<>actor THEN RAISE EXCEPTION 'TS_denied'; END IF;
 IF c.lifecycle<>'draft' THEN RAISE EXCEPTION 'TS_immutable'; END IF;
 SELECT * INTO e FROM public.ts_concern_photos WHERE id=(p->>'id')::uuid;
 IF FOUND AND e.concern_id<>c.id THEN RAISE EXCEPTION 'TS_denied'; END IF;
 IF command='reserve' THEN
  IF e.id IS NOT NULL THEN
   IF e.sha256 IS DISTINCT FROM p->>'sha256' OR e.caption IS DISTINCT FROM trim(p->>'caption') OR e.byte_size IS DISTINCT FROM (p->>'byteSize')::integer OR e.width IS DISTINCT FROM (p->>'width')::integer OR e.height IS DISTINCT FROM (p->>'height')::integer OR e.state='removed' THEN RAISE EXCEPTION 'TS_conflict'; END IF;
   RETURN to_jsonb(e);
  END IF;
  IF (SELECT count(*) FROM public.ts_concern_photos WHERE concern_id=c.id AND state<>'removed')>=10 THEN RAISE EXCEPTION 'TS_evidence_limit'; END IF;
  INSERT INTO public.ts_concern_photos(id,company_id,concern_id,uploader_id,uploader_label,caption,object_path,sha256,byte_size,width,height)
  VALUES((p->>'id')::uuid,c.company_id,c.id,actor,(SELECT display_name FROM public.ts_members WHERE company_id=c.company_id AND user_id=actor),trim(p->>'caption'),c.company_id::text||'/concerns/'||c.id::text||'/'||(p->>'id')::uuid::text||'.jpg',p->>'sha256',(p->>'byteSize')::integer,(p->>'width')::integer,(p->>'height')::integer) RETURNING * INTO e;
 ELSIF command='remove' THEN
  IF e.id IS NULL THEN RAISE EXCEPTION 'TS_not_found'; END IF;
  IF e.state<>'removed' THEN UPDATE public.ts_concern_photos SET state='removed',removed_at=now() WHERE id=e.id RETURNING * INTO e; END IF;
 ELSE RAISE EXCEPTION 'TS_invalid'; END IF;
 RETURN to_jsonb(e);
END $$;
CREATE FUNCTION public.ts_complete_concern_photo(evidence_id uuid,actor_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE c public.ts_concerns; e public.ts_concern_photos;
BEGIN
 SELECT * INTO e FROM public.ts_concern_photos WHERE id=evidence_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'TS_not_found'; END IF;
 PERFORM 1 FROM public.ts_companies WHERE id=e.company_id FOR UPDATE;
 SELECT * INTO c FROM public.ts_concerns WHERE id=e.concern_id FOR UPDATE;
 SELECT * INTO e FROM public.ts_concern_photos WHERE id=evidence_id FOR UPDATE;
 IF c.author_id<>actor_id OR NOT EXISTS(SELECT 1 FROM public.ts_members WHERE company_id=c.company_id AND user_id=actor_id AND active) THEN RAISE EXCEPTION 'TS_denied'; END IF;
 IF e.state='ready' THEN RETURN to_jsonb(e); END IF;
 IF c.lifecycle<>'draft' OR e.state='removed' THEN RAISE EXCEPTION 'TS_immutable'; END IF;
 UPDATE public.ts_concern_photos SET state='ready',uploaded_at=now() WHERE id=e.id RETURNING * INTO e;
 RETURN to_jsonb(e);
END $$;
CREATE FUNCTION public.ts_concern_photo_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 IF TG_OP='DELETE' OR (to_jsonb(NEW)-'state'-'uploaded_at'-'removed_at') IS DISTINCT FROM (to_jsonb(OLD)-'state'-'uploaded_at'-'removed_at') OR OLD.state='removed' OR (OLD.state='ready' AND NEW.state<>'removed') OR EXISTS(SELECT 1 FROM public.ts_concerns WHERE id=OLD.concern_id AND lifecycle='submitted') THEN RAISE EXCEPTION 'TS_immutable'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER concern_photo_immutable BEFORE UPDATE OR DELETE ON public.ts_concern_photos FOR EACH ROW EXECUTE FUNCTION public.ts_concern_photo_guard();
REVOKE ALL ON FUNCTION public.ts_concern_photo(text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ts_concern_photo(text,jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.ts_complete_concern_photo(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ts_complete_concern_photo(uuid,uuid) TO service_role;
CREATE FUNCTION public.ts_concern_admit(concern_id uuid,actor_id uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE c public.ts_concerns; keys text[]; limits integer[]:=ARRAY[60,30,20]; i integer;
BEGIN
 SELECT * INTO c FROM public.ts_concerns WHERE id=concern_id;
 IF c.id IS NULL OR c.author_id<>actor_id OR c.lifecycle<>'draft' OR NOT EXISTS(SELECT 1 FROM public.ts_members WHERE company_id=c.company_id AND user_id=actor_id AND active) OR NOT EXISTS(SELECT 1 FROM auth.users WHERE id=actor_id AND email_confirmed_at IS NOT NULL) THEN RAISE EXCEPTION 'TS_denied'; END IF;
 -- Same budget keys and lock as report uploads: this does not create a second allowance.
 keys:=ARRAY['upload:global','upload:company:'||right(md5(c.company_id::text),3),'upload:user:'||right(md5(actor_id::text),3)];
 PERFORM pg_advisory_xact_lock(74160916);
 FOR i IN 1..3 LOOP
  INSERT INTO public.ts_resource_limits VALUES(keys[i],now(),0) ON CONFLICT DO NOTHING;
  UPDATE public.ts_resource_limits SET window_start=now(),count=0 WHERE key=keys[i] AND window_start<=now()-interval '10 minutes';
 END LOOP;
 FOR i IN 1..3 LOOP IF (SELECT count FROM public.ts_resource_limits WHERE key=keys[i])>=limits[i] THEN RETURN false; END IF; END LOOP;
 UPDATE public.ts_resource_limits SET count=count+1 WHERE key=ANY(keys);
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.ts_concern_admit(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ts_concern_admit(uuid,uuid) TO service_role;
REVOKE ALL ON FUNCTION public.ts_concern_guard(),public.ts_concern_event_scope(),public.ts_concern_photo_guard() FROM PUBLIC,anon,authenticated;
-- Recreate only read projections to include the new origin; no historical rows are changed.
CREATE OR REPLACE VIEW public.ts_site_actions WITH(security_invoker=true) AS
 SELECT a.id,a.company_id,a.report_id,a.item_id,a.observation,a.controls,a.responsible_id,a.target_date,a.state,a.resolution,a.verified_by,a.verified_at,a.revision,a.last_request,a.brief_id,a.brief_version,coalesce(c.site_id,l.site_id) site_id,a.concern_id FROM public.ts_actions a
 LEFT JOIN public.ts_concerns c ON c.id=a.concern_id AND c.company_id=a.company_id
 LEFT JOIN public.ts_site_links l ON (l.report_id=a.report_id OR l.brief_id=a.brief_id) AND l.company_id=a.company_id
 WHERE c.site_id IS NOT NULL OR l.site_id IS NOT NULL;
CREATE OR REPLACE VIEW public.ts_action_ownership WITH(security_invoker=true) AS
 SELECT a.id,a.company_id,a.report_id,a.item_id,a.observation,a.controls,a.responsible_id,a.target_date,a.state,a.resolution,a.verified_by,a.verified_at,a.revision,a.last_request,a.brief_id,a.brief_version,coalesce(m.active,false) assignee_active,a.state<>'closed' AND (a.responsible_id IS NULL OR NOT coalesce(m.active,false)) needs_reassignment,
 coalesce(c.site_id,l.site_id) site_id,coalesce(c.site_snapshot->>'name',v.snapshot->'document'->>'site',r.document->'job'->>'address','Original record') record_site,a.concern_id
 FROM public.ts_actions a LEFT JOIN public.ts_members m ON m.company_id=a.company_id AND m.user_id=a.responsible_id
 LEFT JOIN public.ts_concerns c ON c.id=a.concern_id AND c.company_id=a.company_id
 LEFT JOIN public.ts_reports r ON r.id=a.report_id AND r.company_id=a.company_id
 LEFT JOIN public.ts_brief_versions v ON v.brief_id=a.brief_id AND v.version=a.brief_version AND v.company_id=a.company_id
 LEFT JOIN public.ts_site_links l ON l.company_id=a.company_id AND (l.report_id=a.report_id OR l.brief_id=a.brief_id);
REVOKE ALL ON public.ts_site_actions,public.ts_action_ownership FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.ts_site_actions,public.ts_action_ownership TO authenticated;
COMMIT;
