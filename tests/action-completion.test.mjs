import test from 'node:test'
import assert from 'node:assert/strict'
import {completionPayload,completionUploadHeaders,readCompletionBody} from '../lib/domain/action-completion.mjs'
const id='11111111-1111-4111-8111-111111111111',photo='22222222-2222-4222-8222-222222222222',valid={id,revision:2,notes:'Synthetic correction recorded',state:'awaiting_verification',evidenceIds:[photo]}
test('completion submission accepts only explicit bounded notes, revision and distinct photo references',()=>{
 assert.deepEqual(completionPayload({...valid,companyId:'ignored',actorId:'ignored'}),valid)
 for(const patch of [{notes:' '},{notes:'x'.repeat(4001)},{revision:0},{revision:1.2},{state:'closed'},{evidenceIds:[photo,photo]},{evidenceIds:['bad']},{evidenceIds:Array(11).fill(photo)}])assert.throws(()=>completionPayload({...valid,...patch}),{code:'invalid_request'})
})
test('completion photo headers require an update baseline, caption and stable photo identity',()=>{
 const h=new Headers({'x-evidence-id':photo,'x-update-id':id,'x-action-revision':'2','x-evidence-caption':encodeURIComponent('Synthetic label  -  corrected')})
 assert.deepEqual(completionUploadHeaders(h),{id:photo,updateId:id,revision:2,caption:'Synthetic label  -  corrected'})
 h.set('x-evidence-caption','%');assert.throws(()=>completionUploadHeaders(h),{code:'invalid_request'})
})
test('completion request parser bounds actual streamed bytes rather than trusting Content-Length',async()=>{
 const req=value=>new Request('http://localhost/api/actions/'+id+'/completion-updates',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(value)})
 assert.deepEqual(await readCompletionBody(req(valid)),valid)
 await assert.rejects(readCompletionBody(req({...valid,extra:'x'.repeat(20001)})),{code:'invalid_request'})
 await assert.rejects(readCompletionBody(new Request('http://localhost',{method:'POST',body:'{}'})),{code:'invalid_request'})
})

