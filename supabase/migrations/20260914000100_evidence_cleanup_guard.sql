-- Forward repair: cleanup must verify snapshot references without granting broad report reads to service_role.
BEGIN;
SET LOCAL lock_timeout='5s';
CREATE FUNCTION public.ts_evidence_cleanup_candidate(evidence_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public AS $$
DECLARE e public.ts_evidence; snapshot jsonb;
BEGIN
 SELECT * INTO e FROM public.ts_evidence WHERE id=evidence_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'TS_not_found'; END IF;
 PERFORM 1 FROM public.ts_companies WHERE id=e.company_id FOR UPDATE;
 SELECT evidence_snapshot INTO snapshot FROM public.ts_reports WHERE id=e.report_id FOR UPDATE;
 SELECT * INTO e FROM public.ts_evidence WHERE id=evidence_id;
 IF e.state<>'removed' OR EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(snapshot,'[]')) p WHERE p->>'id'=e.id::text OR p->>'object_path'=e.object_path)
 THEN RAISE EXCEPTION 'TS_immutable'; END IF;
 RETURN jsonb_build_object('id',e.id,'report_id',e.report_id,'object_path',e.object_path);
END $$;
REVOKE ALL ON FUNCTION public.ts_evidence_cleanup_candidate(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ts_evidence_cleanup_candidate(uuid) TO service_role;
COMMIT;
