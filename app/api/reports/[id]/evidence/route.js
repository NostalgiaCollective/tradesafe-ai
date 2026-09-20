import { reportAccess,mutation,rpc,storageServer,PHOTO_BUCKET,retainObject,privateHeaders } from '@/lib/server/evidence'
import { readImageBody,validateImage } from '@/lib/evidence/images.mjs'
import { UUID } from '@/lib/domain/validation'
import { AppError,errorResponse } from '@/lib/domain/errors'
import { admitResource } from '@/lib/server/resource-admission'
export const runtime='nodejs'
export async function GET(_request,{params}){try{
 const {id}=await params,access=await reportAccess(id)
 const r=await access.supabase.from('ts_evidence').select('*').eq('report_id',id).order('reserved_at')
 if(r.error)throw new AppError('query_failed')
 return Response.json(r.data,{headers:privateHeaders})
}catch(e){return errorResponse(e)}}
export async function POST(request,{params}){let finish,outcome='failed';try{
 mutation(request);const {id}=await params,access=await reportAccess(id,true,request)
 const evidenceId=request.headers.get('x-evidence-id');let caption
 try{caption=decodeURIComponent(request.headers.get('x-evidence-caption')||'').trim()}catch{throw new AppError('invalid_request')}
 if(!UUID.test(evidenceId||'')||!caption||caption.length>1000)throw new AppError('invalid_request')
 finish=await admitResource('upload',access)
 const image=await validateImage(await readImageBody(request)),server=storageServer()
 const row=await rpc(access.supabase,'ts_evidence_command',{command:'reserve',p:{reportId:id,id:evidenceId,caption,sha256:image.sha256,byteSize:image.byteSize,width:image.width,height:image.height}})
 if(row.state!=='ready'){
  await retainObject(server,PHOTO_BUCKET,row.object_path,image.bytes,image.sha256,'image/jpeg')
  await rpc(server,'ts_complete_evidence',{evidence_id:row.id,actor_id:access.user.id})
 }
 // Repeat ordinary authorization after storage/completion and before acknowledging success.
 await reportAccess(id)
 outcome='complete'
 return Response.json({id:row.id,state:'ready'},{headers:privateHeaders})
}catch(e){outcome=e instanceof AppError?e.code:'unavailable';return errorResponse(e)}finally{finish?.(outcome)}}
