-- Retained private site packages. No existing objects or report exports are rewritten.
BEGIN;
SET LOCAL lock_timeout='5s';
ALTER FUNCTION public.ts_site_evidence_snapshot(uuid,date,date,timestamptz) RENAME TO ts_site_evidence_snapshot_v1;
CREATE FUNCTION public.ts_site_evidence_snapshot(site uuid,first_day date,last_day date,cutoff timestamptz DEFAULT now()) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=pg_catalog,public SET statement_timeout='8s' SET timezone='UTC' AS $$
DECLARE result jsonb; jobs jsonb; updates jsonb; photos jsonb; events jsonb; report_photos jsonb; electrical_photos jsonb;
BEGIN
 result:=public.ts_site_evidence_snapshot_v1(site,first_day,last_day,cutoff);
 SELECT coalesce(jsonb_agg(to_jsonb(v)),'[]') INTO jobs FROM (SELECT * FROM public.ts_electrical_job_versions WHERE site_id=site AND recorded_at<=cutoff ORDER BY revision DESC LIMIT 1) v;
 SELECT coalesce(jsonb_agg(to_jsonb(u)-'payload' ORDER BY recorded_at,id),'[]') INTO updates FROM (SELECT * FROM public.ts_action_updates WHERE action_id IN (SELECT (x->>'id')::uuid FROM jsonb_array_elements(result->'actions') x) AND recorded_at<=cutoff ORDER BY recorded_at,id LIMIT 501) u;
 SELECT coalesce(jsonb_agg(e ORDER BY e->>'id'),'[]') INTO photos FROM jsonb_array_elements(updates) u CROSS JOIN LATERAL jsonb_array_elements(u->'evidence_snapshot') e;
 SELECT coalesce(jsonb_agg(e ORDER BY e->>'id'),'[]') INTO report_photos FROM jsonb_array_elements(result->'reports') r CROSS JOIN LATERAL jsonb_array_elements(coalesce(r->'evidence_snapshot','[]')) e;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(jobs) j CROSS JOIN LATERAL jsonb_array_elements(j->'snapshot'->'evidence') x WHERE NOT EXISTS(SELECT 1 FROM public.ts_evidence e WHERE e.id=(x->>'id')::uuid AND e.report_id=(x->>'reportId')::uuid AND e.state='ready' AND e.sha256=x->>'sha256')) THEN RAISE EXCEPTION 'TS_package_missing'; END IF;
 SELECT coalesce(jsonb_agg(to_jsonb(e) ORDER BY e.id),'[]') INTO electrical_photos FROM public.ts_evidence e WHERE e.id IN (SELECT (x->>'id')::uuid FROM jsonb_array_elements(jobs) j CROSS JOIN LATERAL jsonb_array_elements(j->'snapshot'->'evidence') x);
 SELECT coalesce(jsonb_agg(to_jsonb(e) ORDER BY occurred_at,id),'[]') INTO events FROM (SELECT * FROM public.ts_events WHERE entity_id IN (SELECT (x->>'id')::uuid FROM jsonb_array_elements(result->'actions') x) AND kind IN ('action_opened','action_updated') AND occurred_at<=cutoff ORDER BY occurred_at,id LIMIT 1001) e;
 IF jsonb_array_length(updates)>500 OR jsonb_array_length(photos)>100 OR jsonb_array_length(report_photos)>100 OR jsonb_array_length(events)>1000 OR jsonb_array_length(electrical_photos)>100 THEN RAISE EXCEPTION 'TS_package_limit'; END IF;
 result:=result||jsonb_build_object('formatVersion',2,'electricalJobs',jobs,'actionUpdates',updates,'actionPhotos',photos,'actionEvents',events,'reportPhotos',report_photos,'electricalPhotos',electrical_photos);
 IF octet_length(result::text)>4194304 THEN RAISE EXCEPTION 'TS_package_limit'; END IF;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.ts_site_evidence_snapshot(uuid,date,date,timestamptz) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ts_site_evidence_snapshot(uuid,date,date,timestamptz) TO authenticated;
