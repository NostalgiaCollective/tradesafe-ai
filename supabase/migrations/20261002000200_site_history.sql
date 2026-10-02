BEGIN;
SET LOCAL lock_timeout='5s';
CREATE INDEX ts_brief_versions_recorded ON public.ts_brief_versions(company_id,recorded_at,brief_id,version);
CREATE INDEX ts_reports_finalized ON public.ts_reports(company_id,finalized_at,id) WHERE lifecycle='finalized';
CREATE INDEX ts_concerns_submitted ON public.ts_concerns(site_id,submitted_at,id) WHERE lifecycle='submitted';
CREATE INDEX ts_events_recorded ON public.ts_events(company_id,occurred_at,id);
-- All branches run under the caller's RLS. No definer search or materialized public index.
CREATE VIEW public.ts_site_history WITH(security_invoker=true) AS
 SELECT l.site_id,v.company_id,'brief'::text kind,v.brief_id record_id,'brief:'||v.brief_id||':'||v.version event_key,v.recorded_at occurred_at,v.version revision,
 v.snapshot->'document'->>'task' title,coalesce(v.snapshot->'document'->>'task','')||' '||coalesce((v.snapshot->'document'->'steps')::text,'') search_text,'Recorded version'::text event_status,NULL::text current_status,
 v.recorded_by actor_id,jsonb_build_object('version',v.version) reference
 FROM public.ts_brief_versions v JOIN public.ts_site_links l ON l.brief_id=v.brief_id AND l.company_id=v.company_id
 UNION ALL
 SELECT c.site_id,c.company_id,'concern',c.id,'concern:'||c.id,c.submitted_at,c.revision,c.document->>'observation',concat_ws(' ',c.document->>'observation',c.document->>'location',c.document->>'immediate'),'Submitted original',NULL,c.author_id,'{}'::jsonb
 FROM public.ts_concerns c WHERE c.lifecycle='submitted'
 UNION ALL
 SELECT l.site_id,r.company_id,CASE WHEN r.amendment_of IS NULL THEN 'report' ELSE 'amendment' END,r.id,'report:'||r.id,r.finalized_at,r.revision,
 concat_ws(' — ',r.template_snapshot->>'trade',r.document->'job'->>'address',r.amendment_reason),concat_ws(' ',r.document->'job'->>'address',r.document->'job'->>'client',r.amendment_reason,(r.document->'answers')::text),CASE WHEN r.amendment_of IS NULL THEN 'Finalized original' ELSE 'Finalized separate amendment' END,NULL,r.finalized_by,jsonb_build_object('amendmentOf',r.amendment_of)
 FROM public.ts_reports r JOIN public.ts_site_links l ON l.report_id=r.id AND l.company_id=r.company_id WHERE r.lifecycle='finalized'
 UNION ALL
 SELECT a.site_id,e.company_id,'action',e.entity_id,'action:'||e.id,e.occurred_at,(e.after_value->>'revision')::integer,
 e.after_value->>'observation',concat_ws(' ',e.after_value->>'observation',e.after_value->>'resolution',e.after_value->>'controls'),e.kind,a.state,e.actor_id,
 jsonb_build_object('eventId',e.id,'reportId',a.report_id,'briefId',a.brief_id,'briefVersion',a.brief_version,'concernId',a.concern_id,'before',e.before_value-'last_request','after',e.after_value-'last_request')
 FROM public.ts_events e JOIN public.ts_site_actions a ON a.id=e.entity_id AND a.company_id=e.company_id WHERE e.kind IN ('action_opened','action_updated');
REVOKE ALL ON public.ts_site_history FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.ts_site_history TO authenticated;
CREATE FUNCTION public.ts_search_site_history(site uuid,first_day date,last_day date,kind_filter text DEFAULT 'all',query_text text DEFAULT '',cutoff timestamptz DEFAULT now(),before_at timestamptz DEFAULT NULL,before_key text DEFAULT '') RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=pg_catalog,public SET statement_timeout='8s' SET timezone='UTC' AS $$
DECLARE result jsonb; start_at timestamptz; end_at timestamptz;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'TS_unauthorized'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.ts_sites WHERE id=site) THEN RAISE EXCEPTION 'TS_not_found'; END IF;
 IF first_day IS NULL OR last_day IS NULL OR first_day<'2000-01-01' OR last_day>'2100-12-31' OR last_day<first_day OR last_day-first_day>365 OR kind_filter IS NULL OR kind_filter NOT IN ('all','brief','concern','report','amendment','action') OR query_text IS NULL OR length(query_text)>120 OR cutoff IS NULL OR cutoff>statement_timestamp() OR length(before_key)>100 THEN RAISE EXCEPTION 'TS_invalid'; END IF;
 start_at:=first_day::timestamp AT TIME ZONE 'America/Toronto';end_at:=(last_day+1)::timestamp AT TIME ZONE 'America/Toronto';
 SELECT jsonb_build_object('cutoff',cutoff,'timezone','America/Toronto','rows',coalesce(jsonb_agg(to_jsonb(h)-'search_text' ORDER BY h.occurred_at DESC,h.event_key DESC),'[]')) INTO result FROM (
  SELECT * FROM public.ts_site_history WHERE site_id=site AND occurred_at>=start_at AND occurred_at<end_at AND occurred_at<=cutoff
   AND (kind_filter='all' OR kind=kind_filter) AND (query_text='' OR strpos(lower(search_text),lower(query_text))>0)
   AND (before_at IS NULL OR (occurred_at,event_key)<(before_at,before_key)) ORDER BY occurred_at DESC,event_key DESC LIMIT 31
 ) h;
 IF octet_length(result::text)>2097152 THEN RAISE EXCEPTION 'TS_summary_limit'; END IF;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.ts_search_site_history(uuid,date,date,text,text,timestamptz,timestamptz,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ts_search_site_history(uuid,date,date,text,text,timestamptz,timestamptz,text) TO authenticated;
COMMIT;
