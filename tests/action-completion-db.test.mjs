import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile,readdir} from 'node:fs/promises'
import {randomUUID} from 'node:crypto'
import {PGlite} from '@electric-sql/pglite'
const migration='20261012000200_action_completion_evidence.sql'
async function fixture(upgrade=false){
 const db=new PGlite(),users=Array.from({length:4},randomUUID),[owner,worker,other,outsider]=users,company=randomUUID()
 await db.exec(`CREATE ROLE authenticated;CREATE ROLE anon;CREATE ROLE service_role BYPASSRLS;CREATE SCHEMA auth;CREATE SCHEMA storage;CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,email_confirmed_at timestamptz);CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;GRANT USAGE ON SCHEMA public,auth,storage TO authenticated,anon,service_role;CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);CREATE TABLE storage.objects(id uuid PRIMARY KEY,bucket_id text,name text);ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;`)
 for(const [i,id] of users.entries())await db.query('INSERT INTO auth.users VALUES($1,$2,now())',[id,`completion${i}@example.test`])
 for(const file of (await readdir('supabase/migrations')).filter(x=>x.endsWith('.sql')&&x<=migration&&(!upgrade||x!==migration)).sort())await db.exec(await readFile('supabase/migrations/'+file,'utf8'))
 const as=async(id,role='authenticated')=>{await db.exec('RESET ROLE;SET ROLE '+role);await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[id])}
 const rpc=async(fn,command,p={})=>(await db.query(`SELECT public.${fn}($1,$2::jsonb) v`,[command,JSON.stringify({companyId:company,requestId:randomUUID(),...p})])).rows[0].v
 const cmd=(command,p)=>rpc('ts_command',command,p),rows=async table=>(await db.query('SELECT to_jsonb(t) v FROM public.'+table+' t')).rows.map(x=>x.v)
 await as(owner);await cmd('create_company',{id:company,name:'SYNTHETIC completion upgrade'})
 for(const [i,id] of [[1,worker],[2,other]]){await as(owner);await cmd('invite',{email:`completion${i}@example.test`,role:'worker',token:String(i).repeat(64)});await as(id);await cmd('accept_invitation',{token:String(i).repeat(64)})}
 await as(owner);const site=await rpc('ts_site_command','create',{id:randomUUID(),document:{name:'SYNTHETIC electrical site',address:'Fictional bay',instructions:''}})
 const concern=await rpc('ts_concern_command','create',{id:randomUUID(),siteId:site.id,document:{observation:'SYNTHETIC missing circuit label',location:'Panel A',immediate:'Recorded, not notified',observedAt:''}})
 await rpc('ts_concern_command','submit',{id:concern.id,revision:concern.revision})
 let action=(await rows('ts_actions'))[0]
 const actionPayload=(a,changes={})=>({id:a.id,revision:a.revision,responsibleId:a.responsible_id,state:a.state,controls:a.controls,resolution:a.resolution,targetDate:a.target_date||'',priority:a.priority,...changes})
 action=await cmd('update_action',actionPayload(action,{responsibleId:worker}))
 const original={concerns:await rows('ts_concerns'),events:await rows('ts_events'),actions:await rows('ts_actions')}
 if(upgrade){await db.exec('RESET ROLE');await db.exec(await readFile('supabase/migrations/'+migration,'utf8'));await as(owner);for(const t of ['concerns','events','actions'])assert.deepEqual(await rows('ts_'+t),original[t])}
 const submit=async p=>(await db.query('SELECT public.ts_action_completion($1::jsonb) v',[JSON.stringify(p)])).rows[0].v,photo=(p,command='reserve')=>rpc('ts_action_photo',command,p)
 const complete=async p=>{await as(owner,'service_role');const x=(await db.query('SELECT public.ts_complete_action_photo($1,$2) v',[p.id,worker])).rows[0].v;await as(worker);return x}
 const photoPayload=(updateId,a=action)=>({id:randomUUID(),updateId,actionId:a.id,revision:a.revision,caption:'SYNTHETIC correction label',sha256:'a'.repeat(64),byteSize:123,width:120,height:80})
 return {db,owner,worker,other,outsider,company,site,concern,action,original,as,rpc,cmd,rows,actionPayload,submit,photo,complete,photoPayload}
}