CREATE TABLE public.ts_site_packages (
 id uuid PRIMARY KEY,company_id uuid NOT NULL REFERENCES public.ts_companies(id),site_id uuid NOT NULL,
 actor_id uuid NOT NULL REFERENCES auth.users(id),first_day date NOT NULL,last_day date NOT NULL,
 cutoff timestamptz NOT NULL DEFAULT statement_timestamp(),snapshot jsonb NOT NULL,
 state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','ready')),
 object_path text NOT NULL UNIQUE,sha256 text CHECK(sha256 ~ '^[a-f0-9]{64}$'),
 byte_size integer CHECK(byte_size BETWEEN 1 AND 67108864),completed_at timestamptz,
 FOREIGN KEY(company_id,site_id) REFERENCES public.ts_sites(company_id,id),
 CHECK(state<>'ready' OR (sha256 IS NOT NULL AND byte_size IS NOT NULL AND completed_at IS NOT NULL))
);
CREATE INDEX ts_site_packages_parent ON public.ts_site_packages(site_id,actor_id,cutoff DESC);
ALTER TABLE public.ts_site_packages ENABLE ROW LEVEL SECURITY;
CREATE POLICY site_package_read ON public.ts_site_packages FOR SELECT TO authenticated USING(actor_id=auth.uid() AND public.ts_role(company_id) IN ('owner','supervisor'));
REVOKE ALL ON public.ts_site_packages FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.ts_site_packages TO authenticated;
GRANT ALL ON public.ts_site_packages TO service_role;
CREATE FUNCTION public.ts_site_package_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 IF TG_OP='DELETE' OR OLD.state='ready' OR (to_jsonb(NEW)-'state'-'sha256'-'byte_size'-'completed_at') IS DISTINCT FROM (to_jsonb(OLD)-'state'-'sha256'-'byte_size'-'completed_at') THEN RAISE EXCEPTION 'TS_immutable'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER site_package_immutable BEFORE UPDATE OR DELETE ON public.ts_site_packages FOR EACH ROW EXECUTE FUNCTION public.ts_site_package_guard();
CREATE FUNCTION public.ts_site_package_insert(p jsonb,supplied jsonb,captured timestamptz) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public SET timezone='UTC' AS $$
DECLARE s public.ts_sites; receipt public.ts_site_packages; snap jsonb;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'TS_unauthorized'; END IF;
 IF captured IS NULL OR captured>statement_timestamp() OR captured<statement_timestamp()-interval '1 minute' THEN RAISE EXCEPTION 'TS_invalid'; END IF;
 IF p IS NULL OR jsonb_typeof(p)<>'object' OR octet_length(p::text)>1000 OR p->>'id' IS NULL THEN RAISE EXCEPTION 'TS_invalid'; END IF;
 SELECT * INTO s FROM public.ts_sites WHERE id=(p->>'siteId')::uuid;
 IF s.id IS NULL THEN RAISE EXCEPTION 'TS_not_found'; END IF;
 PERFORM 1 FROM public.ts_companies WHERE id=s.company_id FOR UPDATE;
 IF coalesce(public.ts_role(s.company_id),'') NOT IN ('owner','supervisor') THEN RAISE EXCEPTION 'TS_denied'; END IF;
 SELECT * INTO receipt FROM public.ts_site_packages WHERE id=(p->>'id')::uuid;
 IF FOUND THEN
  IF receipt.site_id<>s.id OR receipt.actor_id<>auth.uid() OR receipt.first_day IS DISTINCT FROM (p->>'firstDay')::date OR receipt.last_day IS DISTINCT FROM (p->>'lastDay')::date THEN RAISE EXCEPTION 'TS_conflict'; END IF;
  RETURN to_jsonb(receipt);
 END IF;
 IF (SELECT count(*) FROM public.ts_site_packages WHERE site_id=s.id AND cutoff>captured-interval '1 day')>=20 THEN RAISE EXCEPTION 'TS_package_generation_limit'; END IF;
 -- Caller supplied an invoker/RLS snapshot; independently require an exact authoritative match.
 -- A forged or truncated snapshot cannot be inserted through this narrowly guarded helper.
 snap:=public.ts_site_evidence_snapshot(s.id,(p->>'firstDay')::date,(p->>'lastDay')::date,captured);
 IF snap IS DISTINCT FROM supplied THEN RAISE EXCEPTION 'TS_conflict'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(snap->'reports') r WHERE r->'pdf' IS NULL OR r->'pdf'='null'::jsonb OR r->'pdf'->>'state' IS DISTINCT FROM 'ready') THEN RAISE EXCEPTION 'TS_package_missing'; END IF;
 INSERT INTO public.ts_site_packages(id,company_id,site_id,actor_id,first_day,last_day,cutoff,snapshot,object_path)
 VALUES((p->>'id')::uuid,s.company_id,s.id,auth.uid(),(p->>'firstDay')::date,(p->>'lastDay')::date,captured,snap,s.company_id::text||'/sites/'||s.id::text||'/'||(p->>'id')::uuid::text||'.zip') RETURNING * INTO receipt;
 RETURN to_jsonb(receipt);
