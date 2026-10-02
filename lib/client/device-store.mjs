export const PREFIX='tradesafe.device-text.v1:'
export const TTL=7*24*60*60*1000, MAX_RECORDS=10, MAX_BYTES=1024*1024, MAX_RECORD_BYTES=128*1024
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const size=s=>new TextEncoder().encode(s).length
export function textOnly(kind,d={}){
 const text=(s,n)=>typeof s==='string'?s.slice(0,n):''
 if(kind==='concern')return {observation:text(d.observation,4000),location:text(d.location,1000),immediate:text(d.immediate,4000)}
 if(kind!=='brief')throw Error('Unsupported device draft')
 return {task:text(d.task,2000),steps:(Array.isArray(d.steps)?d.steps:[]).slice(0,20).filter(s=>uuid.test(s?.id)).map(s=>({id:s.id,task:text(s.task,2000),hazard:text(s.hazard,2000),control:text(s.control,2000)}))}
}
export function applyText(kind,server,local){
 const t=textOnly(kind,local)
 if(kind==='concern')return {...server,...t}
 return {...server,task:t.task,steps:t.steps.map(s=>{const previous=server.steps.find(x=>x.id===s.id);return {...(previous||{controlState:'proposed',responsible:'',unresolved:true}),...s,...(!previous||previous.control!==s.control||previous.hazard!==s.hazard?{controlState:'proposed'}:{})}})}
}
export const equalText=(kind,a,b)=>JSON.stringify(textOnly(kind,a))===JSON.stringify(textOnly(kind,b))
export function draftKey(s){if(!['concern','brief'].includes(s.kind)||![s.actor,s.company,s.id].every(v=>uuid.test(v)))throw Error('Invalid device draft scope');return PREFIX+[s.actor,s.company,s.kind,s.id].join(':')}
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
