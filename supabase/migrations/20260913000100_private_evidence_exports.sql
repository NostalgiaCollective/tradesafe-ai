-- Phase 3. Additive, run once after recorded Phase 2 catalog reconciliation.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

CREATE TABLE public.ts_evidence (
 id uuid PRIMARY KEY, company_id uuid NOT NULL REFERENCES public.ts_companies(id) ON DELETE RESTRICT,
 report_id uuid NOT NULL REFERENCES public.ts_reports(id) ON DELETE RESTRICT,
 uploader_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT, uploader_label text NOT NULL,
 caption text NOT NULL CHECK(length(trim(caption)) BETWEEN 1 AND 1000),
 object_path text NOT NULL UNIQUE, sha256 text NOT NULL CHECK(sha256 ~ '^[a-f0-9]{64}$'),
 byte_size integer NOT NULL CHECK(byte_size BETWEEN 1 AND 3145728),
 width integer NOT NULL CHECK(width BETWEEN 1 AND 2400), height integer NOT NULL CHECK(height BETWEEN 1 AND 2400),
 state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','ready','removed')),
 reserved_at timestamptz NOT NULL DEFAULT now(), uploaded_at timestamptz, removed_at timestamptz,
 CHECK(state<>'ready' OR uploaded_at IS NOT NULL)
);
CREATE INDEX ts_evidence_report ON public.ts_evidence(report_id,state);
ALTER TABLE public.ts_evidence ENABLE ROW LEVEL SECURITY;
CREATE POLICY evidence_read ON public.ts_evidence FOR SELECT TO authenticated USING(public.ts_role(company_id) IS NOT NULL);
REVOKE ALL ON public.ts_evidence FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.ts_evidence TO authenticated;
GRANT ALL ON public.ts_evidence TO service_role;

ALTER TABLE public.ts_reports ADD COLUMN evidence_snapshot jsonb;
ALTER TABLE public.ts_reports ADD COLUMN identity_snapshot jsonb;

CREATE FUNCTION public.ts_capture_evidence() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public AS $$
BEGIN
 IF OLD.lifecycle='draft' AND NEW.lifecycle='finalized' THEN
  IF EXISTS(SELECT 1 FROM public.ts_evidence WHERE report_id=NEW.id AND state='pending') THEN RAISE EXCEPTION 'TS_evidence_pending'; END IF;
  SELECT coalesce(jsonb_agg(to_jsonb(e) ORDER BY e.reserved_at,e.id),'[]') INTO NEW.evidence_snapshot
   FROM public.ts_evidence e WHERE e.report_id=NEW.id AND e.state='ready';
  SELECT jsonb_build_object('author', (SELECT display_name FROM public.ts_members WHERE company_id=NEW.company_id AND user_id=NEW.author_id),
   'finalizer',(SELECT display_name FROM public.ts_members WHERE company_id=NEW.company_id AND user_id=NEW.finalized_by)) INTO NEW.identity_snapshot;
 ELSIF NEW.evidence_snapshot IS DISTINCT FROM OLD.evidence_snapshot OR NEW.identity_snapshot IS DISTINCT FROM OLD.identity_snapshot THEN
  RAISE EXCEPTION 'TS_immutable';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER ts_capture_evidence BEFORE UPDATE ON public.ts_reports FOR EACH ROW EXECUTE FUNCTION public.ts_capture_evidence();
