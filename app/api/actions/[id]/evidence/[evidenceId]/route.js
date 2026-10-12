import {actionAccess,actionPhoto} from '@/lib/server/action-completion'
import {mutation,rpc,storageServer,PHOTO_BUCKET,objectBytes,privateHeaders} from '@/lib/server/evidence'
import {UUID} from '@/lib/domain/validation'
import {AppError,errorResponse} from '@/lib/domain/errors'
export const runtime='nodejs'
export async function GET(_request,{params}){try{
 const {id,evidenceId}=await params,row=await actionPhoto(await actionAccess(id),evidenceId)
 if(row.state!=='ready')throw new AppError('not_found')
 const bytes=await objectBytes(storageServer(),PHOTO_BUCKET,row.object_path,row.sha256,row.byte_size)
 const current=await actionPhoto(await actionAccess(id),evidenceId);if(current.state!=='ready')throw new AppError('not_found')
 return new Response(bytes,{headers:{...privateHeaders,'Content-Type':'image/jpeg'}})
}catch(e){return errorResponse(e)}}
export async function DELETE(request,{params}){try{
 mutation(request);const {id,evidenceId}=await params,a=await actionAccess(id,false,request)
 const updateId=request.headers.get('x-update-id');if(!UUID.test(updateId||''))throw new AppError('invalid_request')
 const row=await rpc(a.supabase,'ts_action_photo',{command:'remove',p:{actionId:id,id:evidenceId,updateId}})
 const server=storageServer(),candidate=await rpc(server,'ts_action_photo_cleanup_candidate',{evidence_id:row.id,actor_id:a.user.id})
 if(candidate.object_path!==row.object_path)throw new AppError('conflict')
 const removed=await server.storage.from(PHOTO_BUCKET).remove([row.object_path]);if(removed.error)throw new AppError('unavailable')
 await actionAccess(id,false,request);return Response.json({id:row.id,state:'removed'},{headers:privateHeaders})
}catch(e){return errorResponse(e)}}
