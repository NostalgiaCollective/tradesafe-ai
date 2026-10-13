import 'server-only'
import {createReadStream} from 'node:fs'
import {createHash,randomUUID} from 'node:crypto'
import {packageZip,PACKAGE_LIMITS} from '../evidence/package-zip.mjs'
import {checkedPackageFile,retainPackageFile} from '../evidence/package-storage.mjs'
import {packageFileResponse} from '../evidence/package-response.mjs'
import {beginStorageOperation,endStorageOperation} from './storage-operation'
import {packageIndex,publicPackageData,PACKAGE_RULES,PACKAGE_CONSISTENCY,RETAINED_PACKAGE_BYTES} from '../domain/site-package.mjs'
import {briefExport} from '../domain/brief-export.mjs'
import {electricalExport} from '../domain/electrical-job.mjs'
import {loadSite} from './sites'
import {storageServer,objectBytes,PHOTO_BUCKET,PDF_BUCKET,privateHeaders,rpc} from './evidence'
import {databaseError} from './workspace'
import {acquireSlot} from '../evidence/resource-slots.mjs'
import {AppError} from '../domain/errors'
import {validHandoverDate} from '../domain/handover.mjs'
import {UUID} from '../domain/validation'

function range(p){
 const start=p.get('start'),end=p.get('end')
 if(!validHandoverDate(start)||!validHandoverDate(end)||start>end)throw new AppError('invalid_request')
 if((Date.parse(end)-Date.parse(start))/86400000>=PACKAGE_LIMITS.days)throw new AppError('package_limit')
 return {start,end}
}
async function context(supabase,id,actor){
 const site=await loadSite(supabase,id)
 const r=await supabase.from('ts_members').select('role').eq('company_id',site.company_id).eq('user_id',actor).eq('active',true).maybeSingle()
 if(r.error)throw databaseError(r.error)
 if(!r.data)throw new AppError('denied')
 return {site,retained:r.data.role!=='worker'}
}
const snapshot=(supabase,args)=>rpc(supabase,'ts_site_evidence_snapshot',args)
export async function packageStatus(supabase,id,generation,actor){
 if(!UUID.test(generation||''))throw new AppError('invalid_request')
 const access=await context(supabase,id,actor)
 if(!access.retained)throw new AppError('denied')
 const r=await supabase.from('ts_site_packages').select('id,state,first_day,last_day').eq('id',generation).eq('site_id',id).eq('actor_id',actor).maybeSingle()
 if(r.error)throw databaseError(r.error)
 if(r.data?.state==='ready')await rpc(supabase,'ts_site_package_read',{package_id:generation})
 await context(supabase,id,actor)
 return r.data||{id:generation,state:'not_started',first_day:null,last_day:null}
}
export async function packagePreparation(supabase,id,p,actor){
 const access=await context(supabase,id,actor),{start,end}=range(p)
 const s=await snapshot(supabase,{site:id,first_day:start,last_day:end})
 const missingReports=s.reports.filter(r=>r.pdf?.state!=='ready').map(r=>({id:r.id,revision:r.revision}))
 const packages=access.retained?await supabase.from('ts_site_packages').select('id,first_day,last_day,cutoff,completed_at,state,sha256,byte_size').eq('site_id',id).eq('actor_id',actor).eq('state','ready').order('completed_at',{ascending:false}).limit(10):{data:[]}
 if(packages.error)throw databaseError(packages.error)
 await context(supabase,id,actor)
 return {state:missingReports.length?'preparation_required':'ready_to_prepare',missingReports,packages:packages.data,retained:access.retained}
}
const fileResponse=(file,row,signal,release)=>packageFileResponse(file,row,signal,release,privateHeaders)
export async function retainedSitePackage(supabase,id,generation,signal){
 if(!UUID.test(generation||''))throw new AppError('invalid_request')
 let file,handedOff=false;const release=acquireSlot('pdf')
 try{
  const row=await rpc(supabase,'ts_site_package_read',{package_id:generation})
  if(row.site_id!==id||row.state!=='ready')throw new AppError('not_found')
  file=await checkedPackageFile(storageServer(signal).storage,row,signal)
  await rpc(supabase,'ts_site_package_read',{package_id:generation})
  handedOff=true;return fileResponse(file,row,signal,release)
 }catch(e){if(e.message?.startsWith('Package '))throw new AppError('package_missing');throw e}
 finally{if(!handedOff){try{await file?.cleanup()}finally{release()}}}
}
export async function sitePackage(supabase,id,p,signal,actor){
 const access=await context(supabase,id,actor),{start,end}=range(p)
 const generation=p.get('generation')||randomUUID()
 if(!UUID.test(generation))throw new AppError('invalid_request')
 const release=acquireSlot('pdf');let zip,lease,handedOff=false
 signal=AbortSignal.any([signal,AbortSignal.timeout(90000)].filter(Boolean))
 try{
  const admit=await rpc(supabase,'ts_site_package_admit',{site:id});if(admit!==true)throw new AppError('resource_limited')
  const row=access.retained?await rpc(supabase,'ts_site_package_prepare',{p:{id:generation,siteId:id,firstDay:start,lastDay:end}}):null
  if(row?.state==='ready'){
   // A lost successful response reuses the immutable generation, even after later edits.
   handedOff=true;release();return retainedSitePackage(supabase,id,generation,signal)
  }
  const control=storageServer()
  if(row){lease=await beginStorageOperation(control,'site_package',row.id,actor,signal);signal=lease.signal}
  const args={site:id,first_day:start,last_day:end},s=row?.snapshot||await snapshot(supabase,args);args.cutoff=s.cutoff
  const finishBy=Date.now()+90000,check=()=>{if(signal?.aborted||Date.now()>finishBy)throw new AppError('request_timeout')}
  zip=await packageZip();const server=storageServer(signal),generatedAt=s.cutoff
  const photoMap=new Map()
  for(const photo of [...s.photos,...(s.reportPhotos||[]),...(s.actionPhotos||[]),...(s.electricalPhotos||[])])photoMap.set(photo.id,photo)
  const attachments=[...s.reports.map(r=>({...r.pdf,name:'reports/'+r.id+'.pdf',bucket:PDF_BUCKET})),...Array.from(photoMap.values(),photo=>({...photo,state:'ready',name:'photos/'+photo.id+'.jpg',bucket:PHOTO_BUCKET}))]
  if(attachments.length+s.briefs.length+(s.electricalJobs?.length||0)+3>PACKAGE_LIMITS.files||attachments.reduce((n,a)=>n+(a.byte_size||0),0)>PACKAGE_LIMITS.bytes-5*1024*1024)throw new AppError('package_limit')
  if(row&&attachments.reduce((n,a)=>n+(a.byte_size||0),0)>RETAINED_PACKAGE_BYTES)throw new AppError('package_retention_limit')
  for(const a of attachments)if(a.state!=='ready'||!a.object_path||!a.sha256||!Number.isSafeInteger(a.byte_size)||a.byte_size<1)throw new AppError('package_missing');else if(a.byte_size>PACKAGE_LIMITS.fileBytes)throw new AppError('package_limit')
  for(const a of attachments){check();await zip.add(a.name,await objectBytes(server,a.bucket,a.object_path,a.sha256,a.byte_size))}
  for(const version of s.briefs){check();await zip.add('briefs/'+version.brief_id+'-v'+version.version+'.html',briefExport({version,members:[],acknowledgements:s.acknowledgements.filter(a=>a.brief_id===version.brief_id&&a.version===version.version),reviews:s.reviews.filter(a=>a.brief_id===version.brief_id&&a.version===version.version),actions:s.actions.filter(a=>a.brief_id===version.brief_id)},generatedAt))}
  for(const version of s.electricalJobs||[])await zip.add('electrical/'+version.site_id+'-r'+version.revision+'.html',electricalExport(version))
  const clean=publicPackageData(s),files=()=>zip.entries.map(({name,bytes,sha256})=>({name,bytes,sha256}))
  await zip.add('records.json',JSON.stringify(clean,null,2))
  await zip.add('index.html',packageIndex(s,files(),generatedAt))
  await zip.add('manifest.json',JSON.stringify({formatVersion:2,generation,retained:Boolean(row),site:clean.site,range:{start,end,timezone:s.timezone},generatedAt,cutoff:s.cutoff,limits:{...PACKAGE_LIMITS,retainedBytes:row?RETAINED_PACKAGE_BYTES:undefined},inclusionRules:PACKAGE_RULES,consistency:PACKAGE_CONSISTENCY,records:s.history.map(({kind,record_id,revision,event_key})=>({kind,id:record_id,revision,event:event_key})),electricalRevisions:(s.electricalJobs||[]).map(v=>({site:v.site_id,revision:v.revision,recordedAt:v.recorded_at})),completionUpdates:(s.actionUpdates||[]).map(u=>({id:u.id,action:u.action_id,basisRevision:u.basis_revision,submittedRevision:u.submitted_revision,recordedAt:u.recorded_at})),files:files(),manifestSelfHash:'Not recursive; whole ZIP SHA-256 supplied by download response'},null,2))
  check();if(JSON.stringify(await snapshot(supabase,args))!==JSON.stringify(s))throw new AppError('package_changed')
  const size=await zip.finish(),hash=createHash('sha256');for await(const chunk of createReadStream(zip.path)){check();hash.update(chunk)}
  const receipt={id:generation,site_id:id,first_day:start,last_day:end,byte_size:size,sha256:hash.digest('hex')}
  if(row){
   if(size>RETAINED_PACKAGE_BYTES)throw new AppError('package_retention_limit')
   await retainPackageFile(server.storage,{...row,...receipt},zip.path,signal)
   check();if(JSON.stringify(await snapshot(supabase,args))!==JSON.stringify(s))throw new AppError('package_changed')
   await rpc(server,'ts_complete_site_package',{package_id:generation,actor_id:actor,sha256:receipt.sha256,byte_size:size})
   await rpc(supabase,'ts_site_package_read',{package_id:generation})
  }else await context(supabase,id,actor)
  check();handedOff=true;return fileResponse(zip,receipt,signal,release)
 }catch(e){if(e.code==='evidence_missing'||e.message==='Package integrity')throw new AppError('package_missing');if(e.message==='Package limit')throw new AppError('package_limit');throw e}
 finally{await endStorageOperation(lease);if(!handedOff){try{await zip?.cleanup()}finally{release()}}}
}
