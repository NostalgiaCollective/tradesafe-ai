import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {randomUUID} from 'node:crypto'
import {PGlite} from '@electric-sql/pglite'
test('handover SQL enforces RLS, midnight/DST boundaries and complete-or-fail limits',async()=>{
 const db=new PGlite(),[owner,worker,outsider]=Array.from({length:3},randomUUID),company=randomUUID(),site=randomUUID()
 try{
  await db.exec(`CREATE ROLE authenticated;CREATE ROLE anon;CREATE ROLE service_role BYPASSRLS;CREATE SCHEMA auth;CREATE SCHEMA storage;CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,email_confirmed_at timestamptz);CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;GRANT USAGE ON SCHEMA public,auth,storage TO authenticated,anon,service_role;CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);CREATE TABLE storage.objects(id uuid PRIMARY KEY,bucket_id text,name text);ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;`)
  for(const [i,u] of [owner,worker,outsider].entries())await db.query('INSERT INTO auth.users VALUES($1,$2,now())',[u,`concern${i}@example.test`])
  for(const f of ['20260911000100_staging_baseline','20260911000200_company_workflow','20260911000300_template_v1','20260913000100_private_evidence_exports','20260916000100_resource_admission','20260921000100_daily_briefs','20260921000200_brief_action_assignment','20260921000300_brief_content','20260922000100_sites','20260923000100_crew_coordination','20260923000200_site_concerns','20260929000100_site_handover'])await db.exec(await readFile(new URL('../supabase/migrations/'+f+'.sql',import.meta.url),'utf8'))
  const as=async u=>{await db.exec('RESET ROLE;SET ROLE authenticated');await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[u])}
  const rpc=async(fn,command,p)=>(await db.query(`SELECT public.${fn}($1,$2::jsonb) v`,[command,JSON.stringify({companyId:company,requestId:randomUUID(),...p})])).rows[0].v
  await as(owner);await rpc('ts_command','create_company',{id:company,name:'SYNTHETIC handover boundaries'});await rpc('ts_site_command','create',{id:site,document:{name:'SYNTHETIC midnight',address:'Synthetic',instructions:''}})
  await rpc('ts_command','invite',{email:'concern1@example.test',role:'worker',token:'1'.repeat(64)});await as(worker);await rpc('ts_command','accept_invitation',{token:'1'.repeat(64)})
  const summary=async(day='2026-09-29',zone='America/Toronto')=>(await db.query('SELECT public.ts_site_handover($1,$2,$3) v',[site,day,zone])).rows[0].v
  await db.exec('RESET ROLE')
  for(const [i,t] of ['2026-09-29T03:59:59.999Z','2026-09-29T04:00:00Z','2026-09-30T03:59:59.999Z','2026-09-30T04:00:00Z'].entries())await db.query(`INSERT INTO public.ts_concerns(id,company_id,site_id,author_id,site_snapshot,document,lifecycle,submitted_at) VALUES($1,$2,$3,$4,'{}',$5,'submitted',$6)`,[randomUUID(),company,site,owner,JSON.stringify({observation:'boundary-'+i,location:'Bay',immediate:'',observedAt:''}),t])
  await as(owner);const s=await summary();assert.deepEqual(s.concerns.map(c=>c.document.observation),['boundary-1','boundary-2']);assert.equal(s.start,'2026-09-29T04:00:00+00:00');assert.equal(s.end,'2026-09-30T04:00:00+00:00')
  for(const [day,hours] of [['2026-03-08',23],['2026-11-01',25]]){const x=await summary(day);assert.equal(Date.parse(x.end)-Date.parse(x.start),hours*3600000)}
  assert.equal((await summary('2026-09-29','UTC')).concerns.length,2)
  await as(worker);assert.equal((await summary()).concerns.length,0);await as(outsider);await assert.rejects(summary(),/TS_not_found/)
  await as(owner);await rpc('ts_command','member',{userId:worker,role:'remove'});await as(worker);await assert.rejects(summary(),/TS_not_found/)
  await db.exec('RESET ROLE;SET ROLE anon');await assert.rejects(summary(),/permission denied/)
  await db.exec('RESET ROLE');await db.query(`INSERT INTO public.ts_concerns(id,company_id,site_id,author_id,site_snapshot,document,lifecycle,submitted_at) SELECT gen_random_uuid(),$1,$2,$3,'{}','{"observation":"SYNTHETIC limit","location":"Bay","immediate":"","observedAt":""}','submitted','2026-09-29T12:00:00Z' FROM generate_series(1,199)`,[company,site,owner])
  await as(owner);await assert.rejects(summary(),/TS_summary_limit/);await assert.rejects(summary('2026-09-29','bad'),/TS_invalid/)
  await db.exec('RESET ROLE');const flags=(await db.query("SELECT prosecdef,provolatile FROM pg_proc WHERE proname='ts_site_handover'")).rows[0];assert.equal(flags.prosecdef,false);assert.equal(flags.provolatile,'s')
 }finally{await db.close()}
})
