import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

const migration = await readFile(new URL('../supabase/migrations/20260911000100_staging_baseline.sql', import.meta.url), 'utf8')
const preflight = await readFile(new URL('../supabase/preflight.sql', import.meta.url), 'utf8')
const owner = '11111111-1111-4111-8111-111111111111'
const other = '22222222-2222-4222-8222-222222222222'
async function database() {
  const db = new PGlite()
  await db.exec(`CREATE ROLE authenticated; CREATE ROLE anon; CREATE SCHEMA auth;
    CREATE TABLE auth.users (id uuid PRIMARY KEY);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    GRANT USAGE ON SCHEMA public, auth TO authenticated, anon;
    INSERT INTO auth.users VALUES ('${owner}'), ('${other}');`)
  return db
}
test('all migrations contain no destructive statements', async () => {
  const directory = new URL('../supabase/migrations/', import.meta.url)
  for (const file of (await readdir(directory)).filter(name => name.endsWith('.sql'))) {
    let executable = (await readFile(new URL(file, directory), 'utf8')).replace(/--[^\n]*/g, '')
    if(file==='20260921000100_daily_briefs.sql'){
      // This single constraint expansion allows a second origin, never removal of data.
      // The SQL integration suite verifies exactly one origin, company isolation and immutable versions.
      assert.match(executable,/ADD CONSTRAINT ts_action_origin CHECK/)
      executable=executable.replace('ALTER TABLE public.ts_actions ALTER COLUMN report_id DROP NOT NULL;','')
    }
    if(file==='20260923000200_site_concerns.sql'){
      // Transactional replacement adds a third exclusive origin. No tables or data are removed.
      assert.match(executable,/ADD CONSTRAINT ts_action_origin CHECK/)
      assert.match(executable,/report_id IS NULL AND brief_id IS NULL AND brief_version IS NULL AND concern_id IS NOT NULL/)
      executable=executable.replace('ALTER TABLE public.ts_actions DROP CONSTRAINT ts_action_origin;','')
    }
    assert.doesNotMatch(executable, /\b(DROP|TRUNCATE|CASCADE)\b|\bDELETE\s+FROM\b/i, file)
  }
})
test('fresh migration runs twice without changing records or existing policies', async () => {
  const db = await database()
  try {
    await db.exec(preflight)
    await db.exec(migration)
    await db.exec(preflight)
    await db.exec(`INSERT INTO public.contractor_profiles (user_id,business_name) VALUES ('${owner}', 'Isolated test business');`)
    const before = await db.query('SELECT * FROM public.contractor_profiles')
    const policies = await db.query('SELECT * FROM pg_policies ORDER BY tablename, policyname')
    await db.exec(migration)
    assert.deepEqual(await db.query('SELECT * FROM public.contractor_profiles'), before)
    assert.deepEqual(await db.query('SELECT * FROM pg_policies ORDER BY tablename, policyname'), policies)
    assert.equal((await db.query("SELECT count(*)::int AS n FROM pg_tables WHERE schemaname='public' AND rowsecurity")).rows[0].n, 5)
  } finally { await db.close() }
})
test('fresh ownership policies reject anonymous and cross-user access', async () => {
  const db = await database()
  try {
    await db.exec(migration)
    await db.exec(`SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','${owner}',false);
      INSERT INTO public.reports (user_id,trade,job_address,homeowner_name) VALUES ('${owner}','electrical','Isolated test site','Fixture');`)
    assert.equal((await db.query('SELECT * FROM public.reports')).rows.length, 1)
    await assert.rejects(db.exec(`UPDATE public.reports SET user_id='${other}';`), /row-level security/)
    await db.exec(`SELECT set_config('request.jwt.claim.sub','${other}',false);`)
    assert.equal((await db.query('SELECT * FROM public.reports')).rows.length, 0)
    assert.equal((await db.query("UPDATE public.reports SET job_address='changed' RETURNING id")).rows.length, 0)
    assert.equal((await db.query('DELETE FROM public.reports RETURNING id')).rows.length, 0)
    await assert.rejects(db.exec(`INSERT INTO public.reports (user_id,trade,job_address,homeowner_name) VALUES ('${owner}','electrical','Wrong owner','Fixture');`), /row-level security/)
    await db.exec("RESET ROLE; SET ROLE anon; SELECT set_config('request.jwt.claim.sub','',false);")
    await assert.rejects(db.query('SELECT * FROM public.reports'), /permission denied/)
  } finally { await db.close() }
})
test('existing drifted tables are not silently altered or assigned broader policies', async () => {
  const db = await database()
  try {
    await db.exec('CREATE TABLE public.profiles (id uuid PRIMARY KEY, custom_field text);')
    await db.exec(migration)
    const cols = await db.query("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' ORDER BY ordinal_position")
    assert.deepEqual(cols.rows.map(r => r.column_name), ['id', 'custom_field'])
    assert.equal((await db.query("SELECT * FROM pg_policies WHERE tablename='profiles'")).rows.length, 0)
  } finally { await db.close() }
})
