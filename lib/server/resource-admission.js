import 'server-only'
import {acquireSlot} from '../evidence/resource-slots.mjs'
import {AppError} from '../domain/errors'
import {storageServer,rpc} from './evidence'
export async function admitResource(kind,access){
 const release=acquireSlot(kind),started=Date.now()
 try{
  const admitted=await rpc(storageServer(),'ts_resource_admit',{kind,report_id:access.report.id,actor_id:access.user.id})
  if(admitted!==true)throw new AppError('resource_limited')
 }catch(e){release();throw e}
 return outcome=>{release();console.info(JSON.stringify({event:'resource_work',kind,outcome:outcome==='complete'?'complete':'failed',durationMs:Date.now()-started}))}
}
