BEGIN;
SET LOCAL lock_timeout='5s';
CREATE FUNCTION public.ts_site_evidence_snapshot(site uuid,first_day date,last_day date,cutoff timestamptz DEFAULT now()) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=pg_catalog,public SET statement_timeout='8s' SET timezone='UTC' AS $$
DECLARE s public.ts_sites; result jsonb; history jsonb; start_at timestamptz; end_at timestamptz;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'TS_unauthorized'; END IF;
 SELECT * INTO s FROM public.ts_sites WHERE id=site;
 IF s.id IS NULL THEN RAISE EXCEPTION 'TS_not_found'; END IF;
 IF first_day IS NULL OR last_day IS NULL OR first_day<'2000-01-01' OR last_day>'2100-12-31' OR last_day<first_day OR last_day-first_day>30 OR cutoff IS NULL OR cutoff>statement_timestamp() THEN RAISE EXCEPTION 'TS_invalid'; END IF;
 start_at:=first_day::timestamp AT TIME ZONE 'America/Toronto';end_at:=(last_day+1)::timestamp AT TIME ZONE 'America/Toronto';
 SELECT coalesce(jsonb_agg(to_jsonb(h)-'search_text' ORDER BY occurred_at,event_key),'[]') INTO history FROM (SELECT * FROM public.ts_site_history WHERE site_id=site AND occurred_at>=start_at AND occurred_at<end_at AND occurred_at<=cutoff ORDER BY occurred_at,event_key LIMIT 201) h;
 IF jsonb_array_length(history)>200 THEN RAISE EXCEPTION 'TS_package_limit'; END IF;
 WITH chosen AS MATERIALIZED (SELECT * FROM jsonb_to_recordset(history) AS h(kind text,record_id uuid,revision integer)),
 reports AS MATERIALIZED (SELECT r.id,r.revision,r.amendment_of,r.evidence_snapshot,r.finalized_at FROM public.ts_reports r WHERE r.id IN (SELECT record_id FROM chosen WHERE kind IN ('report','amendment'))),
 briefs AS MATERIALIZED (SELECT v.* FROM public.ts_brief_versions v JOIN chosen h ON h.kind='brief' AND h.record_id=v.brief_id AND h.revision=v.version),
 concerns AS MATERIALIZED (SELECT c.* FROM public.ts_concerns c WHERE c.id IN (SELECT record_id FROM chosen WHERE kind='concern')),
 actions AS MATERIALIZED (SELECT a.* FROM public.ts_action_ownership a WHERE a.site_id=site AND (a.id IN (SELECT record_id FROM chosen WHERE kind='action') OR a.report_id IN (SELECT id FROM reports) OR a.brief_id IN (SELECT brief_id FROM briefs) OR a.concern_id IN (SELECT id FROM concerns)) ORDER BY a.id LIMIT 101),
 acks AS MATERIALIZED (SELECT a.* FROM public.ts_brief_acknowledgements a JOIN briefs v ON v.brief_id=a.brief_id AND v.version=a.version WHERE a.acknowledged_at<=cutoff ORDER BY a.brief_id,a.version,a.user_id LIMIT 1001),
 reviews AS MATERIALIZED (SELECT a.* FROM public.ts_brief_reviews a JOIN briefs v ON v.brief_id=a.brief_id AND v.version=a.version WHERE a.reviewed_at<=cutoff ORDER BY a.brief_id,a.version,a.item_id LIMIT 1001),
 photos AS MATERIALIZED (SELECT p.* FROM public.ts_concern_photos p WHERE p.concern_id IN (SELECT id FROM concerns) AND p.state='ready' ORDER BY p.id LIMIT 101),
 notes AS MATERIALIZED (SELECT n.* FROM public.ts_concern_notes n WHERE n.concern_id IN (SELECT id FROM concerns) ORDER BY n.id LIMIT 201)
 SELECT jsonb_build_object('formatVersion',1,'cutoff',cutoff,'timezone','America/Toronto','firstDay',first_day,'lastDay',last_day,'site',jsonb_build_object('id',s.id,'companyId',s.company_id,'document',s.document,'revision',s.revision),'history',history,
 'reports',coalesce((SELECT jsonb_agg(to_jsonb(r)||jsonb_build_object('pdf',(SELECT jsonb_build_object('id',x.id,'object_path',x.object_path,'sha256',x.sha256,'byte_size',x.byte_size,'state',x.state,'snapshot_version',x.snapshot_version,'completed_at',x.completed_at) FROM public.ts_exports x WHERE x.report_id=r.id AND x.export_version=1)) ORDER BY r.id) FROM reports r),'[]'),
 'briefs',coalesce((SELECT jsonb_agg(to_jsonb(v)-'request_id' ORDER BY v.brief_id,v.version) FROM briefs v),'[]'),
 'acknowledgements',coalesce((SELECT jsonb_agg(to_jsonb(a) ORDER BY a.brief_id,a.version,a.user_id) FROM acks a),'[]'),
 'reviews',coalesce((SELECT jsonb_agg(to_jsonb(a) ORDER BY a.brief_id,a.version,a.item_id) FROM reviews a),'[]'),
 'concerns',coalesce((SELECT jsonb_agg(to_jsonb(c) ORDER BY c.id) FROM concerns c),'[]'),
 'photos',coalesce((SELECT jsonb_agg(to_jsonb(p) ORDER BY p.id) FROM photos p),'[]'),
 'notes',coalesce((SELECT jsonb_agg(to_jsonb(n) ORDER BY n.id) FROM notes n),'[]'),
 'actions',coalesce((SELECT jsonb_agg((to_jsonb(a)-'last_request')||jsonb_build_object('responsibleName',m.display_name,'verifiedName',v.display_name) ORDER BY a.id) FROM actions a LEFT JOIN public.ts_members m ON m.company_id=a.company_id AND m.user_id=a.responsible_id LEFT JOIN public.ts_members v ON v.company_id=a.company_id AND v.user_id=a.verified_by),'[]'),
 'overflow',(SELECT count(*)>100 FROM actions) OR (SELECT count(*)>1000 FROM acks) OR (SELECT count(*)>1000 FROM reviews) OR (SELECT count(*)>100 FROM photos) OR (SELECT count(*)>200 FROM notes)
 ) INTO result;
 IF (result->>'overflow')::boolean OR octet_length(result::text)>4194304 THEN RAISE EXCEPTION 'TS_package_limit'; END IF;
 RETURN result-'overflow';
