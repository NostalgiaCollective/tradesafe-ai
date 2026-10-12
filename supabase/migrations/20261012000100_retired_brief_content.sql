-- Retired prompt versions remain available for history and draft recovery.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
CREATE FUNCTION public.ts_guard_retired_brief_content() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE version_id text; state_name text;
BEGIN
 IF TG_TABLE_NAME='ts_brief_versions' THEN version_id:=NEW.snapshot->'document'->>'contentVersion';
 ELSE
  version_id:=NEW.document->>'contentVersion';
  -- Saving an already pinned draft or revising history must preserve recoverable text.
  IF TG_OP='UPDATE' AND NEW.lifecycle='draft' AND version_id IS NOT DISTINCT FROM OLD.document->>'contentVersion' THEN RETURN NEW; END IF;
 END IF;
 IF version_id IS NULL THEN RETURN NEW; END IF;
 -- Serialize with the existing review command, which locks this same immutable row.
 PERFORM 1 FROM public.ts_brief_content WHERE version=version_id FOR SHARE;
 SELECT state INTO state_name FROM public.ts_brief_content_catalog WHERE version=version_id;
 IF state_name='superseded' THEN RAISE EXCEPTION 'TS_content_retired'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.ts_guard_retired_brief_content() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER brief_retired_content BEFORE INSERT OR UPDATE ON public.ts_briefs FOR EACH ROW EXECUTE FUNCTION public.ts_guard_retired_brief_content();
CREATE TRIGGER brief_version_retired_content BEFORE INSERT ON public.ts_brief_versions FOR EACH ROW EXECUTE FUNCTION public.ts_guard_retired_brief_content();
COMMIT;
