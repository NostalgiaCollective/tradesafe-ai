-- Additive recovery controls. No existing Auth/report/evidence records are modified.
BEGIN;
CREATE TABLE public.ts_recovery_limits (
  key text PRIMARY KEY, window_start timestamptz NOT NULL, count integer NOT NULL,
  last_at timestamptz NOT NULL
);
CREATE TABLE public.ts_recovery_grants (
  id text PRIMARY KEY CHECK (id ~ '^[a-f0-9]{64}$'),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  encrypted_session text NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '15 minutes'),
  state text NOT NULL DEFAULT 'verified' CHECK (state IN ('verified','updating','changed','complete')),
  password_digest text, attempt uuid, lease_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz
);
ALTER TABLE public.ts_recovery_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ts_recovery_grants ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ts_recovery_limits, public.ts_recovery_grants FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.ts_recovery_grants TO service_role;

-- Shared across server instances. No IP forwarding header is trusted.
-- At most 20 request dispatches/hour globally, 3/address/hour and 60s cooldown.
-- Verification attempts have a separate 60/hour global budget, 6/browser/hour.
CREATE FUNCTION public.ts_recovery_limit(kind text, subject text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE global_row public.ts_recovery_limits; subject_row public.ts_recovery_limits;
  global_key text; subject_key text; max_global integer; max_subject integer;
BEGIN
  IF kind NOT IN ('request','verify') OR subject !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'invalid_recovery_request'; END IF;
  -- Fixed 4096 pseudonymous slots per kind bound storage without deleting records.
  -- A rare hash-slot collision conservatively throttles both subjects.
  global_key := 'global:' || kind; subject_key := kind || ':' || right(subject,3);
  max_global := CASE WHEN kind='request' THEN 20 ELSE 60 END;
  max_subject := CASE WHEN kind='request' THEN 3 ELSE 6 END;
  PERFORM pg_catalog.pg_advisory_xact_lock(74140914);
  INSERT INTO public.ts_recovery_limits VALUES(global_key,now(),0,'epoch'),(subject_key,now(),0,'epoch') ON CONFLICT DO NOTHING;
  UPDATE public.ts_recovery_limits SET window_start=now(),count=0,last_at='epoch'
    WHERE key IN(global_key,subject_key) AND window_start <= now()-interval '1 hour';
  SELECT * INTO global_row FROM public.ts_recovery_limits WHERE key=global_key;
  SELECT * INTO subject_row FROM public.ts_recovery_limits WHERE key=subject_key;
  IF global_row.count>=max_global OR subject_row.count>=max_subject OR
    (kind='request' AND subject_row.last_at>now()-interval '60 seconds') THEN RETURN false; END IF;
  UPDATE public.ts_recovery_limits SET count=count+1,last_at=now() WHERE key IN(global_key,subject_key);
  RETURN true;
END $$;

CREATE FUNCTION public.ts_recovery_grant(command text, p jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE g public.ts_recovery_grants; resumed boolean := false;
BEGIN
  IF command='create' THEN
    INSERT INTO public.ts_recovery_grants(id,user_id,encrypted_session)
      VALUES(p->>'id',(p->>'userId')::uuid,p->>'session');
  END IF;
  SELECT * INTO g FROM public.ts_recovery_grants WHERE id=p->>'id' FOR UPDATE;
  IF NOT FOUND OR g.expires_at<=now() THEN RAISE EXCEPTION 'recovery_expired'; END IF;
  IF command='begin' THEN
    IF g.state='complete' THEN RETURN jsonb_build_object('state','complete'); END IF;
    IF p->>'digest' !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'invalid_recovery_request'; END IF;
    IF g.password_digest IS NOT NULL AND g.password_digest<>p->>'digest' THEN RAISE EXCEPTION 'recovery_conflict'; END IF;
    IF g.lease_until>now() THEN RAISE EXCEPTION 'recovery_busy'; END IF;
    resumed := g.state IN ('updating','changed');
    UPDATE public.ts_recovery_grants SET state=CASE WHEN state='changed' THEN state ELSE 'updating' END,
      password_digest=p->>'digest',attempt=(p->>'attempt')::uuid,lease_until=now()+interval '90 seconds'
      WHERE id=g.id RETURNING * INTO g;
  ELSIF command IN ('changed','complete','reject') THEN
    IF g.attempt IS DISTINCT FROM (p->>'attempt')::uuid OR g.state NOT IN ('updating','changed') THEN RAISE EXCEPTION 'recovery_conflict'; END IF;
    IF command='reject' AND g.state<>'updating' THEN RAISE EXCEPTION 'recovery_conflict'; END IF;
    IF command='complete' AND g.state<>'changed' THEN RAISE EXCEPTION 'recovery_conflict'; END IF;
    UPDATE public.ts_recovery_grants SET
      state=CASE WHEN command='reject' THEN 'verified' ELSE command END,
      password_digest=CASE WHEN command='reject' THEN NULL ELSE password_digest END,
      lease_until=CASE WHEN command='changed' THEN lease_until ELSE NULL END,
      encrypted_session=CASE WHEN command='complete' THEN '' ELSE encrypted_session END,
      completed_at=CASE WHEN command='complete' THEN now() ELSE completed_at END
      WHERE id=g.id RETURNING * INTO g;
  ELSIF command NOT IN ('create','get') THEN RAISE EXCEPTION 'invalid_recovery_request'; END IF;
  RETURN to_jsonb(g) || jsonb_build_object('resumed',resumed);
END $$;
REVOKE ALL ON FUNCTION public.ts_recovery_limit(text,text), public.ts_recovery_grant(text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ts_recovery_limit(text,text), public.ts_recovery_grant(text,jsonb) TO service_role;
COMMIT;
