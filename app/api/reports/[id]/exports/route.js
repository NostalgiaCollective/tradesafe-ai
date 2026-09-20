import { randomUUID } from 'node:crypto'
import { reportAccess,mutation,rpc,storageServer,PHOTO_BUCKET,PDF_BUCKET,objectBytes,retainObject,privateHeaders } from '@/lib/server/evidence'
import { renderExport } from '@/lib/evidence/pdf.mjs'
import { digest } from '@/lib/evidence/images.mjs'
import { AppError,errorResponse } from '@/lib/domain/errors'
import { admitResource } from '@/lib/server/resource-admission'
export const runtime='nodejs'
export const maxDuration=60
export async function GET(_request,{params}){try{
 const {id}=await params,access=await reportAccess(id)
 const r=await access.supabase.from('ts_exports').select('id,state,export_version,snapshot_version,cutoff_at,completed_at,failure_code,lease_until').eq('report_id',id).eq('export_version',1).maybeSingle()
 if(r.error)throw new AppError('query_failed')
 return Response.json(r.data,{headers:privateHeaders})
}catch(e){return errorResponse(e)}}
export async function POST(request,{params}){
 let job,server,access,attempt,finish,outcome='failed'
 try{
  mutation(request);const {id}=await params;access=await reportAccess(id)
  if(access.report.lifecycle!=='finalized')throw new AppError('incomplete')
  finish=await admitResource('pdf',access)
  server=storageServer();attempt=randomUUID()
  job=await rpc(server,'ts_export_job',{command:'begin',p:{reportId:id,attempt},actor_id:access.user.id})
  if(job.state!=='ready'){
   const photos=[]
   for(const e of job.snapshot.report.evidence_snapshot||[])photos.push({id:e.id,bytes:await objectBytes(server,PHOTO_BUCKET,e.object_path,e.sha256,e.byte_size)})
   const bytes=await renderExport(job,photos),hash=digest(bytes)
   const path=job.company_id+'/'+id+'/'+job.id+'/'+attempt+'.pdf'
   await retainObject(server,PDF_BUCKET,path,bytes,hash,'application/pdf')
   job=await rpc(server,'ts_export_job',{command:'complete',p:{reportId:id,attempt,sha256:hash,byteSize:bytes.length},actor_id:access.user.id})
  }
  await reportAccess(id)
  outcome='complete'
  return Response.json({id:job.id,state:job.state,download:'/api/reports/'+id+'/exports/'+job.id},{headers:privateHeaders})
 }catch(e){
  outcome=e instanceof AppError?e.code:'unavailable'
  if(job?.state==='generating'&&job.attempt===attempt){try{await rpc(server,'ts_export_job',{command:'fail',p:{reportId:job.report_id,attempt,code:e instanceof AppError&&e.code==='evidence_missing'?'evidence_missing':'generation_failed'},actor_id:access.user.id})}catch{/* Lease permits explicit retry after an interrupted or revoked session. */}}
  return errorResponse(e)
 }finally{finish?.(outcome)}
}
