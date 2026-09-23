import {concernAccess} from '@/lib/server/concerns'
import {mutation,rpc,storageServer,PHOTO_BUCKET,objectBytes,privateHeaders} from '@/lib/server/evidence'
import {errorResponse,AppError} from '@/lib/domain/errors'
export const runtime='nodejs'
export async function POST(request,{params}){try{
 mutation(request);const {id}=await params,a=await concernAccess(id,true,request),server=storageServer()
 const r=await a.supabase.from('ts_concern_photos').select('*').eq('concern_id',id).eq('state','pending').limit(10)
 if(r.error)throw new AppError('query_failed');const results=[]
 for(const row of r.data){try{await objectBytes(server,PHOTO_BUCKET,row.object_path,row.sha256,row.byte_size);await rpc(server,'ts_complete_concern_photo',{evidence_id:row.id,actor_id:a.user.id});results.push({id:row.id,state:'ready'})}catch{results.push({id:row.id,error:'incomplete'})}}
 await concernAccess(id);return Response.json({results},{headers:privateHeaders})
}catch(e){return errorResponse(e)}}