test('action evidence: nonauthor assignment, ready-only immutable updates, retry dedupe, supervisor closure/reopen, upgrade preserves originals',async()=>{
 const f=await fixture(true),{db,owner,worker,other,outsider,action,site,as,cmd,rows,actionPayload,submit,photo,complete,photoPayload}=f
 try{
 await as(worker);const id=randomUUID(),p=photoPayload(id),pending=await photo(p);assert.deepEqual(await photo(p),pending)
 const input={id,actionId:action.id,revision:action.revision,notes:'SYNTHETIC correction, review requested',state:'awaiting_verification',evidenceIds:[p.id]}
 await assert.rejects(submit(input),/TS_evidence_pending/);await assert.rejects(db.query('SELECT public.ts_complete_action_photo($1,$2)',[p.id,worker]),/permission denied/)
 await as(other);assert.deepEqual(await rows('ts_action_photos'),[]);await assert.rejects(submit(input),/TS_denied/)
 await as(owner);assert.deepEqual(await rows('ts_action_photos'),[])
 await as(worker);const ready=await complete(p);assert.equal(ready.state,'ready');assert.ok(ready.uploaded_at);assert.deepEqual(await complete(p),ready)
 await assert.rejects(submit({...input,evidenceIds:[]}),/TS_invalid/);await assert.rejects(submit({...input,evidenceIds:[p.id,p.id]}),/TS_invalid/)
 const result=await submit(input);assert.equal(result.action.state,'awaiting_verification');assert.equal(result.action.verified_at,null);assert.equal(result.update.actor_id,worker);assert.equal(result.update.site_id,site.id);assert.equal(result.update.basis_revision,action.revision);assert.equal(result.update.submitted_revision,action.revision+1);assert.deepEqual(result.update.evidence_snapshot,[ready]);assert.ok(result.update.recorded_at);assert.deepEqual(await submit(input),result);assert.equal((await rows('ts_action_updates')).length,1)
 await assert.rejects(submit({...input,notes:'changed retry'}),/TS_conflict/);await assert.rejects(photo(p,'remove'),/TS_immutable/)
 await as(owner,'service_role');await assert.rejects(db.query('SELECT public.ts_action_photo_cleanup_candidate($1,$2)',[p.id,worker]),/TS_immutable/);await assert.rejects(db.query("UPDATE public.ts_action_photos SET caption='overwrite' WHERE id=$1",[p.id]),/TS_immutable/);await assert.rejects(db.query("UPDATE public.ts_action_updates SET notes='overwrite' WHERE id=$1",[id]),/TS_immutable/)
 await as(worker);await assert.rejects(cmd('update_action',actionPayload(result.action,{state:'closed'})),/TS_denied/)
 await as(owner);let a=await cmd('update_action',actionPayload(result.action,{state:'closed'}));assert.equal(a.verified_by,owner);assert.ok(a.verified_at);assert.deepEqual((await rows('ts_action_photos'))[0],ready)
 await as(worker);assert.deepEqual((await submit(input)).update,result.update)
 await as(owner);a=await cmd('update_action',actionPayload(a,{state:'open'}));await as(worker);await submit({id:randomUUID(),actionId:a.id,revision:a.revision,notes:'Separate later work',state:'in_progress',evidenceIds:[]});assert.equal((await rows('ts_action_updates')).length,2);assert.deepEqual((await rows('ts_action_updates')).find(u=>u.id===id).evidence_snapshot,[ready])
 await as(owner);assert.deepEqual(await rows('ts_concerns'),f.original.concerns);assert.equal((await rows('ts_events')).filter(e=>e.entity_id===a.id&&e.kind==='action_updated').length,5)
 await as(outsider);assert.deepEqual(await rows('ts_action_updates'),[]);assert.deepEqual(await rows('ts_action_photos'),[]);await assert.rejects(submit(input),/TS_denied/)
 }finally{await db.close()}
})

