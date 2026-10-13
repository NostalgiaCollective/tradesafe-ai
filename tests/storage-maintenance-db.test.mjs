import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile,readdir} from 'node:fs/promises'
import {randomUUID} from 'node:crypto'
import {PGlite} from '@electric-sql/pglite'
const migration='20261012000400_storage_maintenance.sql'
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


async function age(db,table,id,changes){
 await db.exec('RESET ROLE');const trigger=table==='ts_action_photos'?'action_photo_immutable':'site_package_immutable'
 // Synthetic disposable clock fixtures only; production APIs cannot rewrite immutable timestamps.
 await db.exec(`ALTER TABLE public.${table} DISABLE TRIGGER ${trigger}`)
 try{await db.query(`UPDATE public.${table} SET ${changes} WHERE id=$1`,[id])}finally{await db.exec(`ALTER TABLE public.${table} ENABLE TRIGGER ${trigger}`)}
}
function maintenance(f){
 const {db,owner,as}=f
 const service=async()=>as(owner,'service_role')
 const lease=async(command,kind,id,actor,token)=>(await db.query('SELECT public.ts_storage_lease($1,$2,$3,$4,$5) v',[command,kind,id,actor,token])).rows[0].v
 const task=async(command,kind,id,token,outcome=null)=>(await db.query('SELECT public.ts_storage_maintenance($1,$2,$3,$4,$5) v',[command,kind,id,token,outcome])).rows[0].v
 const candidates=async(n=25)=>(await db.query('SELECT public.ts_storage_candidates($1) v',[n])).rows[0].v
 return {service,lease,task,candidates}
}
test('maintenance leases protect active uploads; old ready unsubmitted photos tombstone before deletion and late completion cannot publish',async()=>{
 const f=await fixture(true),{db,worker,owner,as,photo,complete,photoPayload,rows}=f,{service,lease,task,candidates}=maintenance(f)
 try{
 await as(worker);const p=photoPayload(randomUUID());await photo(p);await complete(p)
 await age(db,'ts_action_photos',p.id,"reserved_at=now()-interval '8 days',uploaded_at=now()-interval '8 days'");await service()
 assert.equal((await candidates()).find(x=>x.id===p.id).reason,'unsubmitted_expired')
 const operation=randomUUID();assert.equal((await lease('begin','action_photo',p.id,worker,operation)).status,'leased');assert.equal((await candidates()).length,0)
 await assert.rejects(lease('begin','action_photo',p.id,worker,randomUUID()),/TS_storage_busy/);await assert.rejects(task('claim','action_photo',p.id,randomUUID()),/TS_storage_busy/)
 await lease('renew','action_photo',p.id,worker,operation);await lease('end','action_photo',p.id,worker,operation);assert.equal((await candidates()).length,0,'fresh attempted retry resets retention activity')
 await db.exec('RESET ROLE');await db.query("UPDATE public.ts_storage_leases SET expires_at=now()-interval '1 day',last_activity_at=now()-interval '8 days' WHERE object_id=$1",[p.id]);await service()
 const cleanup=randomUUID(),claim=await task('claim','action_photo',p.id,cleanup);assert.equal(claim.status,'claimed');assert.equal((await rows('ts_action_photos'))[0].state,'removed');assert.equal(claim.bucket,'tradesafe-evidence')
 await assert.rejects(task('claim','action_photo',p.id,randomUUID()),/TS_storage_busy/);await assert.rejects(task('recheck','action_photo',p.id,randomUUID()),/TS_conflict/);assert.equal((await task('recheck','action_photo',p.id,cleanup)).object_path,claim.object_path)
 await assert.rejects(db.query('SELECT public.ts_complete_action_photo($1,$2)',[p.id,worker]),/TS_immutable/);await assert.rejects(lease('begin','action_photo',p.id,worker,operation),/TS_immutable/)
 await db.exec('RESET ROLE');await db.query("UPDATE public.ts_storage_leases SET expires_at=now()-interval '1 second' WHERE object_id=$1",[p.id]);await service();
 const finished=await task('finish','action_photo',p.id,cleanup,'removed');assert.equal(finished.status,'removed');assert.deepEqual(await task('finish','action_photo',p.id,cleanup,'removed'),finished);assert.equal(Object.hasOwn(finished,'object_path'),false);await assert.rejects(task('finish','action_photo',p.id,cleanup,'failed'),/TS_conflict/)
 // A delayed provider write is eligible for another cleanup after the removed grace interval.
 await age(db,'ts_action_photos',p.id,"removed_at=now()-interval '16 minutes'");await service();assert.equal((await candidates()).find(x=>x.id===p.id).reason,'removed');const retry=randomUUID();await task('claim','action_photo',p.id,retry);await task('finish','action_photo',p.id,retry,'failed');assert.ok((await candidates()).some(x=>x.id===p.id))
 await as(worker);await assert.rejects(candidates(),/permission denied/);await assert.rejects(task('claim','action_photo',p.id,randomUUID()),/permission denied/);await assert.rejects(lease('begin','action_photo',p.id,worker,randomUUID()),/permission denied/)
 await as(owner,'service_role');await assert.rejects(candidates(26),/TS_invalid/)
 }finally{await db.close()}
})

