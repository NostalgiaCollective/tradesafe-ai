import {randomUUID} from 'node:crypto'

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const kinds=['action_photo','site_package']
const reasons=['removed','unsubmitted_expired','abandoned','pending_expired']
const safeFailure=error=>['TS_storage_busy','TS_maintenance_ineligible','TS_immutable','TS_conflict','TS_not_found'].includes(error?.message)?error.message.slice(3):'operation_failed'

// No scheduler or public API calls this. The executable adapter must positively
// identify its disposable target before inventory and before each mutation.
export async function maintainStorage({call,remove,verifyTarget,apply=false,limit=10,maxMs=30000}){
 if(typeof verifyTarget!=='function'||!Number.isInteger(limit)||limit<1||limit>25||!Number.isInteger(maxMs)||maxMs<1000||maxMs>60000)throw Error('Invalid maintenance bounds')
 const started=Date.now(),signal=AbortSignal.timeout(maxMs)
 await verifyTarget(signal)
 const candidates=await call('ts_storage_candidates',{batch_size:limit},signal)
 if(!Array.isArray(candidates)||candidates.length>limit||candidates.some(c=>!kinds.includes(c.kind)||!uuid.test(c.id)||!reasons.includes(c.reason)||!Number.isFinite(Date.parse(c.eligible_at))))throw Error('Invalid maintenance inventory')
 const inventory=candidates.map(({kind,id,reason,eligible_at})=>({kind,id,reason,eligible_at}))
 if(!apply)return {mode:'dry-run',status:'inventoried',candidates:inventory,attempted:0,elapsedMs:Date.now()-started}
 const results=[]
 for(const candidate of inventory){
  if(signal.aborted)break
  const token=randomUUID(),args={kind:candidate.kind,object_id:candidate.id,token}
  let claimed=false,outcome='failed',failure=null,recorded=false
  try{
   await verifyTarget(signal)
   await call('ts_storage_maintenance',{command:'claim',...args},signal);claimed=true
   await verifyTarget(signal)
   const target=await call('ts_storage_maintenance',{command:'recheck',...args},signal)
   const bucket=candidate.kind==='action_photo'?'tradesafe-evidence':'tradesafe-packages'
   if(target.id!==candidate.id||target.kind!==candidate.kind||target.bucket!==bucket||typeof target.object_path!=='string'||target.object_path.includes('..')||!target.object_path.endsWith(candidate.kind==='action_photo'?'.jpg':'.zip'))throw Error('Invalid cleanup target')
   signal.throwIfAborted()
   await remove(bucket,target.object_path,signal)
   outcome='removed'
  }catch(error){failure=safeFailure(error)}
  finally{
   if(claimed){
    // A bounded final receipt is attempted even if the work deadline elapsed.
    const receiptSignal=AbortSignal.timeout(5000)
    try{await verifyTarget(receiptSignal);await call('ts_storage_maintenance',{command:'finish',...args,outcome},receiptSignal);recorded=true}
    catch{failure='receipt_unconfirmed'}
   }
  }
  results.push({kind:candidate.kind,id:candidate.id,outcome,recorded,...(failure?{failure}:{})})
 }
 return {mode:'apply',status:results.some(r=>r.outcome!=='removed'||!r.recorded)?'completed_with_failures':results.length<inventory.length?'time_limit':'completed',candidates:inventory,attempted:results.length,remaining:inventory.length-results.length,results,elapsedMs:Date.now()-started}
}
