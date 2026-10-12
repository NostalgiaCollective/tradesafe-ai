import {actionAccess} from '@/lib/server/action-completion'
import {mutation,rpc,storageServer,PHOTO_BUCKET,objectBytes,privateHeaders} from '@/lib/server/evidence'
import {UUID} from '@/lib/domain/validation'
import {admitResource} from '@/lib/server/resource-admission'
import {errorResponse,AppError} from '@/lib/domain/errors'
import {beginStorageOperation,endStorageOperation} from '@/lib/server/storage-operation'
export const runtime='nodejs'
export async function POST(request,{params}){let finish,outcome='failed';try{
 mutation(request);const {id}=await params,a=await actionAccess(id,false,request),updateId=request.headers.get('x-update-id')
 if(!UUID.test(updateId||''))throw new AppError('invalid_request')
 finish=await admitResource('upload',a)
 const r=await a.supabase.from('ts_action_photos').select('*').eq('action_id',id).eq('update_id',updateId).eq('uploader_id',a.user.id).neq('state','removed').limit(10)
 if(r.error)throw new AppError('query_failed');const results=[],control=storageServer()
 for(const row of r.data){
  let lease
  try{
   request.signal.throwIfAborted()
   // Already retained evidence needs no operation lease and is never a cleanup candidate.
   if(row.state==='ready'){results.push({id:row.id,state:'ready',caption:row.caption});continue}
   lease=await beginStorageOperation(control,'action_photo',row.id,a.user.id,request.signal)
   const server=storageServer(lease.signal)
   await objectBytes(server,PHOTO_BUCKET,row.object_path,row.sha256,row.byte_size);lease.check()
   await rpc(server,'ts_complete_action_photo',{evidence_id:row.id,actor_id:a.user.id})
   results.push({id:row.id,state:'ready',caption:row.caption})
  }catch(e){request.signal.throwIfAborted();if(e instanceof AppError&&['denied','conflict','immutable','not_found','resource_busy','storage_busy'].includes(e.code))throw e;results.push({id:row.id,state:'pending',error:'incomplete'})}
  finally{await endStorageOperation(lease)}
 }
 await actionAccess(id,false,request);outcome='complete';return Response.json({results},{headers:privateHeaders})
}catch(e){outcome=e instanceof AppError?e.code:'unavailable';return errorResponse(e)}finally{finish?.(outcome)}}
