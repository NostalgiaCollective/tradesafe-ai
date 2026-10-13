import {electricalFields} from '../domain/electrical-job.mjs'
export const PREFIX='tradesafe.device-text.v1:'
export const TTL=7*24*60*60*1000, MAX_RECORDS=10, MAX_BYTES=1024*1024, MAX_RECORD_BYTES=128*1024
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const size=s=>new TextEncoder().encode(s).length
function electricalOperation(value){
 const p=value?.payload
 if(!['save','review','credential_check'].includes(value?.command)||!p||!uuid.test(p.requestId)||!uuid.test(p.siteId)||!uuid.test(p.companyId)||!Number.isInteger(p.revision)||p.revision<0)return null
 const base={command:value.command,payload:{siteId:p.siteId,companyId:p.companyId,revision:p.revision,requestId:p.requestId}}
 if(value.command!=='save')return base // Receipt pointer only; never a replayable review/check command.
 const d=p.document;if(!d||electricalFields.some(f=>f.options?!f.options.includes(d[f.key]):typeof d[f.key]!=='string'||d[f.key].length>f.max)||['certificatePhoto','defectPhoto'].some(k=>d[k]!==''&&!uuid.test(d[k])))return null
 base.payload.document=Object.fromEntries([...electricalFields.map(f=>[f.key,d[f.key]]),['certificatePhoto',d.certificatePhoto],['defectPhoto',d.defectPhoto]])
 return base
}
export function textOnly(kind,d={}){
 const text=(s,n)=>typeof s==='string'?s.slice(0,n):''
 if(kind==='concern')return {observation:text(d.observation,4000),location:text(d.location,1000),immediate:text(d.immediate,4000)}
 if(kind==='electrical')return {...Object.fromEntries([...electricalFields.filter(f=>!f.options).map(f=>[f.key,text(d[f.key],f.max)]),['reviewNote',text(d.reviewNote,2000)],['reviewSource',text(d.reviewSource,500)]]),operation:electricalOperation(d.operation)}
 if(kind==='action'){
  const batch=d.batch&&uuid.test(d.batch.id)&&Number.isInteger(d.batch.revision)&&d.batch.revision>0?{id:d.batch.id,revision:d.batch.revision}:null
  const photos=(Array.isArray(d.photos)?d.photos:[]).slice(0,10).filter(p=>uuid.test(p?.id)).map(p=>({id:p.id,caption:text(p.caption,1000),state:p.state==='ready'?'ready':'pending'}))
  const upload=d.upload&&uuid.test(d.upload.id)?{id:d.upload.id,caption:text(d.upload.caption,1000)}:null
  const submission=d.submission&&batch&&d.submission.id===batch.id&&d.submission.revision===batch.revision&&['in_progress','awaiting_verification'].includes(d.submission.state)&&Array.isArray(d.submission.evidenceIds)&&d.submission.evidenceIds.length<=10&&d.submission.evidenceIds.every(x=>uuid.test(x))?{id:batch.id,revision:batch.revision,notes:text(d.submission.notes,4000),state:d.submission.state,evidenceIds:[...d.submission.evidenceIds]}:null
  return {notes:text(d.notes,4000),caption:text(d.caption,1000),state:d.state==='awaiting_verification'?'awaiting_verification':'in_progress',batch,photos,upload,submission}
 }
 if(kind==='package')return {start:/^\d{4}-\d{2}-\d{2}$/.test(d.start||'')?d.start:'',end:/^\d{4}-\d{2}-\d{2}$/.test(d.end||'')?d.end:'',generation:uuid.test(d.generation||'')?d.generation:null}
 if(kind!=='brief')throw Error('Unsupported device draft')
 return {task:text(d.task,2000),steps:(Array.isArray(d.steps)?d.steps:[]).slice(0,20).filter(s=>uuid.test(s?.id)).map(s=>({id:s.id,task:text(s.task,2000),hazard:text(s.hazard,2000),control:text(s.control,2000)}))}
}
export function applyText(kind,server,local){
 const t=textOnly(kind,local)
 if(kind==='electrical'){const fields={...t};delete fields.operation;return {...server,...fields}}
 if(['concern','action','package'].includes(kind))return {...server,...t}
 return {...server,task:t.task,steps:t.steps.map(s=>{const previous=server.steps.find(x=>x.id===s.id);return {...(previous||{controlState:'proposed',responsible:'',unresolved:true}),...s,...(!previous||previous.control!==s.control||previous.hazard!==s.hazard?{controlState:'proposed'}:{})}})}
}
export const equalText=(kind,a,b)=>JSON.stringify(textOnly(kind,a))===JSON.stringify(textOnly(kind,b))
export function draftKey(s){if(!['concern','brief','electrical','action','package'].includes(s.kind)||![s.actor,s.company,s.id].every(v=>uuid.test(v)))throw Error('Invalid device draft scope');return PREFIX+[s.actor,s.company,s.kind,s.id].join(':')}
export function removeAll(storage){for(const k of Object.keys(storage))if(k.startsWith(PREFIX))storage.removeItem(k)}
export function entries(storage,now=Date.now()){
 const found=[]
 for(const key of Object.keys(storage).filter(k=>k.startsWith(PREFIX))){
  let value
  const raw=storage.getItem(key) // A denied read is not corruption; never delete a copy merely because storage is blocked.
  try{if(size(raw)>MAX_RECORD_BYTES)throw Error();value=JSON.parse(raw);if(value.version!==1||draftKey(value)!==key||!Number.isFinite(value.savedAt)||value.savedAt>now+60000||!uuid.test(value.token)||!Number.isInteger(value.revision)||value.revision<0||JSON.stringify(textOnly(value.kind,value.text))!==JSON.stringify(value.text)||JSON.stringify(textOnly(value.kind,value.baseline))!==JSON.stringify(value.baseline))throw Error()}
  catch{storage.removeItem(key);continue}
  if(now-value.savedAt>=TTL){storage.removeItem(key);continue}
  found.push(value)
 }
 return found
}
export function readDraft(storage,scope,now){return entries(storage,now).find(v=>draftKey(v)===draftKey(scope))||null}
export function writeDraft(storage,scope,data,expectedToken=null,now=Date.now()){
 const key=draftKey(scope),all=entries(storage,now),old=all.find(v=>draftKey(v)===key)
 if((old?.token||null)!==expectedToken)throw Error('Another tab changed this device draft. Keep this page open and review Device drafts before trying again.')
 const value={version:1,actor:scope.actor,company:scope.company,kind:scope.kind,id:scope.id,siteId:uuid.test(scope.siteId)?scope.siteId:null,revision:data.revision||0,baseline:textOnly(scope.kind,data.baseline),text:textOnly(scope.kind,data.text),savedAt:now,token:crypto.randomUUID()}
 const raw=JSON.stringify(value),others=all.filter(v=>draftKey(v)!==key)
 if(size(raw)>MAX_RECORD_BYTES||others.length>=MAX_RECORDS||others.reduce((n,v)=>n+size(JSON.stringify(v)),size(raw))>MAX_BYTES)throw Error('Device draft limit reached (10 drafts, 1 MiB total, 128 KiB each). Remove an old device draft or save to the server. Your visible text remains here.')
 storage.setItem(key,raw)
 if(storage.getItem(key)!==raw)throw Error('Device storage did not confirm the write. Keep this page open.')
 return value
}