REVOKE ALL ON FUNCTION public.ts_capture_evidence() FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.ts_evidence_command(command text,p jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public AS $$
DECLARE actor uuid:=auth.uid(); r public.ts_reports; e public.ts_evidence; role_name text; label text;
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'TS_unauthorized'; END IF;
 IF p IS NULL OR jsonb_typeof(p)<>'object' OR octet_length(p::text)>5000 THEN RAISE EXCEPTION 'TS_invalid'; END IF;
 SELECT * INTO r FROM public.ts_reports WHERE id=(p->>'reportId')::uuid;
 IF NOT FOUND THEN RAISE EXCEPTION 'TS_not_found'; END IF;
 PERFORM 1 FROM public.ts_companies WHERE id=r.company_id FOR UPDATE;
 SELECT * INTO r FROM public.ts_reports WHERE id=r.id FOR UPDATE;
 role_name:=public.ts_role(r.company_id);
 IF role_name IS NULL OR (role_name='worker' AND r.author_id<>actor) THEN RAISE EXCEPTION 'TS_denied'; END IF;
 IF r.lifecycle<>'draft' THEN RAISE EXCEPTION 'TS_immutable'; END IF;
 SELECT * INTO e FROM public.ts_evidence WHERE id=(p->>'id')::uuid;
 IF FOUND AND e.report_id<>r.id THEN RAISE EXCEPTION 'TS_denied'; END IF;
 IF command='reserve' THEN
  IF e.id IS NOT NULL THEN
   IF e.uploader_id<>actor OR e.sha256 IS DISTINCT FROM p->>'sha256' OR e.caption IS DISTINCT FROM trim(p->>'caption')
    OR e.byte_size IS DISTINCT FROM (p->>'byteSize')::integer OR e.width IS DISTINCT FROM (p->>'width')::integer
    OR e.height IS DISTINCT FROM (p->>'height')::integer OR e.state='removed' THEN RAISE EXCEPTION 'TS_conflict'; END IF;
   RETURN to_jsonb(e);
  END IF;
  IF (SELECT count(*) FROM public.ts_evidence WHERE report_id=r.id AND state<>'removed')>=10 THEN RAISE EXCEPTION 'TS_evidence_limit'; END IF;
  SELECT display_name INTO label FROM public.ts_members WHERE company_id=r.company_id AND user_id=actor;
  INSERT INTO public.ts_evidence(id,company_id,report_id,uploader_id,uploader_label,caption,object_path,sha256,byte_size,width,height)
   VALUES((p->>'id')::uuid,r.company_id,r.id,actor,label,trim(p->>'caption'),
   r.company_id::text||'/'||r.id::text||'/'||(p->>'id')::uuid::text||'.jpg',p->>'sha256',(p->>'byteSize')::integer,(p->>'width')::integer,(p->>'height')::integer) RETURNING * INTO e;
 ELSIF command='remove' THEN
  IF e.id IS NULL THEN RAISE EXCEPTION 'TS_not_found'; END IF;
  IF e.state='removed' THEN RETURN to_jsonb(e); END IF;
  UPDATE public.ts_evidence SET state='removed',removed_at=now() WHERE id=e.id RETURNING * INTO e;
 ELSE RAISE EXCEPTION 'TS_invalid'; END IF;
 INSERT INTO public.ts_events(company_id,actor_id,kind,entity_id,after_value)
  VALUES(r.company_id,actor,'evidence_'||command,e.id,jsonb_build_object('report_id',r.id,'state',e.state));
 RETURN to_jsonb(e);
END $$;
REVOKE ALL ON FUNCTION public.ts_evidence_command(text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ts_evidence_command(text,jsonb) TO authenticated;

-- Only the trusted byte-validation server can attest completion; ordinary RPC cannot.
CREATE FUNCTION public.ts_complete_evidence(evidence_id uuid,actor_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public AS $$
DECLARE e public.ts_evidence; r public.ts_reports; role_name text;
BEGIN
 SELECT * INTO e FROM public.ts_evidence WHERE id=evidence_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'TS_not_found'; END IF;
 PERFORM 1 FROM public.ts_companies WHERE id=e.company_id FOR UPDATE;
 SELECT * INTO r FROM public.ts_reports WHERE id=e.report_id FOR UPDATE;
 SELECT * INTO e FROM public.ts_evidence WHERE id=evidence_id FOR UPDATE;
 SELECT role INTO role_name FROM public.ts_members WHERE company_id=e.company_id AND user_id=actor_id AND active;
 IF role_name IS NULL OR (role_name='worker' AND r.author_id<>actor_id) THEN RAISE EXCEPTION 'TS_denied'; END IF;
 IF e.state='ready' THEN RETURN to_jsonb(e); END IF;
 IF r.lifecycle<>'draft' OR e.state='removed' THEN RAISE EXCEPTION 'TS_immutable'; END IF;
 UPDATE public.ts_evidence SET state='ready',uploaded_at=now() WHERE id=e.id RETURNING * INTO e;
 INSERT INTO public.ts_events(company_id,actor_id,kind,entity_id,after_value)
  VALUES(e.company_id,actor_id,'evidence_ready',e.id,jsonb_build_object('report_id',r.id,'sha256',e.sha256));
 RETURN to_jsonb(e);
END $$;
REVOKE ALL ON FUNCTION public.ts_complete_evidence(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ts_complete_evidence(uuid,uuid) TO service_role;

CREATE FUNCTION public.ts_evidence_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'TS_immutable'; END IF;
 IF (to_jsonb(NEW)-'state'-'uploaded_at'-'removed_at') IS DISTINCT FROM (to_jsonb(OLD)-'state'-'uploaded_at'-'removed_at')
 OR OLD.state='removed' OR (OLD.state='ready' AND NEW.state<>'removed')
 OR EXISTS(SELECT 1 FROM public.ts_reports WHERE id=OLD.report_id AND lifecycle='finalized') THEN RAISE EXCEPTION 'TS_immutable'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER ts_evidence_guard BEFORE UPDATE OR DELETE ON public.ts_evidence FOR EACH ROW EXECUTE FUNCTION public.ts_evidence_guard();
REVOKE ALL ON FUNCTION public.ts_evidence_guard() FROM PUBLIC,anon,authenticated;

CREATE TABLE public.ts_exports (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES public.ts_companies(id) ON DELETE RESTRICT,
 report_id uuid NOT NULL REFERENCES public.ts_reports(id) ON DELETE RESTRICT,
 export_version integer NOT NULL CHECK(export_version=1), snapshot_version integer NOT NULL,
 state text NOT NULL CHECK(state IN ('generating','ready','failed')), snapshot jsonb NOT NULL,
 requested_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT, cutoff_at timestamptz NOT NULL DEFAULT now(),
 attempt uuid NOT NULL, lease_until timestamptz NOT NULL, object_path text, sha256 text, byte_size integer,
 completed_at timestamptz, failure_code text CHECK(failure_code IN ('generation_failed','evidence_missing')),
 UNIQUE(report_id,export_version), CHECK(state<>'ready' OR (object_path IS NOT NULL AND sha256 ~ '^[a-f0-9]{64}$' AND byte_size>0 AND completed_at IS NOT NULL))
);
ALTER TABLE public.ts_exports ENABLE ROW LEVEL SECURITY;
CREATE POLICY export_read ON public.ts_exports FOR SELECT TO authenticated USING(public.ts_role(company_id) IS NOT NULL);
REVOKE ALL ON public.ts_exports FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.ts_exports TO authenticated;
GRANT ALL ON public.ts_exports TO service_role;

CREATE FUNCTION public.ts_export_job(command text,p jsonb,actor_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public AS $$
DECLARE r public.ts_reports; e public.ts_exports; a uuid:=(p->>'attempt')::uuid;
BEGIN
 SELECT * INTO r FROM public.ts_reports WHERE id=(p->>'reportId')::uuid;
 IF NOT FOUND THEN RAISE EXCEPTION 'TS_not_found'; END IF;
 PERFORM 1 FROM public.ts_companies WHERE id=r.company_id FOR UPDATE;
 SELECT * INTO r FROM public.ts_reports WHERE id=r.id FOR UPDATE;
 IF NOT EXISTS(SELECT 1 FROM public.ts_members WHERE company_id=r.company_id AND user_id=actor_id AND active) THEN RAISE EXCEPTION 'TS_denied'; END IF;
 IF r.lifecycle<>'finalized' THEN RAISE EXCEPTION 'TS_incomplete'; END IF;
 SELECT * INTO e FROM public.ts_exports WHERE report_id=r.id AND export_version=1 FOR UPDATE;
 IF command='begin' THEN
  IF e.state='ready' THEN RETURN to_jsonb(e); END IF;
  IF e.state='generating' AND e.lease_until>now() THEN RAISE EXCEPTION 'TS_export_busy'; END IF;
  IF a IS NULL THEN RAISE EXCEPTION 'TS_invalid'; END IF;
  IF e.id IS NULL THEN
   INSERT INTO public.ts_exports(company_id,report_id,export_version,snapshot_version,state,snapshot,requested_by,attempt,lease_until)
    VALUES(r.company_id,r.id,1,r.snapshot_version,'generating',jsonb_build_object('report',to_jsonb(r),
     'amendments',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'lifecycle',lifecycle,'reason',amendment_reason) ORDER BY created_at),'[]') FROM public.ts_reports WHERE amendment_of=r.id)),
     actor_id,a,now()+interval '2 minutes') RETURNING * INTO e;
  ELSE
   UPDATE public.ts_exports SET state='generating',attempt=a,lease_until=now()+interval '2 minutes',failure_code=NULL WHERE id=e.id RETURNING * INTO e;
  END IF;
 ELSE
  IF e.id IS NULL OR e.state<>'generating' OR e.attempt IS DISTINCT FROM a THEN RAISE EXCEPTION 'TS_conflict'; END IF;
  IF command='complete' THEN
   UPDATE public.ts_exports SET state='ready',object_path=company_id::text||'/'||report_id::text||'/'||id::text||'/'||attempt::text||'.pdf',
    sha256=p->>'sha256',byte_size=(p->>'byteSize')::integer,completed_at=now() WHERE id=e.id RETURNING * INTO e;
  ELSIF command='fail' THEN
   UPDATE public.ts_exports SET state='failed',failure_code=p->>'code' WHERE id=e.id RETURNING * INTO e;
  ELSE RAISE EXCEPTION 'TS_invalid'; END IF;
 END IF;
 RETURN to_jsonb(e);
END $$;
REVOKE ALL ON FUNCTION public.ts_export_job(text,jsonb,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ts_export_job(text,jsonb,uuid) TO service_role;
CREATE FUNCTION public.ts_export_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 IF TG_OP='DELETE' OR OLD.state='ready' THEN RAISE EXCEPTION 'TS_immutable'; END IF;
 IF (to_jsonb(NEW)-'state'-'attempt'-'lease_until'-'object_path'-'sha256'-'byte_size'-'completed_at'-'failure_code')
 IS DISTINCT FROM (to_jsonb(OLD)-'state'-'attempt'-'lease_until'-'object_path'-'sha256'-'byte_size'-'completed_at'-'failure_code') THEN RAISE EXCEPTION 'TS_immutable'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER ts_export_guard BEFORE UPDATE OR DELETE ON public.ts_exports FOR EACH ROW EXECUTE FUNCTION public.ts_export_guard();
REVOKE ALL ON FUNCTION public.ts_export_guard() FROM PUBLIC,anon,authenticated;

INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types) VALUES
 ('tradesafe-evidence','tradesafe-evidence',false,3145728,ARRAY['image/jpeg']),
 ('tradesafe-exports','tradesafe-exports',false,33554432,ARRAY['application/pdf']);
-- Restrictive denial remains effective even if an unrelated permissive policy is added later.
CREATE POLICY ts_private_objects ON storage.objects AS RESTRICTIVE FOR ALL TO anon,authenticated
 USING(bucket_id NOT IN ('tradesafe-evidence','tradesafe-exports'))
 WITH CHECK(bucket_id NOT IN ('tradesafe-evidence','tradesafe-exports'));
COMMIT;
