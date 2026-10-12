import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile,readdir} from 'node:fs/promises'
import {randomUUID} from 'node:crypto'
import {PGlite} from '@electric-sql/pglite'
import {emptyElectricalJob} from '../lib/domain/electrical-job.mjs'
const migration='20261012000500_electrical_receipt.sql'
for(const upgrade of [false,true])test(`electrical receipt ${upgrade?'upgrade':'fresh'} returns caller-only committed revision without replay or broader access`,async()=>{
 const db=new PGlite(),[owner,supervisor,worker,outsider]=Array.from({length:4},randomUUID),company=randomUUID(),site=randomUUID()
 try{
 await db.exec(`CREATE ROLE authenticated;CREATE ROLE anon;CREATE ROLE service_role BYPASSRLS;CREATE SCHEMA auth;CREATE SCHEMA storage;CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,email_confirmed_at timestamptz);CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;GRANT USAGE ON SCHEMA public,auth,storage TO authenticated,anon,service_role;CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);CREATE TABLE storage.objects(id uuid PRIMARY KEY,bucket_id text,name text);ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;`)
 for(const [i,id] of [owner,supervisor,worker,outsider].entries())await db.query('INSERT INTO auth.users VALUES($1,$2,now())',[id,`receipt${i}@example.test`])
 for(const file of (await readdir('supabase/migrations')).filter(x=>x.endsWith('.sql')&&x<=migration&&(!upgrade||x!==migration)).sort())await db.exec(await readFile('supabase/migrations/'+file,'utf8'))
 const as=async actor=>{await db.exec('RESET ROLE;SET ROLE authenticated');await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[actor||''])}
 const rpc=async(fn,command,p)=>(await db.query(`SELECT public.${fn}($1,$2::jsonb) v`,[command,JSON.stringify({companyId:company,requestId:randomUUID(),...p})])).rows[0].v
 const receipt=async(id,target=site)=>(await db.query('SELECT public.ts_electrical_receipt($1,$2) v',[target,id])).rows[0].v
 await as(owner);await rpc('ts_command','create_company',{id:company,name:'SYNTHETIC receipt company'})
 for(const [i,actor,role] of [[1,supervisor,'supervisor'],[2,worker,'worker']]){await as(owner);await rpc('ts_command','invite',{email:`receipt${i}@example.test`,role,token:String(i).repeat(64)});await as(actor);await rpc('ts_command','accept_invitation',{token:String(i).repeat(64)})}
 await as(owner);const siteRequest=randomUUID();await rpc('ts_site_command','create',{id:site,requestId:siteRequest,document:{name:'SYNTHETIC electrical home',address:'Fictional',instructions:''}})
 const saveId=randomUUID();let job=await rpc('ts_electrical_command','save',{siteId:site,revision:0,requestId:saveId,document:{...emptyElectricalJob(),scope:'SYNTHETIC receipt job'}})
 const before=(await db.query('SELECT * FROM public.ts_electrical_job_versions WHERE site_id=$1 ORDER BY revision',[site])).rows
 if(upgrade){await db.exec('RESET ROLE');await db.exec(await readFile('supabase/migrations/'+migration,'utf8'));await as(owner);assert.deepEqual((await db.query('SELECT * FROM public.ts_electrical_job_versions WHERE site_id=$1 ORDER BY revision',[site])).rows,before)}
 assert.deepEqual(await receipt(saveId),{requestId:saveId,revision:1});assert.equal(await receipt(randomUUID()),null);assert.equal(await receipt(siteRequest),null,'non-electrical command receipt is not exposed')
 await assert.rejects(db.query('SELECT * FROM public.ts_site_requests'),/permission denied/)
 await as(supervisor);assert.equal(await receipt(saveId),null);const reviewId=randomUUID();job=await rpc('ts_electrical_command','review',{siteId:site,revision:job.revision,requestId:reviewId,note:'SYNTHETIC recorded review only'})
 assert.deepEqual(await receipt(reviewId),{requestId:reviewId,revision:2});assert.deepEqual(await receipt(reviewId),{requestId:reviewId,revision:2})
 const checkId=randomUUID();await rpc('ts_electrical_command','credential_check',{siteId:site,revision:job.revision,requestId:checkId,note:'SYNTHETIC check, not live verification',source:'SYNTHETIC reference'})
 assert.deepEqual(await receipt(reviewId),{requestId:reviewId,revision:2});assert.deepEqual(await receipt(checkId),{requestId:checkId,revision:3});assert.equal((await db.query('SELECT count(*) n FROM public.ts_electrical_job_versions WHERE site_id=$1',[site])).rows[0].n,3)
 await as(owner);assert.equal(await receipt(reviewId),null);assert.deepEqual(await receipt(saveId),{requestId:saveId,revision:1})
 const otherSite=randomUUID();await rpc('ts_site_command','create',{id:otherSite,document:{name:'Other synthetic site',address:'Fictional',instructions:''}});assert.equal(await receipt(saveId,otherSite),null)
 await as(worker);await assert.rejects(receipt(saveId),/TS_denied/);await as(outsider);await assert.rejects(receipt(saveId),/TS_denied/);await assert.rejects(receipt(saveId,randomUUID()),/TS_denied/)
 await as(owner);await rpc('ts_command','member',{userId:supervisor,role:'remove'});await as(supervisor);await assert.rejects(receipt(reviewId),/TS_denied/)
 await as(null);await assert.rejects(receipt(saveId),/TS_unauthorized/)
 }finally{await db.close()}
})
