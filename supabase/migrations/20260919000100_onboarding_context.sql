-- Additive, read-only onboarding context. No existing grants or commands change.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
CREATE FUNCTION public.ts_invitation_context(token text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE actor uuid:=auth.uid(); mail text; inv public.ts_invitations; result jsonb;
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'TS_unauthorized'; END IF;
 SELECT lower(email) INTO mail FROM auth.users WHERE id=actor AND email_confirmed_at IS NOT NULL;
 IF token IS NULL THEN
  SELECT coalesce(jsonb_agg(x),'[]'::jsonb) INTO result FROM (
   SELECT i.id,c.name AS company_name,i.role,i.expires_at FROM public.ts_invitations i
   JOIN public.ts_companies c ON c.id=i.company_id
   WHERE i.email=mail AND i.accepted_by IS NULL AND NOT i.revoked AND i.expires_at>now()
   ORDER BY i.created_at DESC LIMIT 50
  ) x;
  RETURN result;
 END IF;
 IF token !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'TS_invalid'; END IF;
 SELECT * INTO inv FROM public.ts_invitations WHERE token_hash=encode(sha256(convert_to(token,'UTF8')),'hex');
 IF NOT FOUND THEN RETURN jsonb_build_object('status','unavailable'); END IF;
 -- Possession of the token never reveals the invited address or another company's details.
 IF mail IS NULL OR mail<>inv.email THEN RETURN jsonb_build_object('status','wrong_account'); END IF;
 IF inv.accepted_by=actor THEN
  IF public.ts_role(inv.company_id) IS NULL THEN RETURN jsonb_build_object('status','access_removed'); END IF;
  RETURN jsonb_build_object('status','accepted','company_id',inv.company_id);
 END IF;
 IF inv.revoked THEN RETURN jsonb_build_object('status','revoked'); END IF;
 IF inv.expires_at<=now() THEN RETURN jsonb_build_object('status','expired'); END IF;
 IF inv.accepted_by IS NOT NULL THEN RETURN jsonb_build_object('status','unavailable'); END IF;
 RETURN jsonb_build_object('status','pending','company_name',(SELECT name FROM public.ts_companies WHERE id=inv.company_id),'role',inv.role,'expires_at',inv.expires_at);
END $$;
REVOKE ALL ON FUNCTION public.ts_invitation_context(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ts_invitation_context(text) TO authenticated;
COMMIT;