test('maintenance protects submitted evidence and retained package; abandoned package preparation/completion is terminal',async()=>{
 const f=await fixture(),{db,owner,worker,site,action,as,photo,complete,photoPayload,submit,rows}=f,{service,lease,task,candidates}=maintenance(f)
 try{
 await as(worker);const id=randomUUID(),p=photoPayload(id);await photo(p);await complete(p);await submit({id,actionId:action.id,revision:action.revision,notes:'Retained evidence',state:'awaiting_verification',evidenceIds:[p.id]})
 await age(db,'ts_action_photos',p.id,"reserved_at=now()-interval '8 days',uploaded_at=now()-interval '8 days'");await service();assert.equal((await candidates()).length,0);await assert.rejects(task('claim','action_photo',p.id,randomUUID()),/TS_immutable/)
 await as(owner);const day=new Date().toISOString().slice(0,10),pday=new Date(Date.now()-86400000).toISOString().slice(0,10),nday=new Date(Date.now()+86400000).toISOString().slice(0,10),input={id:randomUUID(),siteId:site.id,firstDay:pday,lastDay:nday}
 const prepare=async p=>(await db.query('SELECT public.ts_site_package_prepare($1::jsonb) v',[JSON.stringify(p)])).rows[0].v
 const packageOne=await prepare(input),packageTwo=await prepare({...input,id:randomUUID()});assert.equal(packageOne.state,'pending');await service();await db.query('SELECT public.ts_complete_site_package($1,$2,$3,$4)',[packageOne.id,owner,'a'.repeat(64),123]);await assert.rejects(task('claim','site_package',packageOne.id,randomUUID()),/TS_immutable/)
 await age(db,'ts_site_packages',packageTwo.id,"cutoff=now()-interval '8 days'");await service();assert.ok((await candidates()).some(x=>x.id===packageTwo.id));const token=randomUUID();await lease('begin','site_package',packageTwo.id,owner,token);assert.equal((await candidates()).length,0);await lease('end','site_package',packageTwo.id,owner,token)
 await db.exec('RESET ROLE');await db.query("UPDATE public.ts_storage_leases SET last_activity_at=now()-interval '8 days',expires_at=now()-interval '1 day' WHERE object_id=$1",[packageTwo.id]);await service();const cleanup=randomUUID();await task('claim','site_package',packageTwo.id,cleanup);assert.equal((await rows('ts_site_packages')).find(x=>x.id===packageTwo.id).state,'abandoned');await task('finish','site_package',packageTwo.id,cleanup,'removed');assert.ok((await candidates()).some(x=>x.id===packageTwo.id),'abandoned object stays discoverable for late provider writes')
 await assert.rejects(db.query('SELECT public.ts_complete_site_package($1,$2,$3,$4)',[packageTwo.id,owner,'b'.repeat(64),123]),/TS_package_abandoned/)
 await as(owner);await assert.rejects(prepare({...input,id:packageTwo.id}),/TS_package_abandoned/);assert.equal((await db.query('SELECT public.ts_site_package_read($1) v',[packageOne.id])).rows[0].v.sha256,'a'.repeat(64));assert.equal(day.length,10)
 }finally{await db.close()}
})

test('operation renewal checks revocation and reassignment, but lease release remains possible',async()=>{
 const f=await fixture(),{db,owner,worker,other,action,as,cmd,photo,photoPayload,actionPayload}=f,{service,lease}=maintenance(f)
 try{
 await as(worker);const p=photoPayload(randomUUID());await photo(p);await service();const token=randomUUID();await lease('begin','action_photo',p.id,worker,token)
 await as(owner);await cmd('update_action',actionPayload(action,{responsibleId:other}));await service();await assert.rejects(lease('renew','action_photo',p.id,worker,token),/TS_denied/);await lease('end','action_photo',p.id,worker,token)
 await as(owner);await cmd('member',{userId:worker,role:'remove'});await service();await assert.rejects(lease('begin','action_photo',p.id,worker,randomUUID()),/TS_denied/)
 }finally{await db.close()}
})

test('maintenance inventory is capped at25 and fresh or recently removed uploads are not eligible',async()=>{
 const f=await fixture(),{db,worker,as,photo,photoPayload,company}=f,{service,candidates,task}=maintenance(f)
 try{
 await as(worker);const fresh=photoPayload(randomUUID());await photo(fresh)
 const old=[];for(let group=0;group<3;group++){const updateId=randomUUID();for(let i=0;i<10;i++){const p=photoPayload(updateId);await photo(p);old.push(p.id)}}
 await db.exec('RESET ROLE');await db.exec('ALTER TABLE public.ts_action_photos DISABLE TRIGGER action_photo_immutable');try{await db.query("UPDATE public.ts_action_photos SET reserved_at=now()-interval '8 days' WHERE company_id=$1 AND id=ANY($2::uuid[])",[company,old])}finally{await db.exec('ALTER TABLE public.ts_action_photos ENABLE TRIGGER action_photo_immutable')}
 await service();const listed=await candidates();assert.equal(listed.length,25);assert.equal(new Set(listed.map(x=>x.id)).size,25);assert.equal(listed.some(x=>x.id===fresh.id),false);assert.deepEqual(Object.keys(listed[0]).sort(),['eligible_at','id','kind','reason'])
 await assert.rejects(task('claim','action_photo',fresh.id,randomUUID()),/TS_maintenance_ineligible/)
 await as(worker);await photo(fresh,'remove');await service();await assert.rejects(task('claim','action_photo',fresh.id,randomUUID()),/TS_maintenance_ineligible/)
 }finally{await db.close()}
})
