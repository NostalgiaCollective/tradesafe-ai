-- Read-only projections over existing versioned records. No new access or mutation rules.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
CREATE VIEW public.ts_brief_participation WITH (security_invoker=true) AS
 SELECT v.company_id,v.brief_id,v.version,v.recorded_at,
  person.id::uuid AS user_id,
  coalesce(m.active,false) AS member_active,a.acknowledged_at,
  v.version=(SELECT max(x.version) FROM public.ts_brief_versions x WHERE x.brief_id=v.brief_id) AS latest_recorded,
  b.lifecycle='recorded' AND b.revision=v.version AS can_acknowledge,
  b.lifecycle='draft' AS revision_in_progress,
  v.snapshot->'document'->>'site' AS record_site,v.snapshot->'document'->>'task' AS task,
  v.snapshot->'document'->>'date' AS work_date,l.site_id
 FROM public.ts_brief_versions v
 JOIN public.ts_briefs b ON b.id=v.brief_id AND b.company_id=v.company_id
 CROSS JOIN LATERAL jsonb_array_elements_text(v.snapshot->'document'->'crew') person(id)
 LEFT JOIN public.ts_members m ON m.company_id=v.company_id AND m.user_id=person.id::uuid
 LEFT JOIN public.ts_brief_acknowledgements a ON a.brief_id=v.brief_id AND a.version=v.version AND a.user_id=person.id::uuid
 LEFT JOIN public.ts_site_links l ON l.brief_id=v.brief_id AND l.company_id=v.company_id;
CREATE VIEW public.ts_brief_response_summary WITH (security_invoker=true) AS
 SELECT company_id,brief_id,version,recorded_at,record_site,task,work_date,site_id,can_acknowledge,revision_in_progress,
  count(*) AS participants,
  count(*) FILTER(WHERE acknowledged_at IS NOT NULL) AS acknowledged,
  count(*) FILTER(WHERE acknowledged_at IS NULL AND member_active) AS pending,
  count(*) FILTER(WHERE NOT member_active) AS removed_participants
 FROM public.ts_brief_participation WHERE latest_recorded
 GROUP BY company_id,brief_id,version,recorded_at,record_site,task,work_date,site_id,can_acknowledge,revision_in_progress;
CREATE VIEW public.ts_action_ownership WITH (security_invoker=true) AS
 SELECT a.*,coalesce(m.active,false) AS assignee_active,
  a.state<>'closed' AND (a.responsible_id IS NULL OR NOT coalesce(m.active,false)) AS needs_reassignment,
  l.site_id,coalesce(v.snapshot->'document'->>'site',r.document->'job'->>'address','Original record') AS record_site
 FROM public.ts_actions a
 LEFT JOIN public.ts_members m ON m.company_id=a.company_id AND m.user_id=a.responsible_id
 LEFT JOIN public.ts_reports r ON r.id=a.report_id AND r.company_id=a.company_id
 LEFT JOIN public.ts_brief_versions v ON v.brief_id=a.brief_id AND v.version=a.brief_version AND v.company_id=a.company_id
 LEFT JOIN public.ts_site_links l ON l.company_id=a.company_id AND (l.report_id=a.report_id OR l.brief_id=a.brief_id);
REVOKE ALL ON public.ts_brief_participation,public.ts_brief_response_summary,public.ts_action_ownership FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.ts_brief_participation,public.ts_brief_response_summary,public.ts_action_ownership TO authenticated;
COMMIT;
