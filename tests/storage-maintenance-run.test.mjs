import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {maintainStorage} from '../lib/operations/storage-maintenance.mjs'
const candidate=()=>({kind:'action_photo',id:randomUUID(),reason:'removed',eligible_at:'2026-10-01T00:00:00Z'})
function adapter(item=candidate()){
 const calls=[],deletes=[],identities=[]
 return {item,calls,deletes,identities,
  async verifyTarget(signal){signal.throwIfAborted();identities.push('checked')},
  async call(name,args,signal){signal.throwIfAborted();calls.push({name,...args});if(name==='ts_storage_candidates')return [item];return {id:item.id,kind:item.kind,bucket:'tradesafe-evidence',object_path:'synthetic/actions/'+item.id+'.jpg'}},
  async remove(bucket,path,signal){signal.throwIfAborted();deletes.push({bucket,path})}
 }
}
test('maintenance dry run inventories sanitized metadata without claiming or deleting',async()=>{
 const a=adapter(),result=await maintainStorage(a)
 assert.equal(result.mode,'dry-run');assert.equal(result.attempted,0);assert.deepEqual(a.calls.map(x=>x.name),['ts_storage_candidates']);assert.deepEqual(a.deletes,[]);assert.deepEqual(result.candidates,[a.item])
})
test('maintenance checks disposable identity before claim and delete; failure stops mutation and records failure',async()=>{
 const a=adapter();let checks=0;a.verifyTarget=async()=>{checks++;if(checks===3)throw Error('Private target identity changed')}
 const result=await maintainStorage({...a,apply:true})
 assert.equal(a.deletes.length,0);assert.equal(result.status,'completed_with_failures');assert.equal(result.results[0].recorded,true);assert.equal(result.results[0].outcome,'failed');assert.equal(result.results[0].failure,'operation_failed');assert.equal(a.calls.at(-1).outcome,'failed');assert.ok(!JSON.stringify(result).includes('Private target'))
})
test('maintenance valid claim/recheck deletes exactly one scoped object and returns no internal path or token',async()=>{
 const a=adapter(),result=await maintainStorage({...a,apply:true})
 assert.deepEqual(a.calls.filter(x=>x.command).map(x=>x.command),['claim','recheck','finish']);assert.equal(new Set(a.calls.filter(x=>x.token).map(x=>x.token)).size,1);assert.equal(a.deletes.length,1);assert.equal(result.status,'completed');assert.equal(result.results[0].recorded,true)
 const output=JSON.stringify(result);for(const forbidden of ['object_path','synthetic/actions','token','tradesafe-evidence'])assert.ok(!output.includes(forbidden));assert.equal(a.identities.length,4)
})
test('maintenance refuses an incompatible rechecked bucket and never reports a failed deletion as success',async()=>{
 const a=adapter(),base=a.call;a.call=async(...args)=>{const value=await base(...args);return args[1].command==='recheck'?{...value,bucket:'tradesafe-exports'}:value}
 const result=await maintainStorage({...a,apply:true});assert.equal(a.deletes.length,0);assert.equal(result.status,'completed_with_failures');assert.equal(a.calls.at(-1).outcome,'failed')
 const b=adapter();b.remove=async()=>{throw Error('SECRET signed URL and image filename')};const failed=await maintainStorage({...b,apply:true});assert.equal(failed.results[0].outcome,'failed');assert.equal(failed.results[0].recorded,true);assert.equal(failed.results[0].failure,'operation_failed');assert.ok(!JSON.stringify(failed).includes('SECRET'))
})
test('maintenance differentiates unconfirmed receipts from successful deletion and rejects excessive inventory',async()=>{
 const a=adapter(),base=a.call;a.call=async(...args)=>{if(args[1].command==='finish')throw Error('Provider unavailable');return base(...args)}
 const result=await maintainStorage({...a,apply:true});assert.equal(a.deletes.length,1);assert.equal(result.results[0].outcome,'removed');assert.equal(result.results[0].recorded,false);assert.equal(result.results[0].failure,'receipt_unconfirmed');assert.equal(result.status,'completed_with_failures')
 const b=adapter();b.call=async()=>[candidate(),candidate()];await assert.rejects(maintainStorage({...b,apply:true,limit:1}),/Invalid maintenance inventory/);assert.equal(b.deletes.length,0)
})
test('maintenance cancellation stops deletion work but still attempts bounded failure receipt',async()=>{
 const a=adapter();a.remove=async(_bucket,_path,signal)=>new Promise((resolve,reject)=>{signal.addEventListener('abort',()=>reject(signal.reason),{once:true})})
 const result=await maintainStorage({...a,apply:true,maxMs:1000});assert.equal(result.results[0].outcome,'failed');assert.equal(result.results[0].recorded,true);assert.equal(a.calls.at(-1).command,'finish');assert.equal(a.calls.at(-1).outcome,'failed')
})
