'use client'
import {useCallback,useContext,useEffect,useRef,useState} from 'react'
import {DemoSessionContext} from '@/app/components/DeviceAccount'
import {useDeviceOperation} from '@/lib/client/useDeviceOperation'
import DeviceOperation from '@/app/components/DeviceOperation'
import {request} from '@/lib/client/request.mjs'
import {useUnsavedWarning} from '@/lib/client/useUnsavedWarning'
import {MAX_IMAGE_BYTES} from '@/lib/evidence/limits.mjs'
const blockedCodes=['conflict','denied','immutable','not_found','account_changed']
export default function ActionCompletion({action,actor,members,editable,disabled,returnTo,onSaved,onRefresh,onDirty,onStatus,onReady,active=false}){
 const demo=useContext(DemoSessionContext)
 const [notes,setNotes]=useState(''),[state,setState]=useState('in_progress'),[photos,setPhotos]=useState([]),[file,setFile]=useState(null),[caption,setCaption]=useState(''),[busy,setBusy]=useState(''),[message,setMessage]=useState(''),[error,setError]=useState(null),[uncertain,setUncertain]=useState(false),[history,setHistory]=useState(null),[historyError,setHistoryError]=useState(''),[historyBusy,setHistoryBusy]=useState(false),[page,setPage]=useState(0),[pendingPhotos,setPendingPhotos]=useState(null),[pendingError,setPendingError]=useState(''),[pendingBusy,setPendingBusy]=useState(false)
 const batch=useRef(null),upload=useRef(null),submission=useRef(null),lock=useRef(false),fileInput=useRef(null),historySequence=useRef(0)
 const historyDetails=useRef(null),pendingDetails=useRef(null),historyStarted=useRef(false),pendingStarted=useRef(false)
 const recoveryValue=()=>({notes,state,caption,photos,batch:batch.current,upload:upload.current?{id:upload.current.id,caption:upload.current.caption}:null,submission:submission.current})
 const device=useDeviceOperation({kind:'action',id:action.id,company:action.company_id,siteId:action.site_id,actor,value:recoveryValue(),revision:batch.current?.revision||action.revision,dirty:Boolean(notes||caption||file||photos.length||submission.current),engaged:active,onRestore:restoreDevice})
 const dirty=Boolean(notes||caption||file||photos.length||uncertain),blocked=blockedCodes.includes(error?.code)
 async function receipt(id){return request('/api/actions/'+action.id+'/completion-updates?updateId='+id,{headers:{'X-Expected-Actor':actor}})}
 function confirmed(value){submission.current=null;batch.current=null;upload.current=null;setUncertain(false);setNotes('');setCaption('');setPhotos([]);setFile(null);onSaved(value.action);setMessage('This completion update was already saved to the server. No duplicate was submitted.');void loadHistory()}
 async function restoreDevice(text,server,local,isCurrent){
  let current=server||action,rows=[]
  if(text.batch){const value=await receipt(text.batch.id);if(!isCurrent())return;current=value.action;if(value.update){confirmed(value);return {resolved:true}}rows=await request('/api/actions/'+action.id+'/evidence?update='+text.batch.id,{headers:{'X-Expected-Actor':actor}});if(!isCurrent())return}
  batch.current=text.batch;submission.current=text.submission;upload.current=text.upload&&!rows.some(p=>p.id===text.upload.id&&p.state==='ready')?{...text.upload,file:null}:null
  setNotes(text.notes);setState(text.state);setCaption(upload.current?.caption||text.caption);setPhotos(rows.filter(p=>p.state==='ready'));setFile(null);onRefresh(current);setUncertain(Boolean(text.submission))
  if(current.revision!==(text.batch?.revision||local.revision)||current.state==='closed'){setError({code:'conflict',message:'The action changed while this device work was unfinished. Your notes remain here; compare the current action before starting a new update.'});setUncertain(false)}else{setError(null);setMessage(upload.current?'Select the original photo again to retry its upload. Its caption and upload identifier were recovered.':'Device work restored for review. Nothing has been submitted. Use the explicit save or retry control when ready.')}
 }
 async function startNew(){
  if(lock.current||!window.confirm('Start a new update from these notes after checking the server? Old unsubmitted uploads remain separate; select photos again.'))return
  lock.current=true;setBusy('check');try{const value=batch.current?await receipt(batch.current.id):await request('/api/actions/'+action.id+'/completion-updates',{headers:{'X-Expected-Actor':actor}});if(value.update){confirmed(value);device.clear();return}if(value.action.state==='closed')throw Error('A supervisor must reopen this action before new completion work can be recorded. Your notes remain here.');onRefresh(value.action);batch.current={id:crypto.randomUUID(),revision:value.action.revision};submission.current=null;upload.current=null;setPhotos([]);setFile(null);setUncertain(false);setError(null);setMessage('New update prepared from your notes. Review them and select any photos before saving. No new update has been submitted.')}catch(e){setError(e)}finally{lock.current=false;setBusy('')}
 }
 useUnsavedWarning(dirty)
 useEffect(()=>{onDirty(dirty||Boolean(busy)||(active&&device.hold));return()=>onDirty(false)},[dirty,busy,onDirty,active,device.hold])
 useEffect(()=>{onReady?.(active&&!device.hold);return()=>onReady?.(false)},[active,device.hold,onReady])
 const holdMessage=active&&(!device.ready||device.checking)?'Checking current access and device work before action changes.':active&&device.recovery?'Review device work under Completion evidence before changing this action.':active&&device.hold?'Check the recovery message under Completion evidence before changing this action.':dirty||busy?'Finish or recover the Completion evidence update below before changing action status.':''
 useEffect(()=>{onStatus?.(holdMessage);return()=>onStatus?.('')},[holdMessage,onStatus])
 const headers=()=>({'X-Expected-Actor':actor}),base='/api/actions/'+action.id
 const ensureBatch=()=>batch.current||=( {id:crypto.randomUUID(),revision:action.revision} )
 const loadHistory=useCallback(async(nextPage=0)=>{
  historyStarted.current=true
  const sequence=++historySequence.current;setHistoryBusy(true);setHistoryError('')
  try{const value=await request(base+'/completion-updates?page='+nextPage);if(sequence===historySequence.current){setHistory(value);setPage(nextPage)}}catch(e){if(sequence===historySequence.current)setHistoryError(e.message)}finally{if(sequence===historySequence.current)setHistoryBusy(false)}
 },[base])
 async function uploadPhoto(){
  if(lock.current||device.hold||disabled||!file||!caption.trim()||blocked||uncertain)return
  lock.current=true;setBusy('upload');setError(null);setMessage('')
  try{
   const b=ensureBatch();upload.current||={id:crypto.randomUUID(),file,caption:caption.trim()}
   const selected=upload.current;device.persist(recoveryValue())
   const value=await request(base+'/evidence',{method:'POST',timeoutMs:60000,headers:{...headers(),'Content-Type':selected.file.type,'X-Evidence-Id':selected.id,'X-Update-Id':b.id,'X-Action-Revision':String(b.revision),'X-Evidence-Caption':encodeURIComponent(selected.caption)},body:selected.file})
   setPhotos(rows=>rows.some(p=>p.id===value.id)?rows:[...rows,value]);upload.current=null;setFile(null);setCaption('');if(fileInput.current)fileInput.current.value='';setMessage('Photo uploaded to the server. Save the completion update below to retain it with your notes.')
  }catch(e){setError(e)}finally{lock.current=false;setBusy('')}
 }
 async function reconcile(){
  if(lock.current||!batch.current)return
  lock.current=true;setBusy('check');setError(null)
  try{const value=await request(base+'/evidence/reconcile',{method:'POST',headers:{...headers(),'X-Update-Id':batch.current.id}});setPhotos(value.results.filter(p=>p.state==='ready'));const recovered=value.results.some(p=>p.id===upload.current?.id&&p.state==='ready');if(recovered){upload.current=null;setFile(null);setCaption('');if(fileInput.current)fileInput.current.value=''}setMessage(value.results.some(p=>p.state==='pending')?'An upload is incomplete. Retry the same selected photo, or remove it before submitting.':'Uploaded photos checked with the server. They are not a saved completion update until you submit below.')
  }catch(e){setError(e)}finally{lock.current=false;setBusy('')}
 }
 const loadPending=useCallback(async()=>{
  pendingStarted.current=true
  setPendingBusy(true);setPendingError('');try{setPendingPhotos(await request(base+'/evidence?pending=1'))}catch(e){setPendingError(e.message)}finally{setPendingBusy(false)}
 },[base])
 // Native details can open before React attaches onToggle. Reconcile that DOM
 // state once handlers mount; otherwise the visible panel stays empty forever.
 useEffect(()=>{if(historyDetails.current?.open&&!historyStarted.current)void loadHistory();if(pendingDetails.current?.open&&!pendingStarted.current)void loadPending()},[loadHistory,loadPending])
 async function removePhoto(id,updateId=batch.current?.id){
  if(lock.current||uncertain)return;lock.current=true;setBusy('remove');setError(null)
  try{await request(base+'/evidence/'+id,{method:'DELETE',headers:{...headers(),'X-Update-Id':updateId}});setPhotos(rows=>rows.filter(p=>p.id!==id));if(upload.current?.id===id){upload.current=null;setFile(null);setCaption('');if(fileInput.current)fileInput.current.value=''}setMessage('Unsubmitted photo removed. Retained completion updates are unchanged.');if(pendingPhotos)void loadPending()}catch(e){setError(e)}finally{lock.current=false;setBusy('')}
 }
 async function submit(e){
  e.preventDefault();if(lock.current||device.hold||disabled||blocked||upload.current||file||!notes.trim())return
  lock.current=true;setBusy('save');setError(null);setMessage('')
  try{
   const b=ensureBatch();submission.current||={id:b.id,revision:b.revision,notes,state,evidenceIds:photos.map(p=>p.id)}
   device.persist(recoveryValue())
   const value=await request(base+'/completion-updates',{method:'POST',headers:{...headers(),'Content-Type':'application/json'},body:JSON.stringify(submission.current)})
   submission.current=null;batch.current=null;device.clear();setUncertain(false);setNotes('');setPhotos([]);setState('in_progress');onSaved(value.action);setMessage(value.update.state==='awaiting_verification'?'Completion update saved to server and awaiting supervisor review. No notification was sent.':'Completion update saved to server. It has not been verified.');void loadHistory()
  }catch(e){setError(e);if(['invalid_request','incomplete','evidence_pending',...blockedCodes].includes(e.code)){submission.current=null;setUncertain(false)}else setUncertain(true)}finally{lock.current=false;setBusy('')}
 }
 const name=id=>members.find(m=>m.user_id===id)?.display_name||'Former or unavailable member'
 return <section aria-labelledby={'completion-title-'+action.id} className="action-evidence">
 <h3 id={'completion-title-'+action.id}>Completion evidence</h3><p>Record subsequent work here. The original finding and photos remain unchanged. Uploading evidence does not verify closure or notify another person.</p>
 {active&&<DeviceOperation device={device} kind="action" company={action.company_id}/>}
 {error?.code==='conflict'&&<button type="button" disabled={Boolean(busy)||device.hold} onClick={startNew}>Start a new update with these notes</button>}
 {editable&&action.state!=='closed'&&<form onSubmit={submit}>
 {disabled&&<p role="status">Save or resolve the action edits above before adding a completion update.</p>}
 <fieldset disabled={device.hold||disabled||Boolean(busy)||uncertain||blocked} className="work-fieldset">
 <label htmlFor={'completion-notes-'+action.id}>Completion update notes</label><textarea id={'completion-notes-'+action.id} maxLength={4000} required value={notes} onChange={e=>{setNotes(e.target.value);setMessage('')}}/>
 <label htmlFor={'completion-state-'+action.id}>After recording this update</label><select id={'completion-state-'+action.id} value={state} onChange={e=>setState(e.target.value)}><option value="in_progress">Keep in progress</option><option value="awaiting_verification">Request supervisor verification</option></select>
 <label htmlFor={'completion-photo-'+action.id}>Completion photo (optional)</label><input ref={fileInput} id={'completion-photo-'+action.id} type="file" accept="image/jpeg,image/png,image/webp" disabled={Boolean(upload.current?.file)||photos.length>=10} onChange={e=>{const selected=e.target.files?.[0]||null;setError(null);setMessage('');if(selected&&selected.size>MAX_IMAGE_BYTES){setError({code:'image_invalid',message:'Choose a JPEG, PNG or WebP up to 5 MiB. Your notes remain here.'});e.target.value='';return}setFile(selected);if(upload.current)upload.current.file=selected}}/>
 <p>Up to 10 photos per update, 5 MiB and 20 megapixels each. Photos are normalized and metadata removed. Photo file selections remain only while this page stays open. Opt in above to recover notes, captions and retry identifiers after reopening.</p>
 {file&&<p>Selected: {file.name}</p>}{upload.current&&!file&&<p role="status">Select the original photo again. The caption and upload identifier were recovered; image bytes were not stored on this device.</p>}
 <label htmlFor={'completion-caption-'+action.id}>Completion photo caption</label><input id={'completion-caption-'+action.id} maxLength={1000} value={caption} disabled={Boolean(upload.current)} onChange={e=>setCaption(e.target.value)}/>
 <button type="button" disabled={!file||!caption.trim()||photos.length>=10} onClick={uploadPhoto}>{upload.current?'Retry photo upload':'Upload completion photo'}</button>
 </fieldset>
 {batch.current&&!busy&&!uncertain&&<button type="button" onClick={reconcile}>Check uploaded photos</button>}
 {photos.length>0&&<ul>{photos.map(p=><li key={p.id}><a href={base+'/evidence/'+p.id} target="_blank" rel="noopener noreferrer">{p.caption}</a>  -  uploaded, not yet submitted <button type="button" disabled={Boolean(busy)||uncertain} onClick={()=>removePhoto(p.id)}>Remove unsubmitted photo</button></li>)}</ul>}
 {upload.current&&<button type="button" disabled={Boolean(busy)||uncertain} onClick={()=>removePhoto(upload.current.id)}>Remove incomplete upload</button>}
 <button className="primary" disabled={device.hold||disabled||Boolean(busy)||blocked||Boolean(file)||Boolean(upload.current)||!notes.trim()}>{busy==='save'?'Saving completion update - ':uncertain?'Retry the same completion update':state==='awaiting_verification'?'Submit completion for verification':'Save completion update'}</button>
 {dirty&&!busy&&!uncertain&&<p role="status">Completion update not yet saved. Uploaded photos are pending submission.</p>}
 {uncertain&&<p role="status">The server result is not confirmed. Keep this page open and retry the same update; it will not create a duplicate.</p>}
 </form>}
 {busy&&<p role="status">{busy==='upload'?'Uploading completion photo - ':busy==='save'?'Saving completion update - ':'Checking with the server - '}</p>}
 {message&&<p role="status">{message}</p>}{error&&<div role="alert"><p>{error.code==='evidence_pending'?'A completion photo is still incomplete. Retry or remove that upload before saving this update.':error.code==='evidence_missing'?'A completion photo is missing or failed its integrity check. Your notes remain here. Retry the photo or ask your supervisor to review the evidence.':error.code==='evidence_limit'?'This update has reached 10 photos or the action has reached its retained-photo limit. Remove an unsubmitted photo, or ask your supervisor to review the record.':error.code==='immutable'?'The action or completion record is no longer editable. Your current notes remain here.':error.message}</p>{blocked?<><p>Your current notes remain here. Compare the latest action before reconciling your changes. A stale update cannot overwrite it.</p><a href={returnTo} target="_blank" rel="noopener noreferrer">Open latest saved action</a></>:['unauthorized','account_changed'].includes(error.code)&&<a href={demo?'/demo':'/auth/login?'+new URLSearchParams({redirect:returnTo})} target="_blank" rel="noopener noreferrer">Sign in in another tab</a>}</div>}
 <details ref={pendingDetails} onToggle={e=>{if(e.currentTarget.open&&!pendingStarted.current)void loadPending()}}><summary>Unsubmitted uploads</summary><p>These photos are not part of a retained completion update. Do not remove an upload another visitor is still using. Removal is permanent; it does not change submitted evidence.</p>{pendingBusy&&<p role="status">Loading unsubmitted uploads...</p>}{pendingError&&<div role="alert"><p>{pendingError}</p><button type="button" onClick={loadPending}>Retry unsubmitted uploads</button></div>}{pendingPhotos&&!pendingBusy&&!pendingError&&(pendingPhotos.length?<ul>{pendingPhotos.map(p=><li key={p.id}><p>{p.caption} - {p.state==='ready'?'Uploaded, not submitted':'Incomplete upload'} - {p.uploader_label||name(p.uploader_id)} - {new Date(p.reserved_at).toLocaleString('en-CA')}</p><button type="button" disabled={Boolean(busy)||uncertain} onClick={()=>{if(window.confirm('Remove this unsubmitted photo? It cannot be restored.'))void removePhoto(p.id,p.update_id)}}>Remove unsubmitted upload</button></li>)}</ul>:<p>No unsubmitted uploads.</p>)}</details>
 <details ref={historyDetails} onToggle={e=>{if(e.currentTarget.open&&!historyStarted.current)void loadHistory()}}><summary>Recorded completion updates</summary>
 {historyBusy&&<p role="status">Loading completion updates - </p>}{historyError&&<div role="alert"><p>{historyError}</p><button type="button" onClick={()=>loadHistory(page)}>Retry completion history</button></div>}
 {history&&!historyBusy&&!historyError&&<>{history.updates.length?<ol>{history.updates.map(u=><li key={u.id}><strong>{u.state==='awaiting_verification'?'Submitted for supervisor review':'Progress recorded'}</strong><p>{u.actor_label||name(u.actor_id)}  -  {new Date(u.recorded_at).toLocaleString('en-CA')}  -  action revision {u.submitted_revision}</p><p>{u.notes}</p>{u.evidence_snapshot.length>0&&<ul>{u.evidence_snapshot.map(p=><li key={p.id}><a href={base+'/evidence/'+p.id} target="_blank" rel="noopener noreferrer">Completion photo: {p.caption}</a></li>)}</ul>}<p>This records the update at submission. Current verification and reopening decisions are in Action history.</p></li>)}</ol>:<p>No retained completion updates recorded.</p>}<nav aria-label="Completion history pages">{page>0&&<button type="button" onClick={()=>loadHistory(page-1)}>Newer completion updates</button>}{history.hasMore&&<button type="button" onClick={()=>loadHistory(page+1)}>Older completion updates</button>}</nav></>}
 </details></section>
}