END $$;
CREATE FUNCTION public.ts_site_package_prepare(p jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public SET timezone='UTC' AS $$
DECLARE s public.ts_sites; receipt public.ts_site_packages; captured timestamptz:=statement_timestamp(); snap jsonb;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'TS_unauthorized'; END IF;
 IF p IS NULL OR jsonb_typeof(p)<>'object' OR octet_length(p::text)>1000 OR p->>'id' IS NULL THEN RAISE EXCEPTION 'TS_invalid'; END IF;
 SELECT * INTO s FROM public.ts_sites WHERE id=(p->>'siteId')::uuid;
 IF s.id IS NULL THEN RAISE EXCEPTION 'TS_not_found'; END IF;
 IF coalesce(public.ts_role(s.company_id),'') NOT IN ('owner','supervisor') THEN RAISE EXCEPTION 'TS_denied'; END IF;
 SELECT * INTO receipt FROM public.ts_site_packages WHERE id=(p->>'id')::uuid;
 IF FOUND THEN
  IF receipt.site_id<>s.id OR receipt.actor_id<>auth.uid() OR receipt.first_day IS DISTINCT FROM (p->>'firstDay')::date OR receipt.last_day IS DISTINCT FROM (p->>'lastDay')::date THEN RAISE EXCEPTION 'TS_conflict'; END IF;
  RETURN to_jsonb(receipt);
 END IF;
 snap:=public.ts_site_evidence_snapshot(s.id,(p->>'firstDay')::date,(p->>'lastDay')::date,captured);
 RETURN public.ts_site_package_insert(p,snap,captured);
END $$;
CREATE FUNCTION public.ts_complete_site_package(package_id uuid,actor_id uuid,sha256 text,byte_size integer) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE receipt public.ts_site_packages; current_revision integer; saved_revision integer;
BEGIN
 SELECT * INTO receipt FROM public.ts_site_packages WHERE id=package_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'TS_not_found'; END IF;
 PERFORM 1 FROM public.ts_companies WHERE id=receipt.company_id FOR UPDATE;
 SELECT * INTO receipt FROM public.ts_site_packages WHERE id=package_id FOR UPDATE;
 IF receipt.actor_id<>actor_id OR NOT EXISTS(SELECT 1 FROM public.ts_members WHERE company_id=receipt.company_id AND user_id=actor_id AND active AND role IN ('owner','supervisor')) THEN RAISE EXCEPTION 'TS_denied'; END IF;
 IF receipt.state='ready' THEN
  IF receipt.sha256 IS DISTINCT FROM sha256 OR receipt.byte_size IS DISTINCT FROM byte_size THEN RAISE EXCEPTION 'TS_conflict'; END IF;
  RETURN to_jsonb(receipt);
 END IF;
 IF (SELECT revision FROM public.ts_sites WHERE id=receipt.site_id) IS DISTINCT FROM (receipt.snapshot->'site'->>'revision')::integer OR EXISTS(SELECT 1 FROM jsonb_array_elements(receipt.snapshot->'actions') x LEFT JOIN public.ts_actions a ON a.id=(x->>'id')::uuid WHERE a.id IS NULL OR a.revision IS DISTINCT FROM (x->>'revision')::integer) THEN RAISE EXCEPTION 'TS_conflict'; END IF;
 SELECT revision INTO current_revision FROM public.ts_electrical_jobs WHERE site_id=receipt.site_id;
 saved_revision:=(receipt.snapshot->'electricalJobs'->0->>'revision')::integer;
 IF current_revision IS DISTINCT FROM saved_revision THEN RAISE EXCEPTION 'TS_conflict'; END IF;
 UPDATE public.ts_site_packages SET state='ready',sha256=ts_complete_site_package.sha256,byte_size=ts_complete_site_package.byte_size,completed_at=now() WHERE id=package_id RETURNING * INTO receipt;
 RETURN to_jsonb(receipt);
END $$;
CREATE FUNCTION public.ts_site_package_read(package_id uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE receipt public.ts_site_packages;
BEGIN
 SELECT * INTO receipt FROM public.ts_site_packages WHERE id=package_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'TS_not_found'; END IF;
 IF receipt.state<>'ready' THEN RAISE EXCEPTION 'TS_package_pending'; END IF;
 -- Recheck included record visibility, never current revision equality: retained bytes are historical.
 IF NOT EXISTS(SELECT 1 FROM public.ts_sites WHERE id=receipt.site_id)
 OR EXISTS(SELECT 1 FROM jsonb_array_elements(receipt.snapshot->'reports') x WHERE NOT EXISTS(SELECT 1 FROM public.ts_reports WHERE id=(x->>'id')::uuid))
 OR EXISTS(SELECT 1 FROM jsonb_array_elements(receipt.snapshot->'concerns') x WHERE NOT EXISTS(SELECT 1 FROM public.ts_concerns WHERE id=(x->>'id')::uuid))
 OR EXISTS(SELECT 1 FROM jsonb_array_elements(receipt.snapshot->'briefs') x WHERE NOT EXISTS(SELECT 1 FROM public.ts_brief_versions WHERE brief_id=(x->>'brief_id')::uuid AND version=(x->>'version')::integer))
 OR EXISTS(SELECT 1 FROM jsonb_array_elements(receipt.snapshot->'actions') x WHERE NOT EXISTS(SELECT 1 FROM public.ts_actions WHERE id=(x->>'id')::uuid))
 OR EXISTS(SELECT 1 FROM jsonb_array_elements(receipt.snapshot->'electricalPhotos') x WHERE NOT EXISTS(SELECT 1 FROM public.ts_evidence WHERE id=(x->>'id')::uuid AND sha256=x->>'sha256' AND state='ready'))
 OR EXISTS(SELECT 1 FROM jsonb_array_elements(receipt.snapshot->'actionUpdates') x WHERE NOT EXISTS(SELECT 1 FROM public.ts_action_updates WHERE id=(x->>'id')::uuid)) THEN RAISE EXCEPTION 'TS_denied'; END IF;
 RETURN to_jsonb(receipt);
END $$;
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types) VALUES('tradesafe-packages','tradesafe-packages',false,67108864,ARRAY['application/zip']);
-- Explicit restrictive denial also survives any unrelated permissive storage policy.
CREATE POLICY ts_private_packages ON storage.objects AS RESTRICTIVE FOR ALL TO anon,authenticated USING(bucket_id<>'tradesafe-packages') WITH CHECK(bucket_id<>'tradesafe-packages');
REVOKE ALL ON FUNCTION public.ts_site_package_prepare(jsonb),public.ts_site_package_insert(jsonb,jsonb,timestamptz),public.ts_site_package_read(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ts_site_package_prepare(jsonb),public.ts_site_package_insert(jsonb,jsonb,timestamptz),public.ts_site_package_read(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.ts_complete_site_package(uuid,uuid,text,integer),public.ts_site_package_guard() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ts_complete_site_package(uuid,uuid,text,integer) TO service_role;
COMMIT;
