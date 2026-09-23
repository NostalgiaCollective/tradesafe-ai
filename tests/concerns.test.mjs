import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {randomUUID} from 'node:crypto'
import {PGlite} from '@electric-sql/pglite'
import {safeRedirect} from '../lib/domain/validation.ts'
test('site concerns retain originals and scope drafts, photos, action history and retries',async()=>{
 const db=new PGlite(),[owner,worker,otherWorker,outsider]=Array.from({length:4},randomUUID),company=randomUUID(),id=randomUUID()
 try{
  await db.exec(`CREATE ROLE authenticated;CREATE ROLE anon;CREATE ROLE service_role BYPASSRLS;CREATE SCHEMA auth;CREATE SCHEMA storage;CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,email_confirmed_at timestamptz);CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;GRANT USAGE ON SCHEMA public,auth,storage TO authenticated,anon,service_role;CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);CREATE TABLE storage.objects(id uuid PRIMARY KEY,bucket_id text,name text);ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;`)
  for(const [i,u] of [owner,worker,otherWorker,outsider].entries())await db.query('INSERT INTO auth.users VALUES($1,$2,now())',[u,`concern${i}@example.test`])
  for(const f of ['20260911000100_staging_baseline','20260911000200_company_workflow','20260911000300_template_v1','20260913000100_private_evidence_exports','20260916000100_resource_admission','20260921000100_daily_briefs','20260921000200_brief_action_assignment','20260921000300_brief_content','20260922000100_sites','20260923000100_crew_coordination','20260923000200_site_concerns'])await db.exec(await readFile(new URL('../supabase/migrations/'+f+'.sql',import.meta.url),'utf8'))
  const as=async(u,role='authenticated')=>{await db.exec('RESET ROLE;SET ROLE '+role);await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[u])}
  const rpc=async(fn,n,p={})=>(await db.query(`SELECT public.${fn}($1,$2::jsonb) v`,[n,JSON.stringify({companyId:company,id,requestId:randomUUID(),...p})])).rows[0].v
  const cmd=(n,p)=>rpc('ts_command',n,p),concern=(n,p)=>rpc('ts_concern_command',n,p),rows=async t=>(await db.query('SELECT to_jsonb(t) v FROM public.'+t+' t')).rows.map(r=>r.v)
  await as(owner);await cmd('create_company',{id:company,name:'SYNTHETIC concerns'})
  for(const [i,u] of [[1,worker],[2,otherWorker]]){await as(owner);await cmd('invite',{email:`concern${i}@example.test`,role:'worker',token:String(i).repeat(64)});await as(u);await cmd('accept_invitation',{token:String(i).repeat(64)})}
  await as(worker);const site=await rpc('ts_site_command','create',{id:randomUUID(),document:{name:'SYNTHETIC site',address:'Test bay',instructions:''}})
  const document={observation:'SYNTHETIC original blocked route',location:'Bay 2',immediate:'Recorded only',observedAt:'2026-09-23T12:00:00Z'},create={siteId:site.id,document,requestId:randomUUID()}
  let c=await concern('create',create);assert.deepEqual(await concern('create',create),c)
  await assert.rejects(concern('create',{...create,document:{...document,observation:'changed retry'}}),/TS_conflict/)
  const saved=await concern('save',{revision:c.revision,document});await assert.rejects(concern('save',{revision:c.revision,document}),/TS_conflict/);c=saved
  await as(owner);assert.deepEqual(await rows('ts_concerns'),[])
  await as(otherWorker);assert.deepEqual(await rows('ts_concerns'),[]);await assert.rejects(concern('save',{revision:c.revision,document}),/TS_denied/)
  await as(worker);const photo={concernId:id,id:randomUUID(),caption:'SYNTHETIC cone',sha256:'a'.repeat(64),byteSize:100,width:20,height:20}
  let e=await rpc('ts_concern_photo','reserve',photo);assert.deepEqual(await rpc('ts_concern_photo','reserve',photo),e)
  await assert.rejects(concern('submit',{revision:c.revision}),/TS_evidence_pending/)
  await assert.rejects(db.query('SELECT public.ts_complete_concern_photo($1,$2)',[e.id,worker]),/permission denied/)
  await as(owner,'service_role');assert.equal((await db.query('SELECT public.ts_concern_admit($1,$2) allowed',[id,worker])).rows[0].allowed,true);await db.query('SELECT public.ts_complete_concern_photo($1,$2)',[e.id,worker]);await as(worker)
  const submit={revision:c.revision,requestId:randomUUID()};c=await concern('submit',submit);assert.deepEqual(await concern('submit',submit),c);assert.ok(c.submitted_at);assert.equal(c.document.observedAt,document.observedAt)
  e=(await rows('ts_concern_photos'))[0];let a=(await rows('ts_actions'))[0];assert.equal(a.responsible_id,worker);assert.equal(a.concern_id,id);assert.equal((await rows('ts_actions')).length,1)
  assert.equal((await rows('ts_site_actions'))[0].site_id,site.id);assert.equal((await rows('ts_action_ownership'))[0].record_site,'SYNTHETIC site')
  await assert.rejects(concern('save',{revision:c.revision,document:{...document,observation:'overwrite'}}),/TS_immutable/)
  await assert.rejects(rpc('ts_concern_photo','remove',photo),/TS_immutable/)
  const note={note:'Separate correction',requestId:randomUUID()};await concern('note',note);await concern('note',note);assert.equal((await rows('ts_concern_notes')).length,1)
  const update=()=>({id:a.id,revision:a.revision,responsibleId:a.responsible_id,state:'in_progress',controls:'Follow-up controls',resolution:'Progress note',targetDate:''})
  await assert.rejects(cmd('update_action',{...update(),responsibleId:otherWorker}),/TS_denied/)
  await assert.rejects(cmd('update_action',{...update(),state:'closed'}),/TS_denied/)
  a=await cmd('update_action',update())
  await as(otherWorker);for(const t of ['ts_concerns','ts_concern_photos','ts_concern_notes','ts_actions','ts_site_actions','ts_action_ownership'])assert.deepEqual(await rows(t),[])
  assert.equal((await rows('ts_events')).some(x=>x.concern_id===id),false)
  await as(owner);const assign={...update(),responsibleId:otherWorker,requestId:randomUUID()};a=await cmd('update_action',assign);assert.deepEqual(await cmd('update_action',assign),a)
  await as(otherWorker);assert.equal((await rows('ts_concerns')).length,1);assert.deepEqual((await rows('ts_concern_photos'))[0],e);await assert.rejects(concern('note',{note:'Assignee is not the reporter'}),/TS_denied/)
  a=await cmd('update_action',{...update(),state:'awaiting_verification'})
  await as(owner);a=await cmd('update_action',{...update(),state:'closed'});assert.equal(a.verified_by,owner);a=await cmd('update_action',{...update(),state:'open'})
  assert.equal((await rows('ts_events')).filter(x=>x.kind==='action_updated'&&x.entity_id===a.id).length,5)
  assert.deepEqual((await rows('ts_concerns'))[0],c);assert.deepEqual((await rows('ts_concern_photos'))[0],e)
  await cmd('member',{userId:otherWorker,role:'remove'});await as(otherWorker);for(const t of ['ts_concerns','ts_concern_photos','ts_actions'])assert.deepEqual(await rows(t),[]);await assert.rejects(cmd('update_action',update()),/TS_denied/)
  await as(outsider);for(const t of ['ts_concerns','ts_concern_photos','ts_actions'])assert.deepEqual(await rows(t),[]);await assert.rejects(concern('create',{...create,id:randomUUID()}),/TS_denied/)
  await as(owner,'service_role');await assert.rejects(db.query("UPDATE public.ts_concerns SET document='{}' WHERE id=$1",[id]),/TS_immutable/);await assert.rejects(db.query("UPDATE public.ts_concern_photos SET caption='changed' WHERE id=$1",[e.id]),/TS_immutable/)
  await as(worker);assert.equal((await db.query("SELECT has_table_privilege('authenticated','public.ts_concerns','UPDATE') allowed")).rows[0].allowed,false)
  assert.equal(safeRedirect('/concerns/'+id),'/concerns/'+id);assert.equal(safeRedirect('/concerns/new?site='+site.id),'/concerns/new?site='+site.id)
 }finally{await db.close()}
})
