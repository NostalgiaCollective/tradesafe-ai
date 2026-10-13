import {actionAccess} from '@/lib/server/action-completion'
import {mutation,rpc,storageServer,PHOTO_BUCKET,retainObject,objectBytes,privateHeaders} from '@/lib/server/evidence'
import {readImageBody,validateImage} from '@/lib/evidence/images.mjs'
import {completionUploadHeaders} from '@/lib/domain/action-completion.mjs'
import {UUID} from '@/lib/domain/validation'
import {AppError,errorResponse} from '@/lib/domain/errors'
import {admitResource} from '@/lib/server/resource-admission'
export const runtime='nodejs'
export async function GET(request,{params}){try{
 const {id}=await params,a=await actionAccess(id),updateId=new URL(request.url).searchParams.get('update')
 if(new URL(request.url).searchParams.get('pending')==='1'){const rows=await rpc(a.supabase,'ts_action_pending_photos',{action_id:id});await actionAccess(id);return Response.json(rows,{headers:privateHeaders})}
 if(!UUID.test(updateId||''))throw new AppError('invalid_request')
 const rows=await a.supabase.from('ts_action_photos').select('*').eq('action_id',id).eq('update_id',updateId).neq('state','removed').order('reserved_at').limit(10)
 if(rows.error)throw new AppError('query_failed');await actionAccess(id)
 return Response.json(rows.data,{headers:privateHeaders})
}catch(e){return errorResponse(e)}}
export async function POST(request,{params}){let finish,outcome='failed';try{
 mutation(request);const {id}=await params,a=await actionAccess(id,true,request),p=completionUploadHeaders(request.headers)
 finish=await admitResource('upload',a)
 const image=await validateImage(await readImageBody(request)),server=storageServer()
 const row=await rpc(a.supabase,'ts_action_photo',{command:'reserve',p:{...p,actionId:id,sha256:image.sha256,byteSize:image.byteSize,width:image.width,height:image.height}})
 if(row.state!=='ready'){await retainObject(server,PHOTO_BUCKET,row.object_path,image.bytes,image.sha256,'image/jpeg');await rpc(server,'ts_complete_action_photo',{evidence_id:row.id,actor_id:a.user.id})}else await objectBytes(server,PHOTO_BUCKET,row.object_path,row.sha256,row.byte_size)
 const current=await actionAccess(id,true,request);if(current.action.revision!==p.revision)throw new AppError('conflict')
 outcome='complete';return Response.json({id:row.id,state:'ready',caption:row.caption},{headers:privateHeaders})
}catch(e){outcome=e instanceof AppError?e.code:'unavailable';return errorResponse(e)}finally{finish?.(outcome)}}
