-- Append-only action completion updates. Original findings and verification rules remain unchanged.
BEGIN;
SET LOCAL lock_timeout='5s';
CREATE TABLE public.ts_action_updates (
 id uuid PRIMARY KEY, company_id uuid NOT NULL REFERENCES public.ts_companies(id),
 action_id uuid NOT NULL REFERENCES public.ts_actions(id), site_id uuid,
 basis_revision integer NOT NULL CHECK(basis_revision>0), submitted_revision integer NOT NULL,
 actor_id uuid NOT NULL REFERENCES auth.users(id), actor_label text NOT NULL,
 notes text NOT NULL CHECK(length(trim(notes)) BETWEEN 1 AND 4000),
 state text NOT NULL CHECK(state IN ('in_progress','awaiting_verification')),
 evidence_snapshot jsonb NOT NULL CHECK(jsonb_typeof(evidence_snapshot)='array' AND jsonb_array_length(evidence_snapshot)<=10),
 recorded_at timestamptz NOT NULL DEFAULT now(), payload jsonb NOT NULL,
 FOREIGN KEY(company_id,site_id) REFERENCES public.ts_sites(company_id,id)
);
CREATE TABLE public.ts_action_photos (
 id uuid PRIMARY KEY, update_id uuid NOT NULL, company_id uuid NOT NULL REFERENCES public.ts_companies(id),
 action_id uuid NOT NULL REFERENCES public.ts_actions(id), basis_revision integer NOT NULL CHECK(basis_revision>0),
 uploader_id uuid NOT NULL REFERENCES auth.users(id), uploader_label text NOT NULL,
 caption text NOT NULL CHECK(length(trim(caption)) BETWEEN 1 AND 1000),
 object_path text NOT NULL UNIQUE, sha256 text NOT NULL CHECK(sha256 ~ '^[a-f0-9]{64}$'),
 byte_size integer NOT NULL CHECK(byte_size BETWEEN 1 AND 3145728),
 width integer NOT NULL CHECK(width BETWEEN 1 AND 2400),height integer NOT NULL CHECK(height BETWEEN 1 AND 2400),
 state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','ready','removed')),
 reserved_at timestamptz NOT NULL DEFAULT now(),uploaded_at timestamptz,removed_at timestamptz,
 CHECK(state<>'ready' OR uploaded_at IS NOT NULL)
);
CREATE INDEX ts_action_updates_parent ON public.ts_action_updates(action_id,recorded_at,id);
CREATE INDEX ts_action_photos_parent ON public.ts_action_photos(action_id,update_id);
CREATE FUNCTION public.ts_action_evidence_access(target uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT EXISTS(SELECT 1 FROM public.ts_actions a JOIN public.ts_members m ON m.company_id=a.company_id AND m.user_id=auth.uid() AND m.active
 WHERE a.id=target AND (m.role IN ('owner','supervisor') OR a.responsible_id=auth.uid()))
$$;
ALTER TABLE public.ts_action_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ts_action_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY action_update_read ON public.ts_action_updates FOR SELECT TO authenticated USING(public.ts_action_evidence_access(action_id));
CREATE POLICY action_photo_read ON public.ts_action_photos FOR SELECT TO authenticated USING(public.ts_action_evidence_access(action_id) AND (uploader_id=auth.uid() OR EXISTS(SELECT 1 FROM public.ts_action_updates u WHERE u.id=ts_action_photos.update_id AND u.action_id=ts_action_photos.action_id)));
REVOKE ALL ON public.ts_action_updates,public.ts_action_photos FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.ts_action_updates,public.ts_action_photos TO authenticated;
GRANT ALL ON public.ts_action_updates,public.ts_action_photos TO service_role;
CREATE TRIGGER action_update_immutable BEFORE UPDATE OR DELETE ON public.ts_action_updates FOR EACH ROW EXECUTE FUNCTION public.ts_immutable();
CREATE FUNCTION public.ts_action_photo_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 IF TG_OP='DELETE' OR (to_jsonb(NEW)-'state'-'uploaded_at'-'removed_at') IS DISTINCT FROM (to_jsonb(OLD)-'state'-'uploaded_at'-'removed_at') OR OLD.state='removed' OR (OLD.state='ready' AND NEW.state<>'removed') OR EXISTS(SELECT 1 FROM public.ts_action_updates WHERE id=OLD.update_id) THEN RAISE EXCEPTION 'TS_immutable'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER action_photo_immutable BEFORE UPDATE OR DELETE ON public.ts_action_photos FOR EACH ROW EXECUTE FUNCTION public.ts_action_photo_guard();
CREATE FUNCTION public.ts_action_photo(command text,p jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE a public.ts_actions; e public.ts_action_photos; actor uuid:=auth.uid();
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'TS_unauthorized'; END IF;
 IF p IS NULL OR jsonb_typeof(p)<>'object' OR octet_length(p::text)>5000 OR p->>'id' IS NULL OR p->>'updateId' IS NULL THEN RAISE EXCEPTION 'TS_invalid'; END IF;
 SELECT * INTO a FROM public.ts_actions WHERE id=(p->>'actionId')::uuid;
 IF NOT FOUND THEN RAISE EXCEPTION 'TS_not_found'; END IF;
 PERFORM 1 FROM public.ts_companies WHERE id=a.company_id FOR UPDATE;
 SELECT * INTO a FROM public.ts_actions WHERE id=a.id FOR UPDATE;
 IF NOT public.ts_action_evidence_access(a.id) THEN RAISE EXCEPTION 'TS_denied'; END IF;
 SELECT * INTO e FROM public.ts_action_photos WHERE id=(p->>'id')::uuid FOR UPDATE;
 IF e.id IS NOT NULL AND (e.action_id<>a.id OR e.update_id<>(p->>'updateId')::uuid OR (e.uploader_id<>actor AND (command<>'remove' OR public.ts_role(a.company_id) NOT IN ('owner','supervisor')))) THEN RAISE EXCEPTION 'TS_denied'; END IF;
 IF EXISTS(SELECT 1 FROM public.ts_action_updates WHERE id=(p->>'updateId')::uuid) THEN RAISE EXCEPTION 'TS_immutable'; END IF;
 IF command='reserve' THEN
  IF a.state='closed' THEN RAISE EXCEPTION 'TS_immutable'; END IF;
  IF a.revision IS DISTINCT FROM (p->>'revision')::integer THEN RAISE EXCEPTION 'TS_conflict'; END IF;
  IF EXISTS(SELECT 1 FROM public.ts_action_photos WHERE update_id=(p->>'updateId')::uuid AND (action_id<>a.id OR uploader_id<>actor OR basis_revision<>a.revision)) THEN RAISE EXCEPTION 'TS_conflict'; END IF;
  IF e.id IS NOT NULL THEN
   IF e.sha256 IS DISTINCT FROM p->>'sha256' OR e.caption IS DISTINCT FROM trim(p->>'caption') OR e.byte_size IS DISTINCT FROM (p->>'byteSize')::integer OR e.width IS DISTINCT FROM (p->>'width')::integer OR e.height IS DISTINCT FROM (p->>'height')::integer OR e.state='removed' THEN RAISE EXCEPTION 'TS_conflict'; END IF;
   RETURN to_jsonb(e);
  END IF;
  IF (SELECT count(*) FROM public.ts_action_photos WHERE update_id=(p->>'updateId')::uuid AND state<>'removed')>=10 OR (SELECT count(*) FROM public.ts_action_photos WHERE action_id=a.id AND state<>'removed')>=100 THEN RAISE EXCEPTION 'TS_evidence_limit'; END IF;
  INSERT INTO public.ts_action_photos(id,update_id,company_id,action_id,basis_revision,uploader_id,uploader_label,caption,object_path,sha256,byte_size,width,height)
  VALUES((p->>'id')::uuid,(p->>'updateId')::uuid,a.company_id,a.id,a.revision,actor,(SELECT display_name FROM public.ts_members WHERE company_id=a.company_id AND user_id=actor),trim(p->>'caption'),a.company_id::text||'/actions/'||a.id::text||'/'||(p->>'id')::uuid::text||'.jpg',p->>'sha256',(p->>'byteSize')::integer,(p->>'width')::integer,(p->>'height')::integer) RETURNING * INTO e;
 ELSIF command='remove' THEN
  IF e.id IS NULL THEN RAISE EXCEPTION 'TS_not_found'; END IF;
  IF e.state<>'removed' THEN UPDATE public.ts_action_photos SET state='removed',removed_at=now() WHERE id=e.id RETURNING * INTO e; END IF;
 ELSE RAISE EXCEPTION 'TS_invalid'; END IF;
 RETURN to_jsonb(e);
END $$;
CREATE FUNCTION public.ts_complete_action_photo(evidence_id uuid,actor_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE a public.ts_actions; e public.ts_action_photos;
BEGIN
 SELECT * INTO e FROM public.ts_action_photos WHERE id=evidence_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'TS_not_found'; END IF;
 PERFORM 1 FROM public.ts_companies WHERE id=e.company_id FOR UPDATE;
 SELECT * INTO a FROM public.ts_actions WHERE id=e.action_id FOR UPDATE;
 SELECT * INTO e FROM public.ts_action_photos WHERE id=evidence_id FOR UPDATE;
 IF e.uploader_id<>actor_id OR NOT EXISTS(SELECT 1 FROM public.ts_members WHERE company_id=a.company_id AND user_id=actor_id AND active AND (role IN ('owner','supervisor') OR a.responsible_id=actor_id)) THEN RAISE EXCEPTION 'TS_denied'; END IF;
 IF EXISTS(SELECT 1 FROM public.ts_action_updates WHERE id=e.update_id) THEN
  IF e.state='ready' THEN RETURN to_jsonb(e); END IF;
  RAISE EXCEPTION 'TS_immutable';
 END IF;
 IF a.revision<>e.basis_revision THEN RAISE EXCEPTION 'TS_conflict'; END IF;
 IF a.state='closed' OR e.state='removed' THEN RAISE EXCEPTION 'TS_immutable'; END IF;
 IF e.state='ready' THEN RETURN to_jsonb(e); END IF;
 UPDATE public.ts_action_photos SET state='ready',uploaded_at=now() WHERE id=e.id RETURNING * INTO e;
 RETURN to_jsonb(e);
END $$;
CREATE FUNCTION public.ts_action_completion(p jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE a public.ts_actions; u public.ts_action_updates; actor uuid:=auth.uid(); evidence jsonb; ids uuid[]; site uuid; result jsonb;
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'TS_unauthorized'; END IF;
 IF p IS NULL OR jsonb_typeof(p)<>'object' OR octet_length(p::text)>16000 OR p->>'id' IS NULL OR p->>'actionId' IS NULL OR jsonb_typeof(p->'notes') IS DISTINCT FROM 'string' OR length(trim(p->>'notes')) NOT BETWEEN 1 AND 4000 OR p->>'state' IS NULL OR p->>'state' NOT IN ('in_progress','awaiting_verification') OR jsonb_typeof(p->'evidenceIds') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'TS_invalid'; END IF;
 SELECT * INTO a FROM public.ts_actions WHERE id=(p->>'actionId')::uuid;
 IF NOT FOUND THEN RAISE EXCEPTION 'TS_not_found'; END IF;
 PERFORM 1 FROM public.ts_companies WHERE id=a.company_id FOR UPDATE;
 SELECT * INTO a FROM public.ts_actions WHERE id=a.id FOR UPDATE;
 IF NOT public.ts_action_evidence_access(a.id) THEN RAISE EXCEPTION 'TS_denied'; END IF;
 SELECT * INTO u FROM public.ts_action_updates WHERE id=(p->>'id')::uuid;
 IF FOUND THEN
  IF u.action_id<>a.id OR u.actor_id<>actor OR u.payload IS DISTINCT FROM p THEN RAISE EXCEPTION 'TS_conflict'; END IF;
  RETURN jsonb_build_object('update',to_jsonb(u)-'payload','action',to_jsonb(a));
 END IF;
 IF a.state='closed' THEN RAISE EXCEPTION 'TS_immutable'; END IF;
 IF a.revision IS DISTINCT FROM (p->>'revision')::integer THEN RAISE EXCEPTION 'TS_conflict'; END IF;
 IF (SELECT count(*) FROM public.ts_action_updates WHERE action_id=a.id)>=100 THEN RAISE EXCEPTION 'TS_evidence_limit'; END IF;
 SELECT coalesce(array_agg(value::uuid),'{}') INTO ids FROM jsonb_array_elements_text(p->'evidenceIds');
 IF cardinality(ids)>10 OR cardinality(ids)<>(SELECT count(DISTINCT x) FROM unnest(ids) x) THEN RAISE EXCEPTION 'TS_invalid'; END IF;
 IF EXISTS(SELECT 1 FROM public.ts_action_photos WHERE update_id=(p->>'id')::uuid AND (action_id<>a.id OR uploader_id<>actor OR basis_revision<>a.revision)) THEN RAISE EXCEPTION 'TS_conflict'; END IF;
 IF EXISTS(SELECT 1 FROM public.ts_action_photos WHERE update_id=(p->>'id')::uuid AND state='pending') THEN RAISE EXCEPTION 'TS_evidence_pending'; END IF;
 IF cardinality(ids)<>(SELECT count(*) FROM public.ts_action_photos WHERE update_id=(p->>'id')::uuid AND state='ready') OR EXISTS(SELECT 1 FROM unnest(ids) x WHERE NOT EXISTS(SELECT 1 FROM public.ts_action_photos e WHERE e.id=x AND e.update_id=(p->>'id')::uuid AND e.state='ready')) THEN RAISE EXCEPTION 'TS_invalid'; END IF;
 SELECT coalesce(jsonb_agg(to_jsonb(e) ORDER BY e.id),'[]') INTO evidence FROM public.ts_action_photos e WHERE id=ANY(ids);
 SELECT coalesce(c.site_id,l.site_id) INTO site FROM public.ts_actions x LEFT JOIN public.ts_concerns c ON c.id=x.concern_id LEFT JOIN public.ts_site_links l ON l.company_id=x.company_id AND (l.report_id=x.report_id OR l.brief_id=x.brief_id) WHERE x.id=a.id;
 result:=public.ts_command('update_action',jsonb_build_object('id',a.id,'companyId',a.company_id,'revision',a.revision,'requestId',(p->>'id')::uuid,'state',p->>'state','resolution',trim(p->>'notes'),'controls',a.controls,'responsibleId',a.responsible_id,'targetDate',coalesce(a.target_date::text,''),'priority',a.priority));
 INSERT INTO public.ts_action_updates(id,company_id,action_id,site_id,basis_revision,submitted_revision,actor_id,actor_label,notes,state,evidence_snapshot,payload)
 VALUES((p->>'id')::uuid,a.company_id,a.id,site,a.revision,(result->>'revision')::integer,actor,(SELECT display_name FROM public.ts_members WHERE company_id=a.company_id AND user_id=actor),trim(p->>'notes'),p->>'state',evidence,p) RETURNING * INTO u;
 RETURN jsonb_build_object('update',to_jsonb(u)-'payload','action',result);
END $$;
CREATE FUNCTION public.ts_action_photo_cleanup_candidate(evidence_id uuid,actor_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE e public.ts_action_photos; a public.ts_actions;
BEGIN
 SELECT * INTO e FROM public.ts_action_photos WHERE id=evidence_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'TS_not_found'; END IF;
 PERFORM 1 FROM public.ts_companies WHERE id=e.company_id FOR UPDATE;
 SELECT * INTO a FROM public.ts_actions WHERE id=e.action_id FOR UPDATE;
 SELECT * INTO e FROM public.ts_action_photos WHERE id=evidence_id FOR UPDATE;
 IF NOT EXISTS(SELECT 1 FROM public.ts_members WHERE company_id=a.company_id AND user_id=actor_id AND active AND (role IN ('owner','supervisor') OR (a.responsible_id=actor_id AND e.uploader_id=actor_id))) THEN RAISE EXCEPTION 'TS_denied'; END IF;
 IF e.state<>'removed' OR EXISTS(SELECT 1 FROM public.ts_action_updates WHERE id=e.update_id) THEN RAISE EXCEPTION 'TS_immutable'; END IF;
 RETURN jsonb_build_object('id',e.id,'object_path',e.object_path);
END $$;
CREATE FUNCTION public.ts_action_admit(action_id uuid,actor_id uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE a public.ts_actions; keys text[]; limits integer[]:=ARRAY[60,30,20]; i integer;
BEGIN
 SELECT * INTO a FROM public.ts_actions WHERE id=action_id;
 IF a.id IS NULL OR a.state='closed' OR NOT EXISTS(SELECT 1 FROM public.ts_members WHERE company_id=a.company_id AND user_id=actor_id AND active AND (role IN ('owner','supervisor') OR a.responsible_id=actor_id)) OR NOT EXISTS(SELECT 1 FROM auth.users WHERE id=actor_id AND email_confirmed_at IS NOT NULL) THEN RAISE EXCEPTION 'TS_denied'; END IF;
 keys:=ARRAY['upload:global','upload:company:'||right(md5(a.company_id::text),3),'upload:user:'||right(md5(actor_id::text),3)];
 PERFORM pg_advisory_xact_lock(74160916);
 FOR i IN 1..3 LOOP
  INSERT INTO public.ts_resource_limits VALUES(keys[i],now(),0) ON CONFLICT DO NOTHING;
  UPDATE public.ts_resource_limits SET window_start=now(),count=0 WHERE key=keys[i] AND window_start<=now()-interval '10 minutes';
 END LOOP;
 FOR i IN 1..3 LOOP IF (SELECT count FROM public.ts_resource_limits WHERE key=keys[i])>=limits[i] THEN RETURN false; END IF; END LOOP;
 UPDATE public.ts_resource_limits SET count=count+1 WHERE key=ANY(keys); RETURN true;
END $$;
CREATE FUNCTION public.ts_action_pending_photos(action_id uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE a public.ts_actions; result jsonb;
BEGIN
 SELECT * INTO a FROM public.ts_actions WHERE id=action_id;
 IF a.id IS NULL THEN RAISE EXCEPTION 'TS_not_found'; END IF;
 IF NOT public.ts_action_evidence_access(a.id) THEN RAISE EXCEPTION 'TS_denied'; END IF;
 SELECT coalesce(jsonb_agg(to_jsonb(e) ORDER BY e.reserved_at,e.id),'[]') INTO result FROM (SELECT * FROM public.ts_action_photos p WHERE p.action_id=a.id AND p.state<>'removed' AND NOT EXISTS(SELECT 1 FROM public.ts_action_updates u WHERE u.id=p.update_id) AND (p.uploader_id=auth.uid() OR public.ts_role(a.company_id) IN ('owner','supervisor')) ORDER BY p.reserved_at,p.id LIMIT 101) e;
 IF jsonb_array_length(result)>100 THEN RAISE EXCEPTION 'TS_evidence_limit'; END IF;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.ts_action_pending_photos(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ts_action_pending_photos(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.ts_action_evidence_access(uuid),public.ts_action_photo(text,jsonb),public.ts_action_completion(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ts_action_evidence_access(uuid),public.ts_action_photo(text,jsonb),public.ts_action_completion(jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.ts_complete_action_photo(uuid,uuid),public.ts_action_photo_cleanup_candidate(uuid,uuid),public.ts_action_admit(uuid,uuid),public.ts_action_photo_guard() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ts_complete_action_photo(uuid,uuid),public.ts_action_photo_cleanup_candidate(uuid,uuid),public.ts_action_admit(uuid,uuid) TO service_role;
COMMIT;
