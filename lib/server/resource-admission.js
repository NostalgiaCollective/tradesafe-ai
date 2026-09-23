import 'server-only'
import {acquireSlot} from '../evidence/resource-slots.mjs'
import {AppError} from '../domain/errors'
import {storageServer,rpc} from './evidence'
export async function admitResource(kind,access){
 const release=acquireSlot(kind),started=Date.now()
 try{
  const admitted=await rpc(storageServer(),access.concern?'ts_concern_admit':'ts_resource_admit',access.concern?{concern_id:access.concern.id,actor_id:access.user.id}:{kind,report_id:access.report.id,actor_id:access.user.id})
  if(admitted!==true)throw new AppError('resource_limited')
 }catch(e){release();throw e}
 return outcome=>{
  release()
  const complete=outcome==='complete'
  const record={event:'resource_work',kind,outcome:complete?'complete':'failed',durationMs:Date.now()-started}
  if(!complete&&typeof outcome==='string'&&/^[a-z][a-z0-9_]{1,48}$/.test(outcome))record.failureCode=outcome
  console.info(JSON.stringify(record))
 }
}