test('action uploads recheck reassign/revoke and stale revisions; pending limits and deliberate supervisor cleanup preserve retained data',async()=>{
 const f=await fixture(),{db,owner,worker,other,action,as,cmd,rows,actionPayload,submit,photo,photoPayload}=f
 try{
 await as(worker);const id=randomUUID(),p=photoPayload(id);await photo(p)
 await as(owner);let a=await cmd('update_action',actionPayload(action,{responsibleId:other}));await as(owner,'service_role');await assert.rejects(db.query('SELECT public.ts_complete_action_photo($1,$2)',[p.id,worker]),/TS_denied/)
 await as(worker);assert.deepEqual(await rows('ts_action_photos'),[]);await assert.rejects(photo(p,'remove'),/TS_denied/);await assert.rejects(submit({id,actionId:a.id,revision:a.revision,notes:'Not assigned',state:'in_progress',evidenceIds:[]}),/TS_denied/)
 await as(owner);a=await cmd('update_action',actionPayload(a,{responsibleId:worker}));await as(worker);await assert.rejects(photo(p),/TS_conflict/);await as(owner,'service_role');await assert.rejects(db.query('SELECT public.ts_complete_action_photo($1,$2)',[p.id,worker]),/TS_conflict/)
 await as(worker);assert.equal((await photo(p,'remove')).state,'removed');assert.equal((await photo(p,'remove')).state,'removed');await as(owner,'service_role');assert.ok((await db.query('SELECT public.ts_action_photo_cleanup_candidate($1,$2) v',[p.id,worker])).rows[0].v.object_path)
 await as(worker);const fresh=randomUUID(),q=photoPayload(fresh,a);for(const patch of [{byteSize:3145729},{width:2401},{sha256:'bad'}])await assert.rejects(photo({...q,...patch}),/check constraint/)
 for(let i=0;i<10;i++)await photo(photoPayload(fresh,a));await assert.rejects(photo(photoPayload(fresh,a)),/TS_evidence_limit/)
 const pending=(await rows('ts_action_photos')).find(x=>x.update_id===fresh);await as(owner);await cmd('member',{userId:worker,role:'remove'});await as(owner,'service_role');await assert.rejects(db.query('SELECT public.ts_complete_action_photo($1,$2)',[pending.id,worker]),/TS_denied/);await assert.rejects(db.query('SELECT public.ts_action_admit($1,$2)',[a.id,worker]),/TS_denied/)
 await as(worker);assert.deepEqual(await rows('ts_action_photos'),[]);await assert.rejects(submit({id:fresh,actionId:a.id,revision:a.revision,notes:'Revoked',state:'in_progress',evidenceIds:[]}),/TS_denied/)
 await as(owner);assert.equal((await photo({id:pending.id,updateId:fresh,actionId:a.id},'remove')).state,'removed');await as(owner,'service_role');assert.ok((await db.query('SELECT public.ts_action_photo_cleanup_candidate($1,$2) v',[pending.id,owner])).rows[0].v.object_path)
 }finally{await db.close()}
})

