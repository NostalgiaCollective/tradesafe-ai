-- Narrow read-only receipt lookup for recovering ambiguous electrical operations.
-- Returns no documents, credentials, other actors' results or additional table access.
BEGIN;
SET LOCAL lock_timeout='5s';
CREATE FUNCTION public.ts_electrical_receipt(site uuid,request_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE actor uuid:=auth.uid(); company uuid; result jsonb;
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'TS_unauthorized'; END IF;
 -- The same denial covers missing sites and sites outside the caller's permitted scope.
 SELECT s.company_id INTO company FROM public.ts_sites s JOIN public.ts_members m ON m.company_id=s.company_id AND m.user_id=actor AND m.active AND m.role IN ('owner','supervisor') WHERE s.id=site;
 IF company IS NULL THEN RAISE EXCEPTION 'TS_denied'; END IF;
 SELECT jsonb_build_object('requestId',r.request_id,'revision',r.result->'revision') INTO result
 FROM public.ts_site_requests r WHERE r.company_id=company AND r.actor_id=actor AND r.request_id=ts_electrical_receipt.request_id
 AND r.result->>'site_id'=site::text AND r.result->>'company_id'=company::text
 AND jsonb_typeof(r.result->'revision')='number' AND r.result->>'revision' ~ '^[1-9][0-9]*$';
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.ts_electrical_receipt(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ts_electrical_receipt(uuid,uuid) TO authenticated;
COMMIT;