END $$;
REVOKE ALL ON FUNCTION public.ts_site_evidence_snapshot(uuid,date,date,timestamptz) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ts_site_evidence_snapshot(uuid,date,date,timestamptz) TO authenticated;
CREATE FUNCTION public.ts_site_package_admit(site uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE company uuid; keys text[]; limits integer[]:=ARRAY[30,20,10]; i integer;
BEGIN
 SELECT company_id INTO company FROM public.ts_sites WHERE id=site;
 IF auth.uid() IS NULL OR company IS NULL OR public.ts_role(company) IS NULL THEN RAISE EXCEPTION 'TS_denied'; END IF;
 keys:=ARRAY['package:global','package:company:'||right(md5(company::text),3),'package:user:'||right(md5(auth.uid()::text),3)];
 PERFORM pg_advisory_xact_lock(74160916);
 FOR i IN 1..3 LOOP
  INSERT INTO public.ts_resource_limits VALUES(keys[i],now(),0) ON CONFLICT DO NOTHING;
  UPDATE public.ts_resource_limits SET window_start=now(),count=0 WHERE key=keys[i] AND window_start<=now()-interval '10 minutes';
 END LOOP;
 FOR i IN 1..3 LOOP IF (SELECT count FROM public.ts_resource_limits WHERE key=keys[i])>=limits[i] THEN RETURN false; END IF; END LOOP;
 UPDATE public.ts_resource_limits SET count=count+1 WHERE key=ANY(keys);RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.ts_site_package_admit(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ts_site_package_admit(uuid) TO authenticated;
COMMIT;
