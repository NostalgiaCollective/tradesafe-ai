import {concernAccess} from '@/lib/server/concerns'
import {mutation,rpc,storageServer,PHOTO_BUCKET,retainObject,privateHeaders} from '@/lib/server/evidence'
import {readImageBody,validateImage} from '@/lib/evidence/images.mjs'
import {UUID} from '@/lib/domain/validation'
import {AppError,errorResponse} from '@/lib/domain/errors'
import {admitResource} from '@/lib/server/resource-admission'
export const runtime='nodejs'
export async function GET(_request,{params}){try{
 const {id}=await params,a=await concernAccess(id),r=await a.supabase.from('ts_concern_photos').select('*').eq('concern_id',id).order('reserved_at')
 if(r.error)throw new AppError('query_failed');return Response.json(r.data,{headers:privateHeaders})
}catch(e){return errorResponse(e)}}
export async function POST(request,{params}){let finish,outcome='failed';try{
 mutation(request);const {id}=await params,a=await concernAccess(id,true,request),evidenceId=request.headers.get('x-evidence-id');let caption
 try{caption=decodeURIComponent(request.headers.get('x-evidence-caption')||'').trim()}catch{throw new AppError('invalid_request')}
 if(!UUID.test(evidenceId||'')||!caption||caption.length>1000)throw new AppError('invalid_request')
 finish=await admitResource('upload',a)
 const image=await validateImage(await readImageBody(request)),server=storageServer()
 const row=await rpc(a.supabase,'ts_concern_photo',{command:'reserve',p:{concernId:id,id:evidenceId,caption,sha256:image.sha256,byteSize:image.byteSize,width:image.width,height:image.height}})
 if(row.state!=='ready'){await retainObject(server,PHOTO_BUCKET,row.object_path,image.bytes,image.sha256,'image/jpeg');await rpc(server,'ts_complete_concern_photo',{evidence_id:row.id,actor_id:a.user.id})}
 await concernAccess(id);outcome='complete';return Response.json({id:row.id,state:'ready'},{headers:privateHeaders})
}catch(e){outcome=e instanceof AppError?e.code:'unavailable';return errorResponse(e)}finally{finish?.(outcome)}}
