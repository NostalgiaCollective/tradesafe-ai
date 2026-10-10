import test from 'node:test'
import assert from 'node:assert/strict'
import {summarizeMeasurements,LIMITS} from '../lib/operations/pilot-measurement.mjs'
const row={event:'pilot_task',trial:1,week:1,business:'B1',role:'worker',task:'concern',evidence:'observed_field',outcome:'complete',start:'warm',durationMs:5000}
const summarize=(rows,mode='tasks')=>summarizeMeasurements(rows.map(r=>JSON.stringify(r)+'\n'),mode)
test('pilot measurements keep evidence and cold starts separate, deduplicate trials and count abandoned attempts',async()=>{
 const statement={...row,trial:5,evidence:'customer_statement',start:'unknown'};delete statement.durationMs
 const r=await summarize([row,row,{...row,trial:2,outcome:'abandoned',durationMs:10000},{...row,trial:3,start:'cold'},{...row,trial:4,evidence:'automated'},statement])
 assert.equal(r.duplicates,1);assert.equal(r.groups.length,4)
 assert.deepEqual(r.groups[0].outcomes,{complete:1,abandoned:1});assert.equal(r.groups[0].medianMs,7500)
 assert.equal(r.groups[3].samples,0);assert.equal(r.groups[3].medianMs,null)
 const reordered=Object.fromEntries(Object.entries({...row,trial:6}).reverse())
 assert.equal((await summarize([row,reordered])).groups[0].count,2)
 await assert.rejects(summarize([row,{...row,outcome:'failed'}]),/Conflicting trial/)
})
test('pilot observations reject content, identifiers, invalid timings and unmeasured statement timing',async()=>{
 for(const change of [{description:'secret'},{route:'/report/token'},{business:'Customer name'},{role:'boss'},{durationMs:Infinity},{durationMs:-1},{evidence:'customer_statement'},{task:'arbitrary task text'}])await assert.rejects(summarize([{...row,...change}]))
 await assert.rejects(summarizeMeasurements(['not json'],'tasks'))
})
test('existing operation logs expose only known aggregates, never arbitrary payloads or failure text',async()=>{
 const r=await summarize([
  {event:'request_failed',code:'conflict',body:'SECRET',token:'SECRET'},
  {event:'request_failed',code:'SECRET'},
  {event:'resource_work',kind:'upload',outcome:'complete',durationMs:200},
  {event:'resource_work',kind:'pdf',outcome:'failed',durationMs:800,failureCode:'SECRET'},
  {event:'recovery_dispatch',outcome:'provider_unconfirmed'},
  {event:'SECRET',text:'SECRET'},
 ],'logs')
 assert.equal(r.ignored,2);assert.equal(r.groups.length,4);assert.doesNotMatch(JSON.stringify(r),/SECRET/)
 assert.equal(r.groups[0].code,'conflict');assert.equal(r.groups[1].medianMs,200)
 await assert.rejects(summarize([{event:'resource_work',kind:'upload',outcome:'complete',durationMs:-1}],'logs'))
})
test('measurement bounds reject oversized inputs instead of returning a partial successful summary',async()=>{
 await assert.rejects(summarizeMeasurements(['x'.repeat(LIMITS.lineBytes+1)],'logs'))
 async function* tooMany(){for(let i=0;i<=LIMITS.records;i++)yield '{}\n'}
 await assert.rejects(summarizeMeasurements(tooMany(),'logs'))
 async function* tooLarge(){for(let i=0;i<1025;i++)yield ' '.repeat(8191)+'\n'}
 await assert.rejects(summarizeMeasurements(tooLarge(),'logs'))
 const split=JSON.stringify(row)+'\n'
 assert.equal((await summarizeMeasurements([split.slice(0,20),split.slice(20)],'tasks')).groups[0].count,1)
})
