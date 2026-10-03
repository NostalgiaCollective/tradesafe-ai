import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {randomUUID} from 'node:crypto'
import {PGlite} from '@electric-sql/pglite'
test('pilot feedback: privacy, idempotency, owner status history, revocation and practice separation',async()=>{
 const db=new PGlite(),[owner,worker,outside]=Array.from({length:3},randomUUID),company=randomUUID(),site=randomUUID()
 try{
 await db.exec(`CREATE ROLE authenticated;CREATE ROLE anon;CREATE ROLE service_role BYPASSRLS;CREATE SCHEMA auth;CREATE SCHEMA storage;CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,email_confirmed_at timestamptz);CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;GRANT USAGE ON SCHEMA public,auth,storage TO authenticated,anon,service_role;CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);CREATE TABLE storage.objects(id uuid PRIMARY KEY,bucket_id text,name text);ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;`)
 for(const [i,u] of [owner,worker,outside].entries())await db.query('INSERT INTO auth.users VALUES($1,$2,now())',[u,`operations${i}@example.test`])
 for(const f of ['20260911000100_staging_baseline','20260911000200_company_workflow','20260911000300_template_v1','20260913000100_private_evidence_exports','20260916000100_resource_admission','20260921000100_daily_briefs','20260921000200_brief_action_assignment','20260921000300_brief_content','20260922000100_sites','20260923000100_crew_coordination','20260923000200_site_concerns','20260929000100_site_handover','20261002000100_action_planning','20261002000200_site_history','20261002000300_site_evidence_package','20261002000400_action_priority_clear','20261002000500_first_workday'])await db.exec(await readFile(new URL('../supabase/migrations/'+f+'.sql',import.meta.url),'utf8'))
 const as=async u=>{await db.exec('RESET ROLE;SET ROLE authenticated');await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[u])},rpc=async(fn,command,p)=>(await db.query(`SELECT public.${fn}($1,$2::jsonb) v`,[command,JSON.stringify({companyId:company,requestId:randomUUID(),...p})])).rows[0].v

 await as(owner);await rpc('ts_command','create_company',{id:company,name:'Synthetic pilot'});
 await rpc('ts_pilot_command','practice',{});
 assert.equal((await db.query('SELECT practice FROM ts_companies WHERE id=$1',[company])).rows[0].practice,true);
 await rpc('ts_site_command','create',{id:site,document:{name:'Test bay',address:'Synthetic',instructions:''}});
 assert.match((await db.query('SELECT document FROM ts_sites WHERE id=$1',[site])).rows[0].document.name,/^PRACTICE/);
 await rpc('ts_command','invite',{email:'operations1@example.test',role:'worker',token:'2'.repeat(64)});await as(worker);await rpc('ts_command','accept_invitation',{token:'2'.repeat(64)});
 const p={id:randomUUID(),requestId:randomUUID(),kind:'problem',task:'Find brief',description:'Synthetic missing guide',expectation:'Guide',appVersion:'test',route:'/help'};
 const f=await rpc('ts_pilot_command','submit',p);assert.equal((await rpc('ts_pilot_command','submit',p)).id,f.id);
 await assert.rejects(rpc('ts_pilot_command','submit',{...p,description:'Changed'}),/TS_conflict/);
 await assert.rejects(rpc('ts_pilot_command','submit',{...p,id:randomUUID(),requestId:randomUUID(),task:''}),/check constraint/);
 await assert.rejects(rpc('ts_pilot_command','status',{id:f.id,revision:1,status:'resolved'}),/TS_denied/);
 await rpc('ts_pilot_command','guidance',{dismissed:true});assert.equal((await db.query('SELECT * FROM ts_pilot_preferences')).rows[0].dismissed,true);
 await as(outside);assert.equal((await db.query('SELECT * FROM ts_pilot_feedback')).rows.length,0);await assert.rejects(rpc('ts_pilot_command','submit',{...p,id:randomUUID(),requestId:randomUUID()}),/TS_denied/);
 await as(owner);const change={id:f.id,revision:1,status:'investigating',requestId:randomUUID()};assert.equal((await rpc('ts_pilot_command','status',change)).revision,2);await rpc('ts_pilot_command','status',change);
 assert.equal((await db.query('SELECT * FROM ts_pilot_feedback_history')).rows.length,1);
 await assert.rejects(rpc('ts_pilot_command','status',{...change,requestId:randomUUID(),status:'resolved'}),/TS_conflict/);
 await rpc('ts_command','member',{userId:worker,role:'remove'});await as(worker);assert.equal((await db.query('SELECT * FROM ts_pilot_feedback')).rows.length,0);assert.equal((await db.query('SELECT * FROM ts_pilot_preferences')).rows.length,0);
 await assert.rejects(rpc('ts_pilot_command','submit',p),/TS_denied/);
 }finally{await db.close()}
})
