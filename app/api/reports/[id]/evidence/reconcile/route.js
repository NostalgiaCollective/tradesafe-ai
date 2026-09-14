import { reportAccess,mutation,rpc,storageServer,PHOTO_BUCKET,objectBytes,cleanRemoved,privateHeaders } from '@/lib/server/evidence'
import { AppError,errorResponse } from '@/lib/domain/errors'
export const runtime='nodejs'
export async function POST(request,{params}){try{
 mutation(request);const {id}=await params,access=await reportAccess(id,true),server=storageServer()
 const rows=await access.supabase.from('ts_evidence').select('*').eq('report_id',id)
 if(rows.error)throw new AppError('query_failed')
 const results=[]
 for(const row of rows.data){
  if(row.state==='ready')continue
  try{
   if(row.state==='removed'){await cleanRemoved(server,row);results.push({id:row.id,state:'removed'});continue}
   await objectBytes(server,PHOTO_BUCKET,row.object_path,row.sha256,row.byte_size)
   await rpc(server,'ts_complete_evidence',{evidence_id:row.id,actor_id:access.user.id})
   results.push({id:row.id,state:'ready'})
  }catch(e){results.push({id:row.id,state:row.state,error:e instanceof AppError?e.code:'unavailable'})}
 }
 return Response.json({results},{headers:privateHeaders})
}catch(e){return errorResponse(e)}}
