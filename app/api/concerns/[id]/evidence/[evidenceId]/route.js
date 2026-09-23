import {concernAccess,concernPhoto} from '@/lib/server/concerns'
import {mutation,rpc,storageServer,PHOTO_BUCKET,objectBytes,privateHeaders} from '@/lib/server/evidence'
import {AppError,errorResponse} from '@/lib/domain/errors'
export const runtime='nodejs'
export async function GET(_request,{params}){try{
 const {id,evidenceId}=await params,row=await concernPhoto(await concernAccess(id),evidenceId)
 if(row.state!=='ready')throw new AppError('not_found')
 const bytes=await objectBytes(storageServer(),PHOTO_BUCKET,row.object_path,row.sha256,row.byte_size)
 if((await concernPhoto(await concernAccess(id),evidenceId)).state!=='ready')throw new AppError('not_found')
 return new Response(bytes,{headers:{...privateHeaders,'Content-Type':'image/jpeg'}})
}catch(e){return errorResponse(e)}}
export async function DELETE(request,{params}){try{
 mutation(request);const {id,evidenceId}=await params,a=await concernAccess(id,true,request)
 const row=await rpc(a.supabase,'ts_concern_photo',{command:'remove',p:{concernId:id,id:evidenceId}})
 return Response.json({id:row.id,state:'removed'},{headers:privateHeaders})
}catch(e){return errorResponse(e)}}
