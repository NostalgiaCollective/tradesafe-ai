import {actionAccess,actionPhoto,completionHistory} from '@/lib/server/action-completion'
import {mutation,rpc,privateHeaders,storageServer,objectBytes,PHOTO_BUCKET} from '@/lib/server/evidence'
import {readCompletionBody} from '@/lib/domain/action-completion.mjs'
import {admitResource} from '@/lib/server/resource-admission'
import {AppError,errorResponse} from '@/lib/domain/errors'
import {UUID} from '@/lib/domain/validation'
export const runtime='nodejs'
export async function GET(request,{params}){try{
 const {id}=await params,p=new URL(request.url).searchParams,page=Number(p.get('page')||0),updateId=p.get('updateId')
 if(!Number.isSafeInteger(page)||page<0||page>10000)throw new AppError('invalid_request')
 const a=await actionAccess(id,false,request)
 let data
 if(updateId){
  if(!UUID.test(updateId))throw new AppError('invalid_request')
  const result=await a.supabase.from('ts_action_updates').select('*').eq('action_id',id).eq('id',updateId).maybeSingle()
  if(result.error)throw new AppError('query_failed')
  data={update:result.data}
 }else data=await completionHistory(a,page)
 const current=await actionAccess(id,false,request);if(current.action.revision!==a.action.revision)throw new AppError('conflict')
 return Response.json({...data,action:current.action},{headers:privateHeaders})
}catch(e){return errorResponse(e)}}
export async function POST(request,{params}){let finish,outcome='failed';try{
 mutation(request);const {id}=await params,a=await actionAccess(id,false,request),p=await readCompletionBody(request)
 const existing=await a.supabase.from('ts_action_updates').select('id').eq('id',p.id).eq('action_id',id).maybeSingle()
 if(existing.error)throw new AppError('query_failed')
 // A committed retry returns the existing receipt even during a storage outage.
 // New publication verifies every selected ready object before the guarded commit.
 if(!existing.data&&p.evidenceIds.length){
  finish=await admitResource('upload',a);const server=storageServer(request.signal)
  for(const photoId of p.evidenceIds){const photo=await actionPhoto(a,photoId);if(photo.state!=='ready')throw new AppError('evidence_pending');await objectBytes(server,PHOTO_BUCKET,photo.object_path,photo.sha256,photo.byte_size)}
 }
 request.signal.throwIfAborted()
 const result=await rpc(a.supabase,'ts_action_completion',{p:{...p,actionId:id}})
 // Exact committed retries remain readable after later closure; SQL distinguishes retry from new work.
 const current=await actionAccess(id,false,request)
 outcome='complete';return Response.json({...result,action:current.action},{headers:privateHeaders})
}catch(e){outcome=e instanceof AppError?e.code:'unavailable';return errorResponse(e)}finally{finish?.(outcome)}}