test('retained site package includes completion/electrical provenance; stable bytes metadata survive reopening and access is rechecked',async()=>{
 const f=await fixture(true),{db,owner,worker,other,outsider,site,action,as,rpc,cmd,rows,actionPayload,submit,photo,complete,photoPayload}=f
 try{
 await db.exec('RESET ROLE');await db.exec(await readFile('supabase/migrations/20261012000300_retained_site_packages.sql','utf8'))
 await as(owner)
 const {emptyElectricalJob}=await import('../lib/domain/electrical-job.mjs')
 const job=await rpc('ts_electrical_command','save',{siteId:site.id,revision:0,document:{...emptyElectricalJob(),scope:'SYNTHETIC kitchen electrical work'}})
 await as(worker);const updateId=randomUUID(),p=photoPayload(updateId);await photo(p);const ready=await complete(p);const retained=await submit({id:updateId,actionId:action.id,revision:action.revision,notes:'SYNTHETIC correction complete',state:'awaiting_verification',evidenceIds:[p.id]})
 await as(owner);let a=await cmd('update_action',actionPayload(retained.action,{state:'closed'}))
 const day=new Date().toISOString().slice(0,10),nextDay=new Date(Date.now()+86400000).toISOString().slice(0,10),priorDay=new Date(Date.now()-86400000).toISOString().slice(0,10)
 const payload={id:randomUUID(),siteId:site.id,firstDay:priorDay,lastDay:nextDay}
 const prepare=async p=>(await db.query('SELECT public.ts_site_package_prepare($1::jsonb) v',[JSON.stringify(p)])).rows[0].v
 const read=async id=>(await db.query('SELECT public.ts_site_package_read($1) v',[id])).rows[0].v
 const receipt=await prepare(payload);assert.deepEqual(await prepare(payload),receipt);assert.equal(receipt.state,'pending');assert.equal(receipt.snapshot.formatVersion,2);assert.equal(receipt.snapshot.electricalJobs[0].revision,job.revision);assert.equal(receipt.snapshot.actionUpdates[0].id,updateId);assert.deepEqual(receipt.snapshot.actionPhotos,[ready]);assert.ok(receipt.snapshot.actionEvents.some(e=>e.after_value?.state==='closed'))
 await assert.rejects(read(receipt.id),/TS_package_pending/)
 await assert.rejects(prepare({...payload,lastDay:day}),/TS_conflict/)
 await as(worker);await assert.rejects(prepare({...payload,id:randomUUID()}),/TS_denied/);assert.deepEqual(await rows('ts_site_packages'),[])
 await as(owner,'service_role');let completed=(await db.query('SELECT public.ts_complete_site_package($1,$2,$3,$4) v',[receipt.id,owner,'b'.repeat(64),456])).rows[0].v;assert.equal(completed.state,'ready');assert.deepEqual((await db.query('SELECT public.ts_complete_site_package($1,$2,$3,$4) v',[receipt.id,owner,'b'.repeat(64),456])).rows[0].v,completed);await assert.rejects(db.query('SELECT public.ts_complete_site_package($1,$2,$3,$4)',[receipt.id,owner,'c'.repeat(64),456]),/TS_conflict/)
 await as(owner);assert.deepEqual(await read(receipt.id),completed);a=await cmd('update_action',actionPayload(a,{state:'open'}));assert.deepEqual(await read(receipt.id),completed)
 const second=await prepare({...payload,id:randomUUID()});assert.notEqual(second.id,completed.id);assert.equal(second.snapshot.actions[0].state,'open');await cmd('update_action',actionPayload(a,{state:'in_progress'}));await as(owner,'service_role');await assert.rejects(db.query('SELECT public.ts_complete_site_package($1,$2,$3,$4)',[second.id,owner,'c'.repeat(64),456]),/TS_conflict/)
 await assert.rejects(db.query("UPDATE public.ts_site_packages SET sha256=$1 WHERE id=$2",['c'.repeat(64),receipt.id]),/TS_immutable/)
 await as(outsider);await assert.rejects(read(receipt.id),/TS_not_found/)
 await as(owner);await cmd('member',{userId:other,role:'owner'});await as(other);await assert.rejects(read(receipt.id),/TS_not_found/);await cmd('member',{userId:owner,role:'remove'});await as(owner);await assert.rejects(read(receipt.id),/TS_not_found/)
 }finally{await db.close()}
})

