// Controlled socket failures against actual disposable Supabase. Never targets hosted projects.
import assert from 'node:assert/strict'
import {createServer,request as httpRequest} from 'node:http'
import {once} from 'node:events'
import {randomBytes,randomUUID,createHash} from 'node:crypto'
import {writeFileSync} from 'node:fs'
import {readFile} from 'node:fs/promises'
import {execFileSync} from 'node:child_process'
import {createClient} from '@supabase/supabase-js'
import sharp from 'sharp'
import {identity,assertIdentity} from '../operations/local-rehearsal.mjs'
import {localEnvironment,API_ORIGIN} from './local-environment.mjs'
import {retainObject,objectBytes} from '../../lib/evidence/private-objects.mjs'
import {validateImage} from '../../lib/evidence/images.mjs'
import {storageLease} from '../../lib/operations/storage-lease.mjs'
import {checkedPackageFile,retainPackageFile} from '../../lib/evidence/package-storage.mjs'
import {packageZip} from '../../lib/evidence/package-zip.mjs'
import {localMaintenance} from '../operations/maintain-local-storage.mjs'
import {maintainStorage} from '../../lib/operations/storage-maintenance.mjs'
import {todayInZone} from '../../lib/domain/handover.mjs'
const ok=r=>{assert.equal(r.error,null,'Synthetic transport operation failed');return r.data}
const hash=b=>createHash('sha256').update(b).digest('hex')
const barrier=()=>{let resolve;return {promise:new Promise(r=>{resolve=r}),resolve:v=>resolve(v)}}
async function bounded(p){let timer;try{return await Promise.race([p,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Local transport barrier timed out')),15000)})])}finally{clearTimeout(timer)}}
async function faultProxy(){
 let fault=null,observed=barrier(),committed=barrier(),bytes=0
 const server=createServer((req,res)=>{
  req.on('error',()=>{});res.on('error',()=>{})
  const selected=fault&&req.url.startsWith(fault.path)&&req.method===fault.method?fault:null
  if(selected)fault=null
  const upstream=httpRequest(new URL(req.url,API_ORIGIN),{method:req.method,headers:{...req.headers,host:new URL(API_ORIGIN).host}},reply=>{
   if(selected?.mode==='lost-response'){reply.resume();reply.on('end',()=>{committed.resolve(reply.statusCode);res.destroy()});return}
   res.writeHead(reply.statusCode,reply.headers)
   if(selected?.mode==='partial-download'){reply.once('data',b=>{reply.pause();res.write(b.subarray(0,1024));observed.resolve(b.length)});res.once('close',()=>reply.destroy());return}
   reply.pipe(res)
  })
  upstream.on('error',()=>res.destroy())
  req.on('aborted',()=>upstream.destroy())
  res.once('close',()=>{if(!res.writableEnded)upstream.destroy()})
  if(selected?.mode==='drop-upload'||selected?.mode==='cancel-upload'){
   req.once('data',b=>{bytes=b.length;upstream.write(b);req.pause();observed.resolve(bytes);if(selected.mode==='drop-upload'){upstream.destroy();req.destroy()}})
  }else req.pipe(upstream)
 })
 server.listen(0,'127.0.0.1');await once(server,'listening');const origin='http://127.0.0.1:'+server.address().port
 return {arm(path,method,mode){fault={path,method,mode};observed=barrier();committed=barrier();bytes=0},observed:()=>bounded(observed.promise),committed:()=>bounded(committed.promise),
  fetch(signal){return (url,options={})=>{const target=new URL(url);assert.equal(target.origin,API_ORIGIN);return fetch(origin+target.pathname+target.search,{...options,signal:AbortSignal.any([signal,options.signal,AbortSignal.timeout(15000)].filter(Boolean))})}},
  async close(){server.closeAllConnections();await new Promise(r=>server.close(r))}}
}
export async function fieldInterruption(env){
 localEnvironment({API_URL:env.NEXT_PUBLIC_SUPABASE_URL,ANON_KEY:env.NEXT_PUBLIC_SUPABASE_ANON_KEY,SERVICE_ROLE_KEY:env.SUPABASE_SERVICE_ROLE_KEY})
 assertIdentity(identity('tradesafe-ci'))
 const client=(key,fetcher)=>createClient(API_ORIGIN,key,{auth:{persistSession:false,autoRefreshToken:false},...(fetcher?{global:{fetch:fetcher}}:{})}),admin=client(env.SUPABASE_SERVICE_ROLE_KEY),actors=[]
 for(let i=0;i<2;i++){const credentials={email:'interruption-'+randomUUID()+'@example.test',password:randomBytes(24).toString('base64url')};ok(await admin.auth.admin.createUser({...credentials,email_confirm:true}));const c=client(env.NEXT_PUBLIC_SUPABASE_ANON_KEY),a=ok(await c.auth.signInWithPassword(credentials));actors.push({client:c,id:a.user.id,email:credentials.email,session:a.session})}
 const [owner,worker]=actors,company=randomUUID(),site=randomUUID(),concern=randomUUID()
 const command=(a,fn,command,p)=>a.client.rpc(fn,{command,p:{companyId:company,requestId:randomUUID(),...p}}).then(ok)
 await command(owner,'ts_command','create_company',{id:company,name:'SYNTHETIC transport recovery'})
 const token=randomBytes(32).toString('hex');await command(owner,'ts_command','invite',{email:worker.email,role:'worker',token});await command(worker,'ts_command','accept_invitation',{token})
 await command(owner,'ts_site_command','create',{id:site,document:{name:'SYNTHETIC interrupted electrical job',address:'Fictional training site',instructions:''}})
 const c=await command(owner,'ts_concern_command','create',{id:concern,siteId:site,document:{observation:'SYNTHETIC unfinished label',location:'Training panel',immediate:'No real work',observedAt:''}})
 await command(owner,'ts_concern_command','submit',{id:concern,revision:c.revision})
 let action=ok(await owner.client.from('ts_actions').select('*').eq('concern_id',concern).single())
 action=await command(owner,'ts_command','update_action',{id:action.id,revision:action.revision,responsibleId:worker.id,controls:action.controls,resolution:'',state:action.state,targetDate:'',priority:action.priority})
 const input=await sharp(randomBytes(1024*1024*3),{raw:{width:1024,height:1024,channels:3}}).png().toBuffer(),image=await validateImage(input),updateId=randomUUID(),proxy=await faultProxy(),cases=[],photos=[]
 const state=id=>admin.from('ts_action_photos').select('*').eq('id',id).single().then(ok)
 const leaseCall=(command,args)=>admin.rpc('ts_storage_lease',{command,...args}).then(ok)
 async function reserve(){const id=randomUUID();return command(worker,'ts_action_photo','reserve',{id,updateId,actionId:action.id,revision:action.revision,caption:'SYNTHETIC retained correction',sha256:image.sha256,byteSize:image.byteSize,width:image.width,height:image.height})}
 try{
  for(const mode of ['cancel-upload','drop-upload','lost-response']){
   const p=await reserve(),controller=new AbortController(),lease=await storageLease(leaseCall,{kind:'action_photo',object_id:p.id,actor_id:worker.id},controller.signal)
   const scoped=client(env.SUPABASE_SERVICE_ROLE_KEY,proxy.fetch(lease.signal));proxy.arm('/storage/v1/object/tradesafe-evidence/', 'POST',mode)
   const operation=retainObject(scoped,'tradesafe-evidence',p.object_path,image.bytes,image.sha256,'image/jpeg');operation.catch(()=>{})
   if(mode==='lost-response'){await operation;assert.equal(await proxy.committed(),200)}else{
    const observed=await proxy.observed();assert.ok(observed>0&&observed<image.bytes.length)
    if(mode==='cancel-upload')controller.abort()
    await assert.rejects(bounded(operation));assert.equal((await state(p.id)).state,'pending')
   }
   await lease.close();const recordedLease=ok(await admin.from('ts_storage_leases').select('expires_at').eq('object_id',p.id).single());assert.ok(Date.parse(recordedLease.expires_at)<=Date.now())
   // Same reservation and immutable object path; no new upload record on retry.
   if(mode!=='lost-response')await retainObject(admin,'tradesafe-evidence',p.object_path,image.bytes,image.sha256,'image/jpeg')
   assert.equal(hash(await objectBytes(admin,'tradesafe-evidence',p.object_path,image.sha256,image.byteSize)),image.sha256)
   ok(await admin.rpc('ts_complete_action_photo',{evidence_id:p.id,actor_id:worker.id}));photos.push(p)
   cases.push({case:mode,photoState:'ready',sameReservation:true,leaseReleased:true,hashVerified:true})
  }
  // Storage completed; DB response vanishes only after the actual RPC returned success.
  const p=await reserve();await retainObject(admin,'tradesafe-evidence',p.object_path,image.bytes,image.sha256,'image/jpeg')
  const proxyAdmin=client(env.SUPABASE_SERVICE_ROLE_KEY,proxy.fetch());proxy.arm('/rest/v1/rpc/ts_complete_action_photo','POST','lost-response')
  const lost=await proxyAdmin.rpc('ts_complete_action_photo',{evidence_id:p.id,actor_id:worker.id});assert.ok(lost.error);assert.equal(await proxy.committed(),200)
  const before=await state(p.id);assert.equal(before.state,'ready');const again=ok(await admin.rpc('ts_complete_action_photo',{evidence_id:p.id,actor_id:worker.id}));assert.equal(again.id,p.id);assert.equal((await state(p.id)).uploaded_at,before.uploaded_at);photos.push(p)
  cases.push({case:'database photo-completion response lost',sameReservation:true,originalTimestampRetained:true})
  const proxyWorker=client(env.NEXT_PUBLIC_SUPABASE_ANON_KEY,proxy.fetch());ok(await proxyWorker.auth.setSession(worker.session))
  const payload={id:updateId,actionId:action.id,revision:action.revision,notes:'SYNTHETIC correction recorded after interrupted requests',state:'awaiting_verification',evidenceIds:photos.map(p=>p.id)}
  proxy.arm('/rest/v1/rpc/ts_action_completion','POST','lost-response');const lostUpdate=await proxyWorker.rpc('ts_action_completion',{p:payload});assert.ok(lostUpdate.error);assert.equal(await proxy.committed(),200)
  const retried=ok(await worker.client.rpc('ts_action_completion',{p:payload}));assert.equal(retried.update.id,updateId);assert.equal(ok(await owner.client.from('ts_action_updates').select('id').eq('action_id',action.id)).length,1);assert.equal(ok(await owner.client.from('ts_actions').select('state').eq('id',action.id).single()).state,'awaiting_verification')
  cases.push({case:'completion update response lost',retainedUpdates:1,workerDidNotVerify:true})
  // Actual private storage stream retrieval: cancellation after server sent bytes.
  const zip=await packageZip();try{
   await zip.add('synthetic.json',JSON.stringify({purpose:'Synthetic transport fixture',padding:'x'.repeat(4*1024*1024)}));await zip.finish()
   const bytes=await readFile(zip.path),row={object_path:company+'/'+randomUUID()+'.zip',byte_size:bytes.length,sha256:hash(bytes)}
   await retainPackageFile(admin.storage,row,zip.path)
   proxy.arm('/storage/v1/object/', 'GET','partial-download');const abort=new AbortController(),download=checkedPackageFile(client(env.SUPABASE_SERVICE_ROLE_KEY,proxy.fetch(abort.signal)).storage,row,abort.signal);download.catch(()=>{})
   assert.ok(await proxy.observed()>0);abort.abort();await assert.rejects(bounded(download))
   const retained=await checkedPackageFile(admin.storage,row);assert.equal(hash(await readFile(retained.path)),row.sha256);await retained.cleanup()
   cases.push({case:'private package retrieval interrupted midstream',hashVerifiedOnRetry:true})
  }finally{await zip.cleanup()}
  const receipt={status:'PASSED',commit:env.GITHUB_SHA,runtime:'Controlled real loopback HTTP proxy with disposable Supabase Auth/PostgreSQL/private Storage',cases,limitations:['Synthetic local only; not hosted or physical-device evidence','Transport harness calls production storage helpers and actual authenticated RPCs; WebKit separately exercises application routes','The synthetic private package transport fixture tests byte transport, not package content assembly']}
  writeFileSync('test-results/field-interruption.json',JSON.stringify(receipt,null,2));return receipt
 }finally{await proxy.close()}
}

// Runs after real WebKit workflows, so retained packages and submitted photos exist.
export async function storageMaintenanceExecution(env){
 localEnvironment({API_URL:env.NEXT_PUBLIC_SUPABASE_URL,ANON_KEY:env.NEXT_PUBLIC_SUPABASE_ANON_KEY,SERVICE_ROLE_KEY:env.SUPABASE_SERVICE_ROLE_KEY})
 const target=identity('tradesafe-ci');assertIdentity(target)
 const client=key=>createClient(API_ORIGIN,key,{auth:{persistSession:false,autoRefreshToken:false}}),admin=client(env.SUPABASE_SERVICE_ROLE_KEY)
 const retainedPackages=ok(await admin.from('ts_site_packages').select('*').eq('state','ready').order('completed_at',{ascending:false}).limit(3))
 const updates=ok(await admin.from('ts_action_updates').select('evidence_snapshot').order('recorded_at',{ascending:false}).limit(100)),retainedPhoto=updates.flatMap(u=>u.evidence_snapshot).find(p=>p?.object_path)
 assert.ok(retainedPackages.length&&retainedPhoto,'Actual browser workflows must have retained protected evidence')
 async function verifyProtected(){
  await objectBytes(admin,'tradesafe-evidence',retainedPhoto.object_path,retainedPhoto.sha256,retainedPhoto.byte_size)
  for(const row of retainedPackages){const f=await checkedPackageFile(admin.storage,row);await f.cleanup()}
 }
 await verifyProtected()
 const credentials={email:'maintenance-'+randomUUID()+'@example.test',password:randomBytes(24).toString('base64url')};ok(await admin.auth.admin.createUser({...credentials,email_confirm:true}));const owner=client(env.NEXT_PUBLIC_SUPABASE_ANON_KEY),signed=ok(await owner.auth.signInWithPassword(credentials)),company=randomUUID(),site=randomUUID()
 const command=(fn,command,p)=>owner.rpc(fn,{command,p:{companyId:company,requestId:randomUUID(),...p}}).then(ok)
 await command('ts_command','create_company',{id:company,name:'SYNTHETIC physical maintenance'})
 await command('ts_site_command','create',{id:site,document:{name:'SYNTHETIC abandoned uploads',address:'Fictional local training site',instructions:''}})
 const concern=randomUUID(),c=await command('ts_concern_command','create',{id:concern,siteId:site,document:{observation:'SYNTHETIC cleanup test',location:'Training panel',immediate:'No real work',observedAt:''}});await command('ts_concern_command','submit',{id:concern,revision:c.revision})
 const action=ok(await owner.from('ts_actions').select('*').eq('concern_id',concern).single()),image=await validateImage(await sharp({create:{width:48,height:48,channels:3,background:'#224466'}}).png().toBuffer())
 const photo=await command('ts_action_photo','reserve',{id:randomUUID(),updateId:randomUUID(),actionId:action.id,revision:action.revision,caption:'SYNTHETIC abandoned private object',sha256:image.sha256,byteSize:image.byteSize,width:image.width,height:image.height})
 await retainObject(admin,'tradesafe-evidence',photo.object_path,image.bytes,image.sha256,'image/jpeg')
 const date=todayInZone(),generation=ok(await owner.rpc('ts_site_package_prepare',{p:{id:randomUUID(),siteId:site,firstDay:date,lastDay:date}})),zip=await packageZip()
 const literal=v=>"'"+String(v).replaceAll("'","''")+"'"
 const sql=statement=>{assertIdentity(target);return execFileSync('docker',['exec','-i',target.container,'psql','-X','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-Atc',statement],{stdio:'pipe',timeout:15000}).toString().trim()}
 const agePhoto=()=>sql("BEGIN; ALTER TABLE public.ts_action_photos DISABLE TRIGGER action_photo_immutable; UPDATE public.ts_action_photos SET reserved_at=now()-interval '8 days', removed_at=CASE WHEN state='removed' THEN now()-interval '16 minutes' ELSE removed_at END WHERE id="+literal(photo.id)+"; ALTER TABLE public.ts_action_photos ENABLE TRIGGER action_photo_immutable; COMMIT;")
 try{
  await zip.add('index.html','<p>SYNTHETIC abandoned package transport fixture</p>');await zip.finish();const bytes=await readFile(zip.path)
  await retainPackageFile(admin.storage,{...generation,byte_size:bytes.length,sha256:hash(bytes)},zip.path)
  agePhoto();sql("BEGIN; ALTER TABLE public.ts_site_packages DISABLE TRIGGER site_package_immutable; UPDATE public.ts_site_packages SET cutoff=now()-interval '8 days' WHERE id="+literal(generation.id)+"; ALTER TABLE public.ts_site_packages ENABLE TRIGGER site_package_immutable; COMMIT;")
  const dry=await localMaintenance(env,{apply:false,limit:25});assert.ok(dry.candidates.some(r=>r.id===photo.id));assert.ok(dry.candidates.some(r=>r.id===generation.id))
  assert.ok(!dry.candidates.some(r=>r.id===retainedPhoto.id||retainedPackages.some(p=>p.id===r.id)))
  const applied=await localMaintenance(env,{apply:true,limit:25,maxMs:60000});assert.equal(applied.status,'completed')
  for(const id of [photo.id,generation.id])assert.ok(applied.results.some(r=>r.id===id&&r.outcome==='removed'&&r.recorded))
  assert.ok((await admin.storage.from('tradesafe-evidence').download(photo.object_path)).error)
  assert.ok((await admin.storage.from('tradesafe-packages').download(generation.object_path)).error)
  assert.equal(ok(await admin.from('ts_action_photos').select('state').eq('id',photo.id).single()).state,'removed')
  assert.equal(ok(await admin.from('ts_site_packages').select('state').eq('id',generation.id).single()).state,'abandoned')
  await verifyProtected()
  // Emulate a delayed storage write after cleanup. Tombstone still forbids publication.
  ok(await admin.storage.from('tradesafe-evidence').upload(photo.object_path,image.bytes,{contentType:'image/jpeg',upsert:false}))
  assert.equal((await admin.rpc('ts_complete_action_photo',{evidence_id:photo.id,actor_id:signed.user.id})).error?.message,'TS_immutable')
  agePhoto()
  // Actual DELETE commits but its success response is lost: record uncertainty, then retry.
  const proxy=await faultProxy()
  try{
   const faultAdmin=createClient(API_ORIGIN,env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:proxy.fetch()}})
   proxy.arm('/storage/v1/object/tradesafe-evidence','DELETE','lost-response')
   const failed=await maintainStorage({apply:true,limit:25,maxMs:60000,verifyTarget:async()=>assertIdentity(target),call:(name,args)=>admin.rpc(name,args).then(ok),remove:async(bucket,path)=>{const r=await faultAdmin.storage.from(bucket).remove([path]);if(r.error)throw Error('Synthetic interrupted removal')}})
   const lostStatus=await proxy.committed();assert.ok(lostStatus>=200&&lostStatus<300)
   assert.equal(failed.status,'completed_with_failures');assert.ok(failed.results.some(r=>r.id===photo.id&&r.outcome==='failed'&&r.recorded))
  }finally{await proxy.close()}
  const reclaimed=await localMaintenance(env,{apply:true,limit:25,maxMs:60000});assert.equal(reclaimed.status,'completed');assert.ok(reclaimed.results.some(r=>r.id===photo.id&&r.outcome==='removed'&&r.recorded))
  assert.ok((await admin.storage.from('tradesafe-evidence').download(photo.object_path)).error);await verifyProtected()
  const receipt={status:'PASSED',commit:env.GITHUB_SHA,runtime:'Positively identified disposable Supabase; real private object removal',agedUnsubmittedPhotoReclaimed:true,agedPendingPackageReclaimed:true,lateWriteReclaimed:true,interruptedRemovalReceiptRetried:true,latePublicationDenied:true,protectedSubmittedPhotoHashUnchanged:true,protectedReadyPackageHashesUnchanged:retainedPackages.length,limitations:['Synthetic local only; no hosted maintenance activated','Time eligibility is simulated only on named task-owned fixture rows; object creation and removal are real Storage operations']}
  writeFileSync('test-results/storage-maintenance-execution.json',JSON.stringify(receipt,null,2));return receipt
 }finally{await zip.cleanup()}
}
