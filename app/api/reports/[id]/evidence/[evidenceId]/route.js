import { reportAccess,photoRow,mutation,rpc,storageServer,PHOTO_BUCKET,objectBytes,cleanRemoved,privateHeaders } from '@/lib/server/evidence'
import { AppError,errorResponse } from '@/lib/domain/errors'
export const runtime='nodejs'
export async function GET(_request,{params}){try{
 const {id,evidenceId}=await params,access=await reportAccess(id),row=await photoRow(access,evidenceId)
 if(row.state!=='ready')throw new AppError('not_found')
 const bytes=await objectBytes(storageServer(),PHOTO_BUCKET,row.object_path,row.sha256,row.byte_size)
 const latest=await photoRow(await reportAccess(id),evidenceId)
 if(latest.state!=='ready')throw new AppError('not_found')
 return new Response(bytes,{headers:{...privateHeaders,'Content-Type':'image/jpeg','Content-Disposition':'inline; filename="evidence-'+row.id+'.jpg"'}})
}catch(e){return errorResponse(e)}}
export async function DELETE(request,{params}){try{
 mutation(request);const {id,evidenceId}=await params,access=await reportAccess(id,true)
 const row=await rpc(access.supabase,'ts_evidence_command',{command:'remove',p:{reportId:id,id:evidenceId}})
 let cleanupPending=false;try{await cleanRemoved(storageServer(),row)}catch{cleanupPending=true}
 return Response.json({id:row.id,state:'removed',cleanupPending},{headers:privateHeaders})
}catch(e){return errorResponse(e)}}