test('electrical report nonauthor completion and out-of-range electrical evidence are included; missing retained PDF blocks preparation',async()=>{
 const f=await fixture(),{db,owner,worker,site,as,rpc,cmd,rows,actionPayload,submit,photo,complete,photoPayload}=f
 try{
 await db.exec('RESET ROLE');await db.exec(await readFile('supabase/migrations/20261012000300_retained_site_packages.sql','utf8'));await as(owner)
 const {getTemplate}=await import('../lib/domain/templates.ts'),{emptyElectricalJob}=await import('../lib/domain/electrical-job.mjs')
 let report=await rpc('ts_site_command','create_report',{id:randomUUID(),siteId:site.id,templateId:getTemplate('electrical').id})
 const originalPhoto={id:randomUUID(),reportId:report.id,caption:'SYNTHETIC inspection document, not genuine approval',sha256:'d'.repeat(64),byteSize:99,width:20,height:20}
 await rpc('ts_evidence_command','reserve',originalPhoto);await as(owner,'service_role');await db.query('SELECT public.ts_complete_evidence($1,$2)',[originalPhoto.id,owner]);await as(owner)
 const document={...report.document,job:{address:'SYNTHETIC home',client:'Fictional',date:'2026-10-12'},answers:Object.fromEntries(report.template_snapshot.items.map((x,i)=>[x.id,{state:i===0?'attention':'not_applicable',note:'SYNTHETIC test only',controls:i===0?'Review correction':''}]))}
 report=await cmd('save_report',{id:report.id,revision:report.revision,document});report=await cmd('finalize',{id:report.id,revision:report.revision,acknowledged:true})
 let a=(await rows('ts_actions')).find(x=>x.report_id===report.id);a=await cmd('update_action',actionPayload(a,{responsibleId:worker}))
 await as(worker);await assert.rejects(cmd('amend',{id:randomUUID(),amendmentOf:report.id,reason:'Worker must not edit original'}),/TS_denied/)
 const updateId=randomUUID(),p=photoPayload(updateId,a);await photo(p);await complete(p);const result=await submit({id:updateId,actionId:a.id,revision:a.revision,notes:'Worker corrected someone else report finding',state:'awaiting_verification',evidenceIds:[p.id]});assert.equal(result.update.actor_id,worker)
 await as(owner);assert.deepEqual((await rows('ts_reports')).find(x=>x.id===report.id),report)
 await rpc('ts_electrical_command','save',{siteId:site.id,revision:0,document:{...emptyElectricalJob(),scope:'SYNTHETIC job',certificatePhoto:originalPhoto.id}})
 const priorDay=new Date(Date.now()-86400000).toISOString().slice(0,10),nextDay=new Date(Date.now()+86400000).toISOString().slice(0,10),request={id:randomUUID(),siteId:site.id,firstDay:priorDay,lastDay:nextDay}
 await assert.rejects(db.query('SELECT public.ts_site_package_prepare($1::jsonb)',[JSON.stringify(request)]),/TS_package_missing/);assert.deepEqual(await rows('ts_site_packages'),[])
 const attempt=randomUUID();await as(owner,'service_role');await db.query('SELECT public.ts_export_job($1,$2::jsonb,$3)',['begin',JSON.stringify({reportId:report.id,attempt}),owner]);await db.query('SELECT public.ts_export_job($1,$2::jsonb,$3)',['complete',JSON.stringify({reportId:report.id,attempt,sha256:'e'.repeat(64),byteSize:200}),owner]);await as(owner)
 const prepared=(await db.query('SELECT public.ts_site_package_prepare($1::jsonb) v',[JSON.stringify(request)])).rows[0].v;assert.equal(prepared.snapshot.reports[0].pdf.sha256,'e'.repeat(64));assert.equal(prepared.snapshot.reportPhotos[0].sha256,'d'.repeat(64));assert.equal(prepared.snapshot.electricalPhotos[0].id,originalPhoto.id)
 const distant=(await db.query("SELECT public.ts_site_evidence_snapshot($1,'2001-01-01','2001-01-02',statement_timestamp()) v",[site.id])).rows[0].v;assert.equal(distant.reports.length,0);assert.equal(distant.electricalJobs.length,1);assert.equal(distant.electricalPhotos[0].report_id,report.id);assert.equal(distant.electricalPhotos[0].sha256,'d'.repeat(64))
 // Even an unrelated permissive storage policy cannot expose retained packages.
 await db.exec('RESET ROLE');await db.exec("CREATE POLICY test_unrelated_permissive ON storage.objects FOR SELECT TO authenticated USING(true);GRANT SELECT ON storage.objects TO authenticated;");await db.query('INSERT INTO storage.objects VALUES($1,$2,$3)',[randomUUID(),'tradesafe-packages','synthetic.zip']);await as(owner);assert.deepEqual((await db.query("SELECT * FROM storage.objects WHERE bucket_id='tradesafe-packages'")).rows,[])
 }finally{await db.close()}
})
