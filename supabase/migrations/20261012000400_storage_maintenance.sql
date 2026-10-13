-- Service-only bounded cleanup for abandoned action uploads and unretained packages.
-- Existing retained records and applied migrations are never rewritten.
BEGIN;
SET LOCAL lock_timeout='5s';
ALTER TABLE public.ts_site_packages DROP CONSTRAINT ts_site_packages_state_check;
ALTER TABLE public.ts_site_packages ADD CONSTRAINT ts_site_packages_state_check CHECK(state IN ('pending','ready','abandoned'));
CREATE TABLE public.ts_storage_leases (
 kind text NOT NULL CHECK(kind IN ('action_photo','site_package')),object_id uuid NOT NULL,
 token uuid NOT NULL,actor_id uuid,purpose text NOT NULL CHECK(purpose IN ('operation','maintenance')),
 expires_at timestamptz NOT NULL,last_activity_at timestamptz NOT NULL DEFAULT clock_timestamp(),PRIMARY KEY(kind,object_id)
);
CREATE TABLE public.ts_storage_maintenance_receipts (
 token uuid PRIMARY KEY,kind text NOT NULL CHECK(kind IN ('action_photo','site_package')),object_id uuid NOT NULL,
 outcome text NOT NULL CHECK(outcome IN ('removed','failed')),finished_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE public.ts_storage_leases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ts_storage_maintenance_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ts_storage_leases,public.ts_storage_maintenance_receipts FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.ts_storage_leases,public.ts_storage_maintenance_receipts TO service_role;
CREATE TRIGGER storage_receipt_immutable BEFORE UPDATE OR DELETE ON public.ts_storage_maintenance_receipts FOR EACH ROW EXECUTE FUNCTION public.ts_immutable();
CREATE INDEX ts_action_photos_maintenance ON public.ts_action_photos(reserved_at,id) WHERE state IN ('pending','ready');
CREATE INDEX ts_action_photos_removed_maintenance ON public.ts_action_photos(removed_at,id) WHERE state='removed';
CREATE INDEX ts_packages_maintenance ON public.ts_site_packages(cutoff,id) WHERE state IN ('pending','abandoned');
CREATE FUNCTION public.ts_storage_target(kind text,object_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE e public.ts_action_photos;p public.ts_site_packages;
BEGIN
 IF kind='action_photo' THEN
  SELECT * INTO e FROM public.ts_action_photos WHERE id=object_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'TS_not_found'; END IF;
  PERFORM 1 FROM public.ts_companies WHERE id=e.company_id FOR UPDATE;
  PERFORM 1 FROM public.ts_actions WHERE id=e.action_id FOR UPDATE;
  SELECT * INTO e FROM public.ts_action_photos WHERE id=object_id FOR UPDATE;
  RETURN to_jsonb(e)||jsonb_build_object('bucket','tradesafe-evidence');
 ELSIF kind='site_package' THEN
  SELECT * INTO p FROM public.ts_site_packages WHERE id=object_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'TS_not_found'; END IF;
  PERFORM 1 FROM public.ts_companies WHERE id=p.company_id FOR UPDATE;
  SELECT * INTO p FROM public.ts_site_packages WHERE id=object_id FOR UPDATE;
  RETURN jsonb_build_object('id',p.id,'company_id',p.company_id,'actor_id',p.actor_id,'state',p.state,'cutoff',p.cutoff,'object_path',p.object_path,'bucket','tradesafe-packages');
 END IF;
 RAISE EXCEPTION 'TS_invalid';
END $$;
CREATE FUNCTION public.ts_storage_protected(kind text,object_id uuid,path text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT CASE WHEN kind='action_photo' THEN
  EXISTS(SELECT 1 FROM public.ts_action_updates u JOIN public.ts_action_photos p ON p.id=object_id WHERE u.id=p.update_id OR u.evidence_snapshot @> jsonb_build_array(jsonb_build_object('id',object_id)) OR u.evidence_snapshot @> jsonb_build_array(jsonb_build_object('object_path',path)))
  OR EXISTS(SELECT 1 FROM public.ts_site_packages p WHERE p.state='ready' AND jsonb_path_exists(p.snapshot,'$.**.object_path ? (@ == $path)',jsonb_build_object('path',path)))
 WHEN kind='site_package' THEN EXISTS(SELECT 1 FROM public.ts_site_packages p WHERE p.id=object_id AND p.state='ready') ELSE true END
$$;
CREATE FUNCTION public.ts_storage_lease(command text,kind text,object_id uuid,actor_id uuid,token uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE target jsonb; old public.ts_storage_leases; a public.ts_actions; until_at timestamptz;
BEGIN
 IF token IS NULL OR actor_id IS NULL OR command NOT IN ('begin','renew','end') OR command IS NULL THEN RAISE EXCEPTION 'TS_invalid'; END IF;
 target:=public.ts_storage_target(kind,object_id);
 SELECT * INTO old FROM public.ts_storage_leases l WHERE l.kind=ts_storage_lease.kind AND l.object_id=ts_storage_lease.object_id FOR UPDATE;
 IF command='end' THEN
  IF old.token IS NULL THEN RETURN jsonb_build_object('status','released'); END IF;
  IF old.token<>token OR old.actor_id IS DISTINCT FROM actor_id OR old.purpose<>'operation' THEN RAISE EXCEPTION 'TS_conflict'; END IF;
  UPDATE public.ts_storage_leases l SET expires_at=clock_timestamp(),last_activity_at=clock_timestamp() WHERE l.kind=ts_storage_lease.kind AND l.object_id=ts_storage_lease.object_id;
  RETURN jsonb_build_object('status','released');
 END IF;
 IF kind='action_photo' THEN
  SELECT * INTO a FROM public.ts_actions WHERE id=(target->>'action_id')::uuid;
  IF (target->>'uploader_id')::uuid<>actor_id OR NOT EXISTS(SELECT 1 FROM public.ts_members m WHERE m.company_id=a.company_id AND m.user_id=actor_id AND m.active AND (m.role IN ('owner','supervisor') OR a.responsible_id=actor_id)) THEN RAISE EXCEPTION 'TS_denied'; END IF;
  IF target->>'state'='removed' OR a.state='closed' OR public.ts_storage_protected(kind,object_id,target->>'object_path') THEN RAISE EXCEPTION 'TS_immutable'; END IF;
  IF a.revision IS DISTINCT FROM (target->>'basis_revision')::integer THEN RAISE EXCEPTION 'TS_conflict'; END IF;
 ELSE
  IF (target->>'actor_id')::uuid<>actor_id OR NOT EXISTS(SELECT 1 FROM public.ts_members m WHERE m.company_id=(target->>'company_id')::uuid AND m.user_id=actor_id AND m.active AND m.role IN ('owner','supervisor')) THEN RAISE EXCEPTION 'TS_denied'; END IF;
  IF target->>'state'='abandoned' THEN RAISE EXCEPTION 'TS_package_abandoned'; END IF;
  IF target->>'state'<>'pending' THEN RAISE EXCEPTION 'TS_immutable'; END IF;
 END IF;
 IF old.token IS NOT NULL AND old.expires_at>clock_timestamp() AND (old.token<>token OR old.purpose<>'operation' OR old.actor_id IS DISTINCT FROM actor_id) THEN RAISE EXCEPTION 'TS_storage_busy'; END IF;
 IF command='renew' AND (old.token IS DISTINCT FROM token OR old.purpose IS DISTINCT FROM 'operation' OR old.actor_id IS DISTINCT FROM actor_id OR old.expires_at<=clock_timestamp()) THEN RAISE EXCEPTION 'TS_conflict'; END IF;
 until_at:=clock_timestamp()+interval '120 seconds';
 INSERT INTO public.ts_storage_leases AS l (kind,object_id,token,actor_id,purpose,expires_at,last_activity_at) VALUES(kind,object_id,token,actor_id,'operation',until_at,clock_timestamp())
 ON CONFLICT ON CONSTRAINT ts_storage_leases_pkey DO UPDATE SET token=EXCLUDED.token,actor_id=EXCLUDED.actor_id,purpose=EXCLUDED.purpose,expires_at=EXCLUDED.expires_at,last_activity_at=clock_timestamp();
 RETURN jsonb_build_object('status','leased','expires_at',until_at);
END $$;
CREATE FUNCTION public.ts_storage_candidates(batch_size integer DEFAULT 25) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public SET statement_timeout='8s' AS $$
DECLARE result jsonb;
BEGIN
 IF batch_size IS NULL OR batch_size<1 OR batch_size>25 THEN RAISE EXCEPTION 'TS_invalid'; END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('kind',kind,'id',id,'reason',reason,'eligible_at',eligible_at) ORDER BY eligible_at,kind,id),'[]') INTO result FROM (
  SELECT c.* FROM (
   SELECT 'action_photo'::text kind,p.id,p.object_path,CASE WHEN p.state='removed' THEN 'removed' ELSE 'unsubmitted_expired' END reason,CASE WHEN p.state='removed' THEN p.removed_at+interval '15 minutes' ELSE greatest(p.reserved_at,p.uploaded_at,(SELECT last_activity_at FROM public.ts_storage_leases l WHERE l.kind='action_photo' AND l.object_id=p.id))+interval '7 days' END eligible_at
   FROM public.ts_action_photos p WHERE (p.state IN ('pending','ready') AND greatest(p.reserved_at,p.uploaded_at,(SELECT last_activity_at FROM public.ts_storage_leases l WHERE l.kind='action_photo' AND l.object_id=p.id))<=statement_timestamp()-interval '7 days') OR (p.state='removed' AND p.removed_at<=statement_timestamp()-interval '15 minutes')
   UNION ALL
   SELECT 'site_package',p.id,p.object_path,CASE WHEN p.state='abandoned' THEN 'abandoned' ELSE 'pending_expired' END,CASE WHEN p.state='abandoned' THEN p.cutoff ELSE greatest(p.cutoff,(SELECT last_activity_at FROM public.ts_storage_leases l WHERE l.kind='site_package' AND l.object_id=p.id))+interval '7 days' END
   FROM public.ts_site_packages p WHERE p.state='abandoned' OR (p.state='pending' AND greatest(p.cutoff,(SELECT last_activity_at FROM public.ts_storage_leases l WHERE l.kind='site_package' AND l.object_id=p.id))<=statement_timestamp()-interval '7 days')
  ) c WHERE NOT EXISTS(SELECT 1 FROM public.ts_storage_leases l WHERE l.kind=c.kind AND l.object_id=c.id AND l.expires_at>statement_timestamp())
  AND NOT public.ts_storage_protected(c.kind,c.id,c.object_path)
  ORDER BY greatest(eligible_at,(SELECT last_activity_at FROM public.ts_storage_leases l WHERE l.kind=c.kind AND l.object_id=c.id AND l.purpose='maintenance')),kind,id LIMIT batch_size
 ) bounded;
 RETURN result;
END $$;
CREATE FUNCTION public.ts_storage_maintenance(command text,kind text,object_id uuid,token uuid,outcome text DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public SET statement_timeout='8s' AS $$
DECLARE target jsonb; old public.ts_storage_leases; until_at timestamptz; prior public.ts_storage_maintenance_receipts;
BEGIN
 IF command IS NULL OR command NOT IN ('claim','recheck','finish','release') OR token IS NULL OR (command='finish' AND (outcome IS NULL OR outcome NOT IN ('removed','failed'))) THEN RAISE EXCEPTION 'TS_invalid'; END IF;
 target:=public.ts_storage_target(kind,object_id);
 IF public.ts_storage_protected(kind,object_id,target->>'object_path') THEN RAISE EXCEPTION 'TS_immutable'; END IF;
 SELECT * INTO old FROM public.ts_storage_leases l WHERE l.kind=ts_storage_maintenance.kind AND l.object_id=ts_storage_maintenance.object_id FOR UPDATE;
 IF command='finish' THEN
  SELECT * INTO prior FROM public.ts_storage_maintenance_receipts r WHERE r.token=ts_storage_maintenance.token;
  IF FOUND THEN
   IF prior.kind<>kind OR prior.object_id<>object_id OR prior.outcome<>outcome THEN RAISE EXCEPTION 'TS_conflict'; END IF;
   RETURN jsonb_build_object('kind',kind,'id',object_id,'status',prior.outcome,'finished_at',prior.finished_at);
  END IF;
 END IF;
 IF command='claim' THEN
  IF EXISTS(SELECT 1 FROM public.ts_storage_maintenance_receipts r WHERE r.token=ts_storage_maintenance.token) THEN RAISE EXCEPTION 'TS_conflict'; END IF;
  IF old.token IS NOT NULL AND old.expires_at>clock_timestamp() AND (old.token<>token OR old.purpose<>'maintenance') THEN RAISE EXCEPTION 'TS_storage_busy'; END IF;
  IF kind='action_photo' THEN
   IF NOT ((target->>'state' IN ('pending','ready') AND greatest((target->>'reserved_at')::timestamptz,(target->>'uploaded_at')::timestamptz,old.last_activity_at)<=clock_timestamp()-interval '7 days') OR (target->>'state'='removed' AND (target->>'removed_at')::timestamptz<=clock_timestamp()-interval '15 minutes') OR coalesce(old.token=token AND old.purpose='maintenance' AND target->>'state'='removed',false)) THEN RAISE EXCEPTION 'TS_maintenance_ineligible'; END IF;
   IF target->>'state'<>'removed' THEN UPDATE public.ts_action_photos SET state='removed',removed_at=clock_timestamp() WHERE id=object_id; END IF;
  ELSE
   IF NOT (target->>'state'='abandoned' OR (target->>'state'='pending' AND greatest((target->>'cutoff')::timestamptz,old.last_activity_at)<=clock_timestamp()-interval '7 days')) THEN RAISE EXCEPTION 'TS_maintenance_ineligible'; END IF;
   IF target->>'state'<>'abandoned' THEN UPDATE public.ts_site_packages SET state='abandoned' WHERE id=object_id; END IF;
  END IF;
  until_at:=clock_timestamp()+interval '120 seconds';
  INSERT INTO public.ts_storage_leases AS l (kind,object_id,token,actor_id,purpose,expires_at,last_activity_at) VALUES(kind,object_id,token,NULL,'maintenance',until_at,clock_timestamp())
  ON CONFLICT ON CONSTRAINT ts_storage_leases_pkey DO UPDATE SET token=EXCLUDED.token,actor_id=NULL,purpose='maintenance',expires_at=EXCLUDED.expires_at,last_activity_at=clock_timestamp();
 ELSIF old.token IS DISTINCT FROM token OR old.purpose IS DISTINCT FROM 'maintenance' OR (command<>'finish' AND old.expires_at<=clock_timestamp()) THEN RAISE EXCEPTION 'TS_conflict';
 ELSIF command='finish' THEN
  INSERT INTO public.ts_storage_maintenance_receipts(token,kind,object_id,outcome) VALUES(token,kind,object_id,outcome) RETURNING * INTO prior;
  UPDATE public.ts_storage_leases l SET expires_at=clock_timestamp(),last_activity_at=clock_timestamp() WHERE l.kind=ts_storage_maintenance.kind AND l.object_id=ts_storage_maintenance.object_id;
  RETURN jsonb_build_object('kind',kind,'id',object_id,'status',prior.outcome,'finished_at',prior.finished_at);
 ELSIF command='release' THEN
  UPDATE public.ts_storage_leases l SET expires_at=clock_timestamp(),last_activity_at=clock_timestamp() WHERE l.kind=ts_storage_maintenance.kind AND l.object_id=ts_storage_maintenance.object_id;
  RETURN jsonb_build_object('kind',kind,'id',object_id,'status','released');
 ELSE
  until_at:=clock_timestamp()+interval '120 seconds';
  UPDATE public.ts_storage_leases l SET expires_at=until_at WHERE l.kind=ts_storage_maintenance.kind AND l.object_id=ts_storage_maintenance.object_id;
 END IF;
 RETURN jsonb_build_object('kind',kind,'id',object_id,'status','claimed','bucket',target->>'bucket','object_path',target->>'object_path','expires_at',until_at);
END $$;
-- Terminal package abandonment cannot be undone by delayed completion or retries.
CREATE OR REPLACE FUNCTION public.ts_site_package_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 IF TG_OP='DELETE' OR OLD.state IN ('ready','abandoned') OR (to_jsonb(NEW)-'state'-'sha256'-'byte_size'-'completed_at') IS DISTINCT FROM (to_jsonb(OLD)-'state'-'sha256'-'byte_size'-'completed_at') THEN RAISE EXCEPTION 'TS_immutable'; END IF;
 RETURN NEW;
END $$;
DO $migration$
DECLARE name text; source text; needle text;
BEGIN
 FOREACH name IN ARRAY ARRAY['public.ts_site_package_prepare(jsonb)','public.ts_site_package_insert(jsonb,jsonb,timestamptz)'] LOOP
  SELECT pg_get_functiondef(name::regprocedure) INTO source;
  needle:='IF receipt.site_id<>s.id OR receipt.actor_id<>auth.uid() OR receipt.first_day IS DISTINCT FROM (p->>''firstDay'')::date OR receipt.last_day IS DISTINCT FROM (p->>''lastDay'')::date THEN RAISE EXCEPTION ''TS_conflict''; END IF;';
  IF (length(source)-length(replace(source,needle,'')))/length(needle)<>1 THEN RAISE EXCEPTION 'Unexpected package preparation definition'; END IF;
  EXECUTE replace(source,needle,needle||' IF receipt.state=''abandoned'' THEN RAISE EXCEPTION ''TS_package_abandoned''; END IF;');
 END LOOP;
 SELECT pg_get_functiondef('public.ts_complete_site_package(uuid,uuid,text,integer)'::regprocedure) INTO source;
 needle:='IF receipt.state=''ready'' THEN';
 IF (length(source)-length(replace(source,needle,'')))/length(needle)<>1 THEN RAISE EXCEPTION 'Unexpected package completion definition'; END IF;
 EXECUTE replace(source,needle,'IF receipt.state=''abandoned'' THEN RAISE EXCEPTION ''TS_package_abandoned''; END IF; '||needle);
 SELECT pg_get_functiondef('public.ts_site_package_read(uuid)'::regprocedure) INTO source;
 needle:='IF receipt.state<>''ready'' THEN';
 IF (length(source)-length(replace(source,needle,'')))/length(needle)<>1 THEN RAISE EXCEPTION 'Unexpected package read definition'; END IF;
 EXECUTE replace(source,needle,'IF receipt.state=''abandoned'' THEN RAISE EXCEPTION ''TS_package_abandoned''; END IF; '||needle);
END $migration$;
REVOKE ALL ON FUNCTION public.ts_storage_target(text,uuid),public.ts_storage_protected(text,uuid,text),public.ts_storage_lease(text,text,uuid,uuid,uuid),public.ts_storage_candidates(integer),public.ts_storage_maintenance(text,text,uuid,uuid,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.ts_storage_lease(text,text,uuid,uuid,uuid),public.ts_storage_candidates(integer),public.ts_storage_maintenance(text,text,uuid,uuid,text) TO service_role;
COMMIT;
