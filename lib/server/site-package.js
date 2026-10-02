import 'server-only'
import {createReadStream} from 'node:fs'
import {createHash} from 'node:crypto'
import {Readable} from 'node:stream'
import {packageZip,PACKAGE_LIMITS} from '../evidence/package-zip.mjs'
import {packageIndex,publicPackageData,PACKAGE_RULES,PACKAGE_CONSISTENCY} from '../domain/site-package.mjs'
import {briefExport} from '../domain/brief-export.mjs'
import {loadSite} from './sites'
import {storageServer,objectBytes,PHOTO_BUCKET,PDF_BUCKET,privateHeaders} from './evidence'
import {databaseError} from './workspace'
import {acquireSlot} from '../evidence/resource-slots.mjs'
import {AppError} from '../domain/errors'
import {validHandoverDate} from '../domain/handover.mjs'
export async function sitePackage(supabase,id,p,signal){
 await loadSite(supabase,id)
 const start=p.get('start'),end=p.get('end')
 if(!validHandoverDate(start)||!validHandoverDate(end)||start>end)throw new AppError('invalid_request')
 if((Date.parse(end)-Date.parse(start))/86400000>=PACKAGE_LIMITS.days)throw new AppError('package_limit')
 const release=acquireSlot('pdf');let zip,handedOff=false
 try{
  const admit=await supabase.rpc('ts_site_package_admit',{site:id});if(admit.error)throw databaseError(admit.error);if(admit.data!==true)throw new AppError('resource_limited')
  const args={site:id,first_day:start,last_day:end},snapshot=async()=>{const r=await supabase.rpc('ts_site_evidence_snapshot',args);if(r.error)throw databaseError(r.error);return r.data},s=await snapshot();args.cutoff=s.cutoff
  const finishBy=Date.now()+90000,check=()=>{if(signal?.aborted||Date.now()>finishBy)throw new AppError('request_timeout')}
  zip=await packageZip();const server=storageServer(),generatedAt=new Date().toISOString()
  const attachments=[...s.reports.map(r=>({...r.pdf,name:'reports/'+r.id+'.pdf',bucket:PDF_BUCKET})),...s.photos.map(p=>({...p,name:'photos/'+p.id+'.jpg',bucket:PHOTO_BUCKET}))]
  if(attachments.length+s.briefs.length+3>PACKAGE_LIMITS.files||attachments.reduce((n,a)=>n+(a.byte_size||0),0)>PACKAGE_LIMITS.bytes-5*1024*1024)throw new AppError('package_limit')
  for(const a of attachments)if(a.state!=='ready'||!a.object_path||!a.sha256||!Number.isSafeInteger(a.byte_size)||a.byte_size<1)throw new AppError('package_missing');else if(a.byte_size>PACKAGE_LIMITS.fileBytes)throw new AppError('package_limit')
  // PDF source photos are verified even though their bytes are already embedded in retained PDFs.
  for(const r of s.reports)for(const photo of r.evidence_snapshot||[]){check();if(photo.byte_size>3*1024*1024)throw new AppError('package_missing');await objectBytes(server,PHOTO_BUCKET,photo.object_path,photo.sha256,photo.byte_size)}
  for(const a of attachments){check();await zip.add(a.name,await objectBytes(server,a.bucket,a.object_path,a.sha256,a.byte_size))}
  for(const version of s.briefs){check();await zip.add('briefs/'+version.brief_id+'-v'+version.version+'.html',briefExport({version,members:[],acknowledgements:s.acknowledgements.filter(a=>a.brief_id===version.brief_id&&a.version===version.version),reviews:s.reviews.filter(a=>a.brief_id===version.brief_id&&a.version===version.version),actions:s.actions.filter(a=>a.brief_id===version.brief_id)},generatedAt))}
  const clean=publicPackageData(s),files=()=>zip.entries.map(({name,bytes,sha256})=>({name,bytes,sha256}))
  await zip.add('records.json',JSON.stringify(clean,null,2));await zip.add('index.html',packageIndex(s,files(),generatedAt));await zip.add('manifest.json',JSON.stringify({formatVersion:1,site:clean.site,range:{start,end,timezone:s.timezone},generatedAt,cutoff:s.cutoff,limits:PACKAGE_LIMITS,inclusionRules:PACKAGE_RULES,consistency:PACKAGE_CONSISTENCY,records:s.history.map(({kind,record_id,revision,event_key})=>({kind,id:record_id,revision,event:event_key})),files:files(),manifestSelfHash:'Not recursive; whole ZIP SHA-256 supplied by download response'},null,2))
  check();if(JSON.stringify(await snapshot())!==JSON.stringify(s))throw new AppError('package_changed')
  const size=await zip.finish(),hash=createHash('sha256');for await(const chunk of createReadStream(zip.path)){check();hash.update(chunk)}
  // Recheck session membership after byte verification; no durable/public download URL exists.
  await loadSite(supabase,id);const stream=createReadStream(zip.path);const cleanup=()=>{void zip.cleanup().finally(release)}
  stream.once('close',cleanup);const abort=()=>stream.destroy();signal?.addEventListener('abort',abort,{once:true});stream.once('close',()=>signal?.removeEventListener('abort',abort));handedOff=true
  return new Response(Readable.toWeb(stream),{headers:{...privateHeaders,'Content-Type':'application/zip','Content-Length':String(size),'Content-Disposition':`attachment; filename="site-evidence-${id}-${start}-${end}.zip"`,'X-Content-SHA256':hash.digest('hex')}})
 }catch(e){if(e.code==='evidence_missing')throw new AppError('package_missing');if(e.message==='Package limit')throw new AppError('package_limit');throw e}finally{if(!handedOff){await zip?.cleanup();release()}}
}
