'use client'
import {useRef,useState} from 'react'
import {request,RequestError} from '@/lib/client/request.mjs'
import {useOperation} from '@/lib/client/useOperation'
import {applyText} from '@/lib/client/device-store.mjs'
import {emptyElectricalJob} from '@/lib/domain/electrical-job.mjs'

// One serialized operation owns the displayed baseline. Failed/ambiguous requests
// keep their original id and payload until an authoritative response resolves them.
export function useElectricalRecord(site,job,actor){
 const [saved,setSaved]=useState(job),[d,setD]=useState(job?.document||emptyElectricalJob())
 const [note,setNote]=useState(''),[source,setSource]=useState(''),[conflict,setConflict]=useState(false),[latest,setLatest]=useState(null),[recoveredSaved,setRecoveredSaved]=useState(false)
 const operation=useOperation(),attempt=useRef(null),url='/api/sites/'+site.id+'/electrical'
 const headers={'Content-Type':'application/json','X-Expected-Actor':actor}
 const dirty=JSON.stringify(d)!==JSON.stringify(saved?.document||emptyElectricalJob())
 const current=()=>request(url+'?view=current',{headers})
 async function mutate(command,onAttempt){await operation.run('Saving electrical job record.',async()=>{
  attempt.current||={command,payload:{siteId:site.id,companyId:site.company_id,revision:saved?.revision||0,requestId:crypto.randomUUID(),...(command==='save'?{document:d}:{note,source})}}
  onAttempt?.(attempt.current)
  try{
   const result=await request(url,{method:'POST',headers,body:JSON.stringify(attempt.current)})
   // Idempotent replay deliberately returns its original result. It is not proof
   // that the result is still the latest revision after another editor saved.
   const authoritative=(await current()).job
   if(!authoritative||authoritative.revision!==result.revision){setLatest(authoritative);setConflict(true);throw new RequestError('A newer revision exists. Compare the server entries below before saving again.','conflict')}
   setSaved(authoritative);setD(authoritative.document)
   if(attempt.current.command!=='save'){setNote('');setSource('')}
   attempt.current=null;return 'Saved to server. Revision '+authoritative.revision+'.'
  }catch(e){if(e.code==='conflict')setConflict(true);if(e.code==='invalid_request')attempt.current=null;throw e}
 })}
 async function compare(){await operation.run('Checking the latest saved revision.',async()=>{setLatest((await current()).job);return 'Latest server entries loaded for comparison. Nothing has been submitted.'})}
 function resolve(useServer){
  if(!latest||operation.busy)return
  if(useServer&&!window.confirm('Replace the entries on this page with the server entries? Your unsubmitted text will be removed.'))return
  setSaved(latest);if(useServer){setD(latest.document);setNote('');setSource('')}
  attempt.current=null;setConflict(false);setLatest(null)
  void operation.run('',async()=>useServer?'Server entries loaded.':'Your entries are ready for review. Nothing was merged or submitted. Review the fields, then Save electrical job.')
 }
 async function restoreDevice(current,text,isCurrent){
  const pending=text.operation
  if(pending&&(pending.payload.siteId!==site.id||pending.payload.companyId!==site.company_id))throw Error('Stored request belongs to a different site or company. Nothing was replayed.')
  const checked=pending?await request(url+'?view=current&requestId='+pending.payload.requestId,{headers}):null
  if(!isCurrent())return
  if(checked)current=checked.job
  if(checked?.receipt&&current?.revision===checked.receipt.revision&&pending.command==='save'&&Object.keys(pending.payload.document).every(k=>current.document[k]===pending.payload.document[k])&&!text.reviewNote&&!text.reviewSource){setSaved(current);setD(current.document);attempt.current=null;setConflict(false);setLatest(null);setRecoveredSaved(true);void operation.run('',async()=> 'The saved request was confirmed on the server. No duplicate revision was created.');return {resolved:true}}

  const next=applyText('electrical',current?.document||emptyElectricalJob(),text),{reviewNote,reviewSource,...document}=next
  setSaved(current);setD(document);setNote(reviewNote||'');setSource(reviewSource||'');attempt.current=null;setConflict(false);setLatest(null)
  if(pending?.command==='save'&&!checked.receipt){
   if((current?.revision||0)===pending.payload.revision){attempt.current=pending;void operation.run('',async()=> 'The earlier save is not recorded. Retry same operation explicitly to send its original entries and selected statuses. Nothing was replayed.')}else{setLatest(current);setConflict(true)}
  }else if(pending){void operation.run('',async()=>checked.receipt?'The prior request was recorded. Current server decisions are shown; device text remains for your review.':'No prior decision was found. Review notes were restored, but no review or credential-check command was replayed.')}

 }
 return {restoreDevice,recoveredSaved,saved,d,setD,note,setNote,source,setSource,conflict,latest,operation,attempt,dirty,url,headers,mutate,compare,resolve}
}
