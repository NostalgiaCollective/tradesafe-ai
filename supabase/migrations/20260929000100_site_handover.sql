-- Read-only, caller-RLS snapshot. No records, roles or historical exports change.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
CREATE FUNCTION public.ts_site_handover(site uuid, day date, zone text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=pg_catalog,public SET statement_timeout='8s' SET timezone='UTC' AS $$
DECLARE s public.ts_sites; result jsonb; start_at timestamptz; end_at timestamptz;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'TS_unauthorized'; END IF;
 IF day IS NULL OR day<'2000-01-01' OR day>'2100-12-31' OR zone IS NULL OR zone NOT IN ('America/Toronto','America/Winnipeg','UTC') THEN RAISE EXCEPTION 'TS_invalid'; END IF;
 SELECT * INTO s FROM public.ts_sites WHERE id=site;
 IF s.id IS NULL THEN RAISE EXCEPTION 'TS_not_found'; END IF;
 start_at:=day::timestamp AT TIME ZONE zone; end_at:=(day+1)::timestamp AT TIME ZONE zone;
 -- STABLE uses the invoking statement's MVCC snapshot, including RLS membership checks.
 -- Bound each result and fail the entire response on overflow, never issue a partial summary.
 WITH versions AS MATERIALIZED (
  SELECT v.* FROM public.ts_brief_versions v JOIN public.ts_site_links l ON l.brief_id=v.brief_id AND l.company_id=v.company_id
  WHERE l.site_id=site AND v.company_id=s.company_id AND v.recorded_at>=start_at AND v.recorded_at<end_at ORDER BY v.recorded_at,v.brief_id,v.version LIMIT 201
 ), concerns AS MATERIALIZED (
  SELECT c.id,c.document,c.author_id,c.submitted_at FROM public.ts_concerns c WHERE c.site_id=site AND c.company_id=s.company_id AND c.lifecycle='submitted' AND c.submitted_at>=start_at AND c.submitted_at<end_at ORDER BY c.submitted_at,c.id LIMIT 201
 ), outstanding AS MATERIALIZED (
  SELECT a.* FROM public.ts_action_ownership a WHERE a.site_id=site AND a.company_id=s.company_id AND a.state<>'closed' ORDER BY a.id LIMIT 201
 ), closures AS MATERIALIZED (
  SELECT e.id,e.entity_id,e.actor_id,e.occurred_at,e.after_value,a.state AS current_state FROM public.ts_events e JOIN public.ts_site_actions a ON a.id=e.entity_id AND a.company_id=e.company_id
  WHERE a.site_id=site AND e.company_id=s.company_id AND e.kind='action_updated' AND e.after_value->>'state'='closed' AND e.before_value->>'state' IS DISTINCT FROM 'closed' AND e.occurred_at>=start_at AND e.occurred_at<end_at ORDER BY e.occurred_at,e.id LIMIT 201
 ), acknowledgements AS MATERIALIZED (
  SELECT a.* FROM public.ts_brief_acknowledgements a JOIN versions v ON v.brief_id=a.brief_id AND v.version=a.version AND v.company_id=a.company_id ORDER BY a.brief_id,a.version,a.user_id LIMIT 2001
 ), members AS MATERIALIZED (
  SELECT user_id,display_name,active FROM public.ts_members WHERE company_id=s.company_id
 )
 SELECT jsonb_build_object(
  'formatVersion',1,'actor',auth.uid(),'generatedAt',statement_timestamp(),'date',day,'timezone',zone,'start',start_at,'end',end_at,
  'site',jsonb_build_object('id',s.id,'company_id',s.company_id,'document',s.document,'revision',s.revision,'archived',s.archived),
  'company',(SELECT name FROM public.ts_companies WHERE id=s.company_id),
  'briefs',coalesce((SELECT jsonb_agg(jsonb_build_object('id',v.brief_id,'version',v.version,'recordedAt',v.recorded_at,'recordedBy',coalesce(m.display_name,'Former member'),'task',v.snapshot->'document'->>'task','workDate',v.snapshot->'document'->>'date','participants',v.snapshot->'document'->'crew','attendance',v.attendance,'people',v.snapshot->'people','acknowledgements',coalesce((SELECT jsonb_agg(jsonb_build_object('userId',a.user_id,'at',a.acknowledged_at,'name',coalesce(am.display_name,'Former member'))) FROM acknowledgements a LEFT JOIN members am ON am.user_id=a.user_id WHERE a.brief_id=v.brief_id AND a.version=v.version),'[]'::jsonb)) ORDER BY v.recorded_at,v.brief_id,v.version) FROM versions v LEFT JOIN members m ON m.user_id=v.recorded_by),'[]'::jsonb),
  'concerns',coalesce((SELECT jsonb_agg(to_jsonb(c)||jsonb_build_object('reporter',coalesce(m.display_name,'Former member'),'followUp',(SELECT (to_jsonb(a)-'last_request')||jsonb_build_object('responsible',coalesce(am.display_name,'Unassigned'),'verifiedBy',vm.display_name) FROM public.ts_action_ownership a LEFT JOIN members am ON am.user_id=a.responsible_id LEFT JOIN members vm ON vm.user_id=a.verified_by WHERE a.concern_id=c.id AND a.company_id=s.company_id)) ORDER BY c.submitted_at,c.id) FROM concerns c LEFT JOIN members m ON m.user_id=c.author_id),'[]'::jsonb),
  'outstanding',coalesce((SELECT jsonb_agg((to_jsonb(a)-'last_request')||jsonb_build_object('responsible',CASE WHEN a.responsible_id IS NULL THEN 'Unassigned' ELSE coalesce(m.display_name,'Former member') END) ORDER BY a.id) FROM outstanding a LEFT JOIN members m ON m.user_id=a.responsible_id),'[]'::jsonb),
  'closures',coalesce((SELECT jsonb_agg(jsonb_build_object('eventId',c.id,'id',c.entity_id,'at',c.occurred_at,'verifiedBy',coalesce(m.display_name,'Former member'),'responsible',coalesce(r.display_name,'Unassigned'),'observation',c.after_value->>'observation','resolution',c.after_value->>'resolution','currentState',c.current_state,'report_id',c.after_value->>'report_id','brief_id',c.after_value->>'brief_id','brief_version',c.after_value->'brief_version','concern_id',c.after_value->>'concern_id') ORDER BY c.occurred_at,c.id) FROM closures c LEFT JOIN members m ON m.user_id=c.actor_id LEFT JOIN members r ON r.user_id=(c.after_value->>'responsible_id')::uuid),'[]'::jsonb),
  'overflow',(SELECT count(*)>200 FROM versions) OR (SELECT count(*)>200 FROM concerns) OR (SELECT count(*)>200 FROM outstanding) OR (SELECT count(*)>200 FROM closures) OR (SELECT count(*)>2000 FROM acknowledgements)
 ) INTO result;
 IF (result->>'overflow')::boolean OR octet_length(result::text)>2097152 THEN RAISE EXCEPTION 'TS_summary_limit'; END IF;
 RETURN result-'overflow';
END $$;
REVOKE ALL ON FUNCTION public.ts_site_handover(uuid,date,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ts_site_handover(uuid,date,text) TO authenticated;
COMMIT;
