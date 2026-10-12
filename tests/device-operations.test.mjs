import {test} from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {applyText,draftKey,entries,readDraft,removeAll,textOnly,TTL,writeDraft} from '../lib/client/device-store.mjs'
import {emptyElectricalJob} from '../lib/domain/electrical-job.mjs'
import {createRecoveryScope} from '../lib/client/recovery-scope.mjs'
const storage=()=>{const values={};Object.defineProperties(values,{getItem:{value:k=>values[k]??null},setItem:{value:(k,v)=>values[k]=v},removeItem:{value:k=>delete values[k]}});return values}
const scope=kind=>({actor:randomUUID(),company:randomUUID(),id:randomUUID(),kind,siteId:randomUUID()})
test('electrical recovery retains bounded text but never changes server statuses, evidence or recorded checks',()=>{
 const local={scope:'Unsent scope',business:'x'.repeat(300),reviewNote:'Unrecorded note',reviewSource:'Registry checked by person',inspection:'acceptance reported',certificatePhoto:randomUUID(),credential_check:{actor:randomUUID()},password:'secret'},server={inspection:'not recorded',certificatePhoto:'server-photo',credential_check:{actor:'server-actor'}}
 const value=applyText('electrical',server,local)
 assert.equal(value.scope,'Unsent scope');assert.equal(value.business.length,200);assert.equal(value.reviewNote,local.reviewNote);assert.equal(value.inspection,server.inspection);assert.equal(value.certificatePhoto,server.certificatePhoto);assert.deepEqual(value.credential_check,server.credential_check);assert.ok(!JSON.stringify(textOnly('electrical',local)).includes('secret'))
})
test('completion recovery stores exact bounded retry identity and notes without files, tokens or closure commands',()=>{
 const batch={id:randomUUID(),revision:4},id=randomUUID(),submission={...batch,notes:'Original submitted notes',state:'awaiting_verification',evidenceIds:[id]},s=storage(),key=scope('action')
 const value=writeDraft(s,key,{revision:4,text:{batch,submission,notes:'Visible notes',caption:'Caption',photos:[{id,caption:'Caption',state:'ready',object_path:'private-secret'}],upload:{id,caption:'Caption',file:{bytes:'photo-secret'}},token:'auth-secret',state:'closed'}})
 assert.deepEqual(value.text.submission,submission);assert.equal(value.text.state,'in_progress');assert.deepEqual(value.text.upload,{id,caption:'Caption'});assert.ok(!JSON.stringify(value).includes('secret'))
 assert.deepEqual(readDraft(s,key).text,value.text);assert.equal(textOnly('action',{batch,submission:{...submission,id:randomUUID()}}).submission,null);assert.equal(textOnly('action',{batch,submission:{...submission,state:'closed'}}).submission,null)
})
test('electrical save retries keep exact inert entries but review commands retain receipt pointers only',()=>{
 const key=scope('electrical'),document={...emptyElectricalJob(),scope:'Original request',inspection:'awaiting outcome'},payload={requestId:randomUUID(),revision:2,siteId:key.id,companyId:key.company,document},operation={command:'save',payload}
 const copy=writeDraft(storage(),key,{text:{scope:'Visible text',operation}})
 assert.deepEqual(copy.text.operation,operation);assert.equal(applyText('electrical',{inspection:'not recorded'},copy.text).inspection,'not recorded');assert.equal(applyText('electrical',{},copy.text).operation,undefined)
 const review=textOnly('electrical',{reviewNote:'Unrecorded note',operation:{command:'review',payload:{...payload,note:'No replay',source:'No replay'}}})
 assert.deepEqual(review.operation,{command:'review',payload:{siteId:key.id,companyId:key.company,revision:2,requestId:payload.requestId}});assert.equal(review.reviewNote,'Unrecorded note');assert.equal(textOnly('electrical',{operation:{command:'verify',payload}}).operation,null)
})
test('same-site electrical and package copies have distinct keys; cross-tab conflict preserves exact operation',()=>{
 const s=storage(),job=scope('electrical'),pkg={...job,kind:'package'},generation=randomUUID(),a=writeDraft(s,job,{revision:3,text:{scope:'Electrical notes'}}),b=writeDraft(s,pkg,{text:{start:'2026-10-12',end:'2026-10-12',generation,signedUrl:'secret'}})
 assert.notEqual(draftKey(job),draftKey(pkg));assert.equal(entries(s).length,2);assert.equal(b.text.generation,generation);assert.ok(!JSON.stringify(b).includes('secret'));assert.throws(()=>writeDraft(s,pkg,{text:{generation:randomUUID()}},null),/Another tab/);assert.equal(readDraft(s,pkg).text.generation,generation);assert.equal(readDraft(s,{...job,actor:randomUUID()}),null);assert.equal(readDraft(s,{...job,company:randomUUID()}),null)
 s.removeItem(draftKey(pkg));assert.equal(readDraft(s,job).token,a.token)
})
test('recovery operation copies expire and logout removes every kind while preserving unrelated browser data',()=>{
 const s=storage();s.unrelated='keep';for(const kind of ['electrical','action','package'])writeDraft(s,scope(kind),{text:{}},null,100)
 assert.equal(entries(s,100).length,3);assert.equal(entries(s,100+TTL).length,0);for(const kind of ['electrical','action','package'])writeDraft(s,scope(kind),{text:{}},null,100+TTL);removeAll(s);assert.deepEqual(Object.keys(s),['unrelated'])
})
test('failed storage confirmation never replaces a confirmed local record and malformed command metadata is discarded',()=>{
 const s=storage(),key=scope('action'),first=writeDraft(s,key,{text:{notes:'Confirmed text'}})
 const denied={...s,getItem:s.getItem,removeItem:s.removeItem,setItem(){throw new DOMException('Full','QuotaExceededError')}}
 assert.throws(()=>writeDraft(denied,key,{text:{notes:'Still visible in editor'}},first.token),{name:'QuotaExceededError'});assert.equal(readDraft(s,key).text.notes,'Confirmed text')
 s[draftKey(key)]=JSON.stringify({...first,text:{...first.text,verification:true}});assert.equal(readDraft(s,key),null)
})
test('delayed authorization cannot read or restore device text after scope change, collapse or newer check',async()=>{
 let key='worker/company/action-one',reads=0,restores=0
 const scope=createRecoveryScope(()=>key),deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve}}
 async function inspect(result){const current=scope.begin();await result;if(!current())return;reads++;await Promise.resolve();if(current())restores++}
 const changed=deferred(),first=inspect(changed.promise);key='other-worker/other-company/action-two';changed.resolve();await first;assert.deepEqual([reads,restores],[0,0])
 const collapsed=deferred(),second=inspect(collapsed.promise);scope.invalidate();collapsed.resolve();await second;assert.deepEqual([reads,restores],[0,0])
 const old=deferred(),third=inspect(old.promise);await inspect(Promise.resolve());old.resolve();await third;assert.deepEqual([reads,restores],[1,1])
})
