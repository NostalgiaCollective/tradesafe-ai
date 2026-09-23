'use client'
import {useRef,useState} from 'react'
import {useOperation} from '@/lib/client/useOperation'
import {useUnsavedWarning} from '@/lib/client/useUnsavedWarning'
import {concernCommand} from '@/lib/client/concern-command'
import EvidencePanel from '@/app/report/[id]/EvidencePanel'
import OperationFeedback from '@/app/components/OperationFeedback'
export default function ConcernForm({initial,site,actor}){
 const [record,setRecord]=useState(initial),[document,setDocument]=useState(initial?.document||{observation:'',location:'',immediate:'',observedAt:''}),[dirty,setDirty]=useState(!initial),[photo,setPhoto]=useState(null),[uncertain,setUncertain]=useState(false),[blocked,setBlocked]=useState(false)
 const op=useOperation(),attempt=useRef(null),target=useRef(initial?.id),isSubmitted=record?.lifecycle==='submitted'
 useUnsavedWarning(dirty||uncertain)
 const change=(key,value)=>{setDocument(d=>({...d,[key]:value}));setDirty(true)}
 function run(command){void op.run(command==='submit'?'Submitting concern.':'Saving concern draft.',async()=>{
  target.current||=crypto.randomUUID();attempt.current||={command,payload:{id:target.current,siteId:site.id,revision:record?.revision,requestId:crypto.randomUUID(),...(command!=='submit'?{document}:{})}}
  try{const value=await concernCommand(attempt.current.command,attempt.current.payload,actor);setRecord(value);setDocument(value.document);setDirty(false);setUncertain(false);attempt.current=null;window.history.replaceState(null,'','/concerns/'+value.id);return value.lifecycle==='submitted'?'Concern submitted. Original observation and photos are retained. No notification was sent.':'Concern draft saved.'}
  catch(e){if(['invalid_request','incomplete','evidence_pending'].includes(e.code)){attempt.current=null;setUncertain(false)}else setUncertain(true);if(['conflict','denied','not_found','immutable','account_changed'].includes(e.code))setBlocked(true);if(e.code==='incomplete')e.message='Enter what you observed and where on the site before submitting.';throw e}
 })}
 const photoBlocked=photo&&(photo.loading||photo.failed||photo.busy||photo.selected||photo.pending>0)
 if(isSubmitted)return <><h1>Concern submitted</h1><p role="status">Saved by the server. No notification was sent.</p><p>{record.document.observation}</p><a className="button primary" href={'/concerns/'+record.id}>View concern and follow-up</a></>
 return <><h1>Report a concern</h1><p>{site.document.name} · {site.document.address}</p><p>Observation capture and follow-up only. Saving here does not contact anyone or authorize work.</p><form onSubmit={e=>{e.preventDefault();run(record?'save':'create')}}><fieldset className="work-fieldset" disabled={!op.ready||op.busy||uncertain||blocked}>
 <label htmlFor="concern-observation">What did you observe?</label><textarea id="concern-observation" maxLength={4000} value={document.observation} onChange={e=>change('observation',e.target.value)}/>
 <label htmlFor="concern-location">Where on this site?</label><input id="concern-location" maxLength={1000} value={document.location} onChange={e=>change('location',e.target.value)}/>
 <details><summary>Immediate steps and observation time (optional)</summary><label htmlFor="concern-immediate">Immediate steps taken</label><textarea id="concern-immediate" maxLength={4000} value={document.immediate} onChange={e=>change('immediate',e.target.value)}/><label htmlFor="concern-time">Observed at (your local time)</label><input id="concern-time" type="datetime-local" defaultValue={document.observedAt?new Date(new Date(document.observedAt).getTime()-new Date(document.observedAt).getTimezoneOffset()*60000).toISOString().slice(0,16):''} onChange={e=>change('observedAt',e.target.value?new Date(e.target.value).toISOString():'')}/><p>This is your entered observation time. The server records submission time separately.</p></details>
 </fieldset><p role="status">{op.busy?'Saving…':uncertain?'Save failed or unconfirmed — entries remain on this page.':dirty?'Unsaved changes':record?'Saved concern draft':'Not saved'}</p><button className={!record||dirty?'primary':''} disabled={!op.ready||op.busy||uncertain||blocked||(!dirty&&Boolean(record))}>Save concern draft</button></form>
 {record?<EvidencePanel concernId={record.id} actor={actor} editable disabled={op.busy||uncertain||blocked} onStateChange={setPhoto}/>:<p>Save the draft to add an optional captioned photo. Unsaved text and file selections are not recovered after closing the page.</p>}
 {record&&<><p>Submitting preserves this observation and its photos. Follow-up starts assigned to you; a supervisor or owner can reassign it. Later corrections are separate notes.</p>{dirty&&<p>Save your changes before submitting.</p>}{photoBlocked&&<p>Upload or clear the selected photo, resolve incomplete uploads, and refresh any failed photo list before submitting.</p>}<button className="primary" disabled={!op.ready||op.busy||uncertain||blocked||dirty||!photo||photoBlocked} onClick={()=>run('submit')}>Submit concern</button></>}
 <OperationFeedback operation={op}/>{uncertain&&!blocked&&<button disabled={op.busy} onClick={()=>run(attempt.current.command)}>Retry same concern operation</button>}{blocked&&<a href={'/concerns/'+target.current} target="_blank" rel="noopener noreferrer">Open latest concern in another tab</a>}{uncertain&&<p>Keep this page open to retain your entries. Retry the same operation; do not create a second concern. <a href={'/auth/login?'+new URLSearchParams({redirect:record?'/concerns/'+record.id:'/concerns/new?site='+site.id})} target="_blank" rel="noopener noreferrer">Sign in in another tab</a> if needed.</p>}
 </>
}
