import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile,readdir} from 'node:fs/promises'
import {randomUUID} from 'node:crypto'
import {PGlite} from '@electric-sql/pglite'
import {emptyElectricalJob,electricalFields,electricalExport,electricalMissing,electricalRequired} from '../lib/domain/electrical-job.mjs'
import {safeRedirect} from '../lib/domain/validation.ts'
import content from '../lib/domain/electrical-content.json' with {type:'json'}

test('electrical job: atomic retained revisions, strict roles/evidence, unresolved applicability, stale/retry and independent reviews',async()=>{
 const db=new PGlite(),owner=randomUUID(),worker=randomUUID(),outsider=randomUUID(),company=randomUUID(),site=randomUUID()
 try{
 await db.exec(`CREATE ROLE authenticated;CREATE ROLE anon;CREATE ROLE service_role BYPASSRLS;CREATE SCHEMA auth;CREATE SCHEMA storage;CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,email_confirmed_at timestamptz);CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;GRANT USAGE ON SCHEMA public,auth,storage TO authenticated,anon,service_role;CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);CREATE TABLE storage.objects(id uuid PRIMARY KEY,bucket_id text,name text);ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;`)
 for(const [i,u] of [owner,worker,outsider].entries())await db.query('INSERT INTO auth.users VALUES($1,$2,now())',[u,`electrician${i}@example.test`])
 // Fresh disposable DB only. Existing hosted migrations are never replayed.
 for(const f of (await readdir('supabase/migrations')).filter(x=>x.endsWith('.sql')).sort())await db.exec(await readFile('supabase/migrations/'+f,'utf8'))
 const as=async u=>{await db.exec('RESET ROLE;SET ROLE authenticated');await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[u])},rpc=async(fn,command,p)=>(await db.query(`SELECT public.${fn}($1,$2::jsonb) v`,[command,JSON.stringify({companyId:company,requestId:randomUUID(),...p})])).rows[0].v
 const cmd=(c,p={})=>rpc('ts_electrical_command',c,{siteId:site,...p})
 await as(owner);await rpc('ts_command','create_company',{id:company,name:'SYNTHETIC electrical company'});await rpc('ts_site_command','create',{id:site,document:{name:'SYNTHETIC residence',address:'Test only',instructions:''}})
 await rpc('ts_command','invite',{email:'electrician1@example.test',role:'worker',token:'3'.repeat(64)});await as(worker);await rpc('ts_command','accept_invitation',{token:'3'.repeat(64)})
 const document={...emptyElectricalJob(),scope:'Synthetic repair',setting:'Ontario residential setting requiring applicability review',notification:'disputed — review needed',notificationBasis:'Unresolved synthetic applicability'}
 await assert.rejects(cmd('save',{revision:0,document}),/TS_denied/)
 await as(owner);const p={revision:0,document,requestId:randomUUID()},j=await cmd('save',p);assert.deepEqual(await cmd('save',p),j)
 assert.equal(j.revision,1);assert.equal(j.internal_review,null);assert.ok(electricalMissing(j.document).length)
 await assert.rejects(cmd('save',{...p,document:{...document,scope:'different retry'}}),/TS_conflict/)
 await assert.rejects(cmd('save',{revision:0,document}),/TS_conflict/)
 await assert.rejects(cmd('save',{revision:1,document:{...document,certificatePhoto:randomUUID()}}),/TS_denied/)
 await assert.rejects(cmd('save',{revision:1,document:{...document,inspection:'approved by TradeSafe'}}),/TS_invalid/)
 await assert.rejects(cmd('save',{revision:1,document:{...document,notificationBasis:''}}),/TS_invalid/)
 await assert.rejects(cmd('save',{revision:1,document:{...document,scope:'x'.repeat(2001)}}),/TS_invalid/)
 let next=await cmd('credential_check',{revision:1,source:'SYNTHETIC check — not a real registry',note:'Synthetic mismatch'});assert.equal(next.credential_check.reportedBy,owner)
 next=await cmd('review',{revision:2,note:'SYNTHETIC unresolved documentation reviewed'});assert.equal(next.internal_review.basisRevision,2);assert.equal(next.document.inspection,'not recorded');assert.equal(next.document.documentation,'in progress')
 const before=(await db.query('SELECT * FROM ts_electrical_job_versions WHERE revision=3')).rows[0],html=electricalExport(before);assert.match(html,/SYNTHETIC residence/);assert.match(html,/unresolved documentation reviewed/);assert.match(html,/on-residential-electrical-2026-10-07-v1/)
 next=await cmd('save',{revision:3,document:{...document,lec:'SYNTHETIC changed reference'}});assert.equal(next.internal_review,null);assert.equal(next.credential_check,null)
 assert.equal(electricalExport((await db.query('SELECT * FROM ts_electrical_job_versions WHERE revision=3')).rows[0]),html)
 await assert.rejects(db.query('UPDATE ts_electrical_jobs SET revision=99'),/permission denied/)
 await assert.rejects(db.query('DELETE FROM ts_electrical_job_versions'),/permission denied/)
 await assert.rejects(db.query('SELECT ts_review_brief_content($1::jsonb)',[JSON.stringify({version:content.version,state:'reviewed',requestId:randomUUID(),decisionRef:'Synthetic',notes:'No qualified appointment'})]),/TS_denied/)
 await as(worker);assert.equal((await db.query('SELECT * FROM ts_electrical_jobs')).rows.length,1)
 await as(outsider);assert.equal((await db.query('SELECT * FROM ts_electrical_jobs')).rows.length,0);assert.equal((await db.query('SELECT * FROM ts_electrical_job_versions')).rows.length,0);await assert.rejects(cmd('save',{revision:4,document}),/TS_denied/)
 await as(owner);await rpc('ts_command','member',{userId:worker,role:'remove'});await as(worker);assert.equal((await db.query('SELECT * FROM ts_electrical_jobs')).rows.length,0)
 await as(owner);await rpc('ts_site_command','archive',{id:site,revision:1});await assert.rejects(cmd('save',{revision:4,document}),/TS_site_archived/)
 const migration=await readFile('supabase/migrations/20261007000100_electrical_jobs.sql','utf8');assert.deepEqual(JSON.parse(migration.match(/\$fields\$(.*?)\$fields\$/s)[1]),electricalFields)
 const registered=(await db.query('SELECT payload FROM ts_brief_content WHERE version=$1',[content.version])).rows[0].payload;assert.deepEqual(registered,content)
 }finally{await db.close()}
})
test('electrical return destinations remain validated and source mappings remain draft',()=>{
 const id=randomUUID();assert.equal(safeRedirect('/sites/'+id+'/electrical'),'/sites/'+id+'/electrical');assert.equal(safeRedirect('/sites/not-a-site/electrical'),'/dashboard')
 assert.equal(content.reviewStatus,'draft');for(const p of content.prompts){assert.equal(p.reviewStatus,'draft');for(const id of p.sourceIds)assert.ok(content.sources.some(s=>s.id===id))}
})

test('electrical notification fields require the same explanation as the server without resolving unknowns',()=>{
 for(const notification of electricalFields.find(f=>f.key==='notification').options){
  assert.equal(electricalRequired('notificationRef',{notification}),notification==='notification reference recorded')
  assert.equal(electricalRequired('notificationBasis',{notification}),['exemption basis proposed — review needed','disputed — review needed'].includes(notification))
  assert.equal(electricalRequired('scope',{notification}),false)
 }
})
