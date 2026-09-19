'use client'
/* eslint-disable @next/next/no-img-element -- Private images require the caller's cookies and no shared image-optimizer cache. */
import { useCallback,useEffect,useRef,useState,useSyncExternalStore } from 'react'
import {useUnsavedWarning} from '@/lib/client/useUnsavedWarning'
import { ERROR_MESSAGES } from '@/lib/domain/errors'
import { MAX_IMAGE_BYTES } from '@/lib/evidence/limits.mjs'
const subscribe=()=>()=>{}, clientReady=()=>true, serverReady=()=>false

async function api(url,options,trace=()=>{}){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),90000)
 try{
 let response
 try{response=await fetch(url,{cache:'no-store',redirect:'error',...options,signal:controller.signal})}
 catch{throw Error('Could not confirm the request. Check your connection, then retry. Your selected photo and caption stay here; retrying the same upload will not add a duplicate.')}
 trace('response HTTP '+response.status)
 if(response.status===401)throw Error(response.headers.has('www-authenticate')?'Staging access needs authentication. Open the staging site in another tab to sign in, then retry here.':'Your account session has expired. Sign in in another tab, then retry here. Keep this draft open to retain your selected photo and caption.')
 let data
 try{data=await response.json()}catch{throw Error('The server returned an unexpected response. Keep this page open and retry, or refresh the evidence list to check whether the photo was saved.')}
 trace('response decoded')
 if(!response.ok)throw Error(Object.hasOwn(ERROR_MESSAGES,data?.code)?ERROR_MESSAGES[data.code]:'The photo request could not be confirmed. Keep this page open and retry.')
 return data
 }finally{clearTimeout(timer)}
}
export default function EvidencePanel({reportId,actor,editable=false,disabled=false,stagingBuild=null,onStateChange}){
 const ready=useSyncExternalStore(subscribe,clientReady,serverReady)
 const [stages,setStages]=useState([]),[clientErrors,setClientErrors]=useState(0),[servedBuild,setServedBuild]=useState('not checked')
 const trace=stage=>{if(stagingBuild)setStages(previous=>[...previous.slice(-7),stage])}
 const [rows,setRows]=useState([]),[error,setError]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[file,setFile]=useState(null),[caption,setCaption]=useState(''),[retryId,setRetryId]=useState(null)
 const [loading,setLoading]=useState(true),[listFailed,setListFailed]=useState(false),[attempted,setAttempted]=useState(false)
 useUnsavedWarning(Boolean(file||caption.trim()||attempted||busy))
 const actionLock=useRef(false)
 const requestId=useRef(null),input=useRef(null),captionInput=useRef(null),feedback=useRef(null),base='/api/reports/'+reportId+'/evidence'
 useEffect(()=>{
  if(!stagingBuild)return
  let active=true
  const failed=()=>setClientErrors(count=>count+1)
  window.addEventListener('error',failed);window.addEventListener('unhandledrejection',failed)
  fetch('/api/staging/identity',{cache:'no-store',redirect:'error'}).then(r=>r.ok?r.json():null).then(data=>{if(active)setServedBuild(/^[a-f0-9]{40}$/.test(data?.commit||'')?data.commit.slice(0,7):'unavailable')}).catch(()=>{if(active)setServedBuild('unavailable')})
  return()=>{active=false;window.removeEventListener('error',failed);window.removeEventListener('unhandledrejection',failed)}
 },[stagingBuild])
 const refresh=useCallback(async()=>{try{setRows(await api(base));setListFailed(false)}catch(e){setListFailed(true);throw e}},[base])
 useEffect(()=>{let active=true;api(base).then(data=>{if(active)setRows(data)}).catch(e=>{if(active){setError(e.message);setListFailed(true)}}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[base])
 useEffect(()=>{onStateChange?.({loading,failed:listFailed,busy,selected:Boolean(file||caption.trim()),ready:rows.filter(r=>r.state==='ready').length,pending:rows.filter(r=>r.state==='pending').length})},[loading,listFailed,busy,file,caption,rows,onStateChange])
 function revealFeedback(){requestAnimationFrame(()=>feedback.current?.scrollIntoView({block:'nearest'}))}
 async function action(run){if(actionLock.current||!ready)return;actionLock.current=true;setBusy(true);setError('');setMessage('Working on photo evidence. Keep this page open.');try{const message=await run();setMessage(message);try{await refresh()}catch{if(message==='Photo list refreshed.')setMessage('');setError('The evidence list could not refresh. Use Refresh photos to check the saved list.')}}catch(e){setMessage('');setError(e.message)}finally{actionLock.current=false;setBusy(false);revealFeedback()}}
 function upload(){trace('click handler');action(async()=>{
  const selected=input.current?.files?.[0]||file,description=captionInput.current?.value??caption
  trace('validating')
  if(!selected)throw Error('Choose the original image file to upload. Unsaved files are not retained after closing this page.')
  if(!description.trim())throw Error('Enter a photo caption, then tap Upload photo. Your selected file is still here.')
  if(selected.size>MAX_IMAGE_BYTES)throw Error('This file is '+selected.size.toLocaleString('en-CA')+' bytes. Choose a JPEG, PNG or WebP copy no larger than 5 MiB (5,242,880 bytes). Your caption is still here.')
  setMessage('Uploading photo and checking its contents. Keep this page open until saving is confirmed.')
  requestId.current ||= retryId||crypto.randomUUID()
  setAttempted(true)
  trace('request started')
  await api(base,{method:'POST',headers:{'Content-Type':'application/octet-stream','X-Expected-Actor':actor,'X-Evidence-Id':requestId.current,'X-Evidence-Caption':encodeURIComponent(description)},body:selected},trace)
  trace('save acknowledged')
  setAttempted(false);setFile(null);setCaption('');setRetryId(null);requestId.current=null;if(input.current)input.current.value=''
  return 'Photo saved and retained.'
 })}
 function clearSelection(){if(attempted&&!confirm('The previous upload may already be saved. Check the photo list before selecting another file. Clear this selection?'))return;setAttempted(false);setRetryId(null);requestId.current=null;setFile(null);setCaption('');setError('');setMessage('Selection cleared. Saved photos have not been removed.');if(input.current)input.current.value=''}
 return <section id="photo-evidence" className="work-panel no-print" aria-labelledby="photo-evidence-heading"><h2 id="photo-evidence-heading">Photos</h2>
 <p>Add photos that help explain your observations. JPEG, PNG or WebP; up to 5 MiB and 20 megapixels each. Maximum 10 photos.</p>
 {editable&&<><fieldset className="work-fieldset" disabled={busy||disabled||!ready}><legend>{retryId?'Retry an incomplete photo':'Add a photo (optional)'}</legend>
 <label htmlFor="evidence-file">Photo file</label><input id="evidence-file" ref={input} type="file" accept="image/jpeg,image/png,image/webp" disabled={attempted} onChange={e=>{setFile(e.target.files?.[0]||null);setError('');setMessage('');trace('file selected');if(!retryId)requestId.current=null}}/>
 {file&&<p className="selected-photo" role="status">Selected: <strong>{file.name}</strong> · {(file.size/1024/1024).toFixed(2)} MiB</p>}
 <label htmlFor="evidence-caption">Photo caption</label><textarea id="evidence-caption" ref={captionInput} maxLength={1000} value={caption} disabled={Boolean(retryId)||attempted} placeholder="What does this photo show?" aria-describedby="caption-help" onChange={e=>{setCaption(e.target.value);requestId.current=null;trace('caption edited')}}/><p id="caption-help">Required when you add a photo. The caption is saved with the image.</p>
 <div className="work-buttons"><button type="button" className={file||caption.trim()?'primary':''} onPointerDown={()=>trace('pointer received')} onClick={upload}>{!ready?'Preparing photo controls...':busy?'Uploading…':attempted||retryId?'Retry selected photo':'Upload photo'}</button>{(file||caption||retryId)&&<button type="button" onClick={clearSelection}>Clear selection</button>}</div>
 {!ready&&<p>Photo controls are loading. If this persists, reload this saved draft when your connection is available.</p>}
 {attempted&&!busy&&<p>Retry this same file and caption to check whether it was saved. They stay selected until confirmed.</p>}
 </fieldset></>}
 <div ref={feedback} aria-busy={busy} className="photo-feedback">{error&&<p role="alert">{error}</p>}{message&&<p role="status">{message}</p>}</div>
 <h3>Saved photos ({rows.filter(r=>r.state==='ready').length}/10)</h3>
 {loading?<p role="status">Loading saved photos…</p>:!rows.some(r=>r.state!=='removed')&&<p>No photos saved yet. You can continue without photos.</p>}
 <ul className="review-list photo-list">{rows.filter(r=>r.state!=='removed').map(row=><li key={row.id}><strong>{row.caption}</strong><p>{row.state==='ready'?'Saved':'Upload incomplete — retry or remove before finalizing'}</p>
 {row.state==='ready'&&<a className="photo-preview" href={base+'/'+row.id} target="_blank" rel="noopener noreferrer"><img src={base+'/'+row.id} alt={row.caption} width={row.width} height={row.height}/><span>Open full photo</span></a>}
 <details><summary>Photo details</summary><p>Uploaded by {row.uploader_label}{row.uploaded_at?' at '+new Date(row.uploaded_at).toLocaleString():'. Upload time not yet recorded.'}</p></details>
 {editable&&<div className="work-buttons">{row.state==='pending'&&<button type="button" disabled={busy||disabled} onClick={()=>{setAttempted(false);setRetryId(row.id);requestId.current=row.id;setCaption(row.caption);setFile(null);if(input.current){input.current.value='';input.current.focus()}setMessage('Select the same original image, then retry uploading.')}}>Retry photo upload</button>}
 <button type="button" disabled={busy||disabled} onClick={()=>{if(confirm('Remove this photo from the draft?'))void action(async()=>{await api(base+'/'+row.id,{method:'DELETE',headers:{'X-Expected-Actor':actor}});return 'Photo removed from the draft.'})}}>Remove photo</button></div>}</li>)}</ul>
 <button type="button" disabled={busy||disabled||!ready} onClick={()=>action(async()=> 'Photo list refreshed.')}>Refresh photos</button>
 <details><summary>Photo upload troubleshooting</summary><p>Keep this page open until Saved. If an upload was interrupted, check saved uploads before retrying. Do not close this page if a selected file has not been saved.</p>
 {editable&&<button type="button" disabled={busy||disabled||!ready} onClick={()=>action(async()=>{const r=await api(base+'/reconcile',{method:'POST',headers:{'X-Expected-Actor':actor}});return r.results.some(x=>x.error)?'Some uploads remain incomplete. Select the original file to retry, or remove them.':'Saved uploads checked. The photo list is up to date.'})}>Check interrupted uploads</button>}
 <p>Photos are normalized to JPEG within a 3 MiB stored-file limit and EXIF metadata is removed. Upload time is recorded by the server; capture time and location are unverified. Finalizing locks photos; amendments use separate photos.</p>
 {stagingBuild&&<div data-testid="upload-diagnostics" className="photo-diagnostics"><strong>Staging upload diagnostics</strong><p>Page build: {stagingBuild.slice(0,7)} · Server now: {servedBuild} · Client: {ready?'ready / photo-trace-1':'waiting'}</p><p>Controls: {!ready?'loading':busy?'busy':disabled?'report locked':'enabled'} · File: {file?'selected':'none'} · Caption: {caption.trim()?'present':'empty'} · Client errors: {clientErrors}</p><p>Last stages: {stages.length?stages.join(' → '):'no interaction yet'}</p><p>Feedback: {error?'error rendered':message?'status rendered':'none'}</p></div>}
 </details>
 </section>
}
