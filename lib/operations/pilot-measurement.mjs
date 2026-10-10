// Offline operator tool. No browser instrumentation, network calls or content fields.
import assert from 'node:assert/strict'
import {ERROR_MESSAGES} from '../domain/errors.ts'

export const LIMITS=Object.freeze({bytes:8*1024*1024,lineBytes:16384,records:10000})
const tasks=['onboarding','sign_in','recovery','brief','acknowledgement','concern','progress','verification','export','resume']
const evidence=['automated','observed_field','customer_statement']
const outcomes=['complete','assisted','failed','abandoned']
function exactKeys(record,keys){assert.deepEqual(Object.keys(record).sort(),[...keys].sort(),'Unexpected or missing measurement fields')}
function duration(ms){assert.ok(Number.isSafeInteger(ms)&&ms>=0&&ms<=86400000,'Invalid duration')}
function stats(values){
 if(!values.length)return {samples:0,medianMs:null,p95Ms:null}
 const sorted=[...values].sort((a,b)=>a-b),n=sorted.length
 return {samples:n,medianMs:n%2?sorted[(n-1)/2]:(sorted[n/2-1]+sorted[n/2])/2,p95Ms:sorted[Math.ceil(n*.95)-1]}
}
export function taskObservation(row){
 assert.ok(row&&typeof row==='object'&&!Array.isArray(row))
 const keys=['event','trial','week','business','role','task','evidence','outcome','start']
 if(row.evidence!=='customer_statement')keys.push('durationMs')
 exactKeys(row,keys)
 assert.equal(row.event,'pilot_task')
 assert.ok(Number.isSafeInteger(row.trial)&&row.trial>0&&row.trial<=100000)
 assert.ok([1,2,3,4].includes(row.week)&&['B1','B2','B3'].includes(row.business))
 assert.ok(['worker','supervisor','owner'].includes(row.role)&&tasks.includes(row.task))
 assert.ok(evidence.includes(row.evidence)&&outcomes.includes(row.outcome))
 assert.ok(['warm','cold','unknown'].includes(row.start))
 if(row.evidence==='customer_statement')assert.equal(row.start,'unknown','Statements are not timing observations')
 else duration(row.durationMs)
 return row
}
function logEvent(row){
 if(!row||typeof row!=='object'||Array.isArray(row))return null
 // Select only known values; never emit arbitrary keys, codes, text or identifiers.
 if(row.event==='request_failed'&&Object.hasOwn(ERROR_MESSAGES,row.code))return {event:row.event,code:row.code}
 if(row.event==='recovery_dispatch'&&row.outcome==='provider_unconfirmed')return {event:row.event,outcome:row.outcome}
 if(row.event==='resource_work'&&['upload','pdf'].includes(row.kind)&&['complete','failed'].includes(row.outcome)){
  duration(row.durationMs)
  return {event:row.event,kind:row.kind,outcome:row.outcome,durationMs:row.durationMs}
 }
 return null
}
export async function summarizeMeasurements(chunks,mode){
 assert.ok(['tasks','logs'].includes(mode),'Choose tasks or logs')
 let bytes=0,pending='',lines=0,ignored=0,duplicates=0
 const groups=new Map(),trials=new Map()
 const consume=line=>{
  if(!line.trim())return
  assert.ok(++lines<=LIMITS.records,'Too many records')
  assert.ok(Buffer.byteLength(line)<=LIMITS.lineBytes,'Line too large')
  let raw;try{raw=JSON.parse(line)}catch{if(mode==='tasks')throw Error('Invalid observation');ignored++;return}
  const row=mode==='tasks'?taskObservation(raw):logEvent(raw)
  if(!row){ignored++;return}
  if(mode==='tasks'){
   // A trial number is unique in this selected input window. Identical reimports
   // are ignored; conflicting observations fail rather than changing the result.
   const signature=JSON.stringify(Object.keys(row).sort().map(k=>[k,row[k]]))
   if(trials.has(row.trial)){assert.equal(trials.get(row.trial),signature,'Conflicting trial');duplicates++;return}
   trials.set(row.trial,signature)
  }
  const {durationMs,...dimensions}=row
  delete dimensions.trial;delete dimensions.outcome
  const key=JSON.stringify(Object.keys(dimensions).sort().map(k=>[k,dimensions[k]]))
  if(!groups.has(key))groups.set(key,{...dimensions,count:0,outcomes:{},durations:[]})
  const group=groups.get(key);group.count++
  if(row.outcome)group.outcomes[row.outcome]=(group.outcomes[row.outcome]||0)+1
  if(durationMs!==undefined)group.durations.push(durationMs)
 }
 for await(const chunk of chunks){
  // Callers provide UTF-8 decoded streams so split multi-byte input is handled.
  assert.equal(typeof chunk,'string')
  bytes+=Buffer.byteLength(chunk);assert.ok(bytes<=LIMITS.bytes,'Input too large')
  pending+=chunk
  let end;while((end=pending.indexOf('\n'))!==-1){consume(pending.slice(0,end));pending=pending.slice(end+1)}
  assert.ok(Buffer.byteLength(pending)<=LIMITS.lineBytes,'Line too large')
 }
 if(pending)consume(pending)
 return {status:'MEASUREMENTS_ONLY',mode,lines,ignored,duplicates,
  limitations:'No readiness verdict. Log errors have no request denominator and can overlap resource failures. Task results are observer-entered; statements are not observed completion. Small timing samples are descriptive only.',
  groups:[...groups.values()].map(({durations,...g})=>({...g,...stats(durations)}))}
}
