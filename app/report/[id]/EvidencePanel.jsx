'use client'
/* eslint-disable @next/next/no-img-element -- Private images require the caller's cookies and no shared image-optimizer cache. */
import { useCallback,useEffect,useRef,useState } from 'react'

async function api(url,options){
 let response
 try{response=await fetch(url,{cache:'no-store',redirect:'error',...options})}
 catch{throw Error('Could not confirm the request. Check your connection, then retry. Your selected photo and caption stay here; retrying the same upload will not add a duplicate.')}
 if(response.status===401)throw Error(response.headers.has('www-authenticate')?'Staging access needs authentication. Open the staging site in another tab to sign in, then retry here.':'Your account session has expired. Sign in in another tab, then retry here. Keep this draft open to retain your selected photo and caption.')
 let data
 try{data=await response.json()}catch{throw Error('The server returned an unexpected response. Keep this page open and retry, or refresh the evidence list to check whether the photo was saved.')}
 if(!response.ok)throw Error(data.error||'Evidence is unavailable. Keep this page open and retry.')
 return data
}
export default function EvidencePanel({reportId,editable=false,disabled=false}){
 const [rows,setRows]=useState([]),[error,setError]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[file,setFile]=useState(null),[caption,setCaption]=useState(''),[retryId,setRetryId]=useState(null)
 const requestId=useRef(null),input=useRef(null),feedback=useRef(null),base='/api/reports/'+reportId+'/evidence'
 const refresh=useCallback(async()=>setRows(await api(base)),[base])
 useEffect(()=>{let active=true;api(base).then(data=>{if(active)setRows(data)}).catch(e=>{if(active)setError(e.message)});return()=>{active=false}},[base])
 function revealFeedback(){requestAnimationFrame(()=>feedback.current?.scrollIntoView({block:'nearest'}))}
 async function action(run){setBusy(true);setError('');setMessage('Working on photo evidence. Keep this page open.');try{const message=await run();setMessage(message);try{await refresh()}catch{setError('The evidence list could not refresh. Use Refresh evidence to check the saved list.')}}catch(e){setMessage('');setError(e.message)}finally{setBusy(false);revealFeedback()}}
 function upload(){action(async()=>{
  if(!file)throw Error('Choose the original image file to upload. Unsaved files are not retained after closing this page.')
  if(file.size>3*1024*1024)throw Error('This file is '+(file.size/1024/1024).toFixed(2)+' MiB. Choose a JPEG, PNG or WebP copy no larger than 3 MiB. Your caption is still here.')
  setMessage('Uploading photo and checking its contents. Keep this page open until saving is confirmed.')
  requestId.current ||= retryId||crypto.randomUUID()
  await api(base,{method:'POST',headers:{'Content-Type':'application/octet-stream','X-Evidence-Id':requestId.current,'X-Evidence-Caption':encodeURIComponent(caption)},body:file})
  setFile(null);setCaption('');setRetryId(null);requestId.current=null;if(input.current)input.current.value=''
  return 'Photo saved and retained.'
 })}
 return <section className="work-panel no-print" aria-labelledby="photo-evidence-heading"><h2 id="photo-evidence-heading">Photographic evidence</h2>
 <p>JPEG, PNG or WebP; up to 3 MiB and 20 megapixels each. Maximum 10 photos per report. Photos are normalized to JPEG and EXIF is removed. Upload time is server recorded; capture time and location are unverified.</p>
 {!editable&&<div ref={feedback}>{error&&<p role="alert">{error}</p>}{message&&<p role="status">{message}</p>}</div>}
 <button disabled={busy||disabled} onClick={()=>action(async()=> 'Evidence list refreshed.')}>Refresh evidence</button>
 {!rows.some(r=>r.state!=='removed')&&<p>No retained photos listed.</p>}
 <ul className="review-list">{rows.filter(r=>r.state!=='removed').map(row=><li key={row.id}><strong>{row.caption}</strong><p>{row.state==='ready'?'Saved':'Upload incomplete - retry or remove before finalizing'}</p>
 {row.state==='ready'&&<><a href={base+'/'+row.id} target="_blank" rel="noopener noreferrer">View retained photo: {row.caption}</a>{/* Authenticated native image request, never a public/signed Storage URL. */}<img src={base+'/'+row.id} alt={row.caption} width={row.width} height={row.height} style={{maxWidth:'100%',height:'auto',maxHeight:360,objectFit:'contain'}}/></>}
 <p>Uploaded by {row.uploader_label}{row.uploaded_at?' at '+new Date(row.uploaded_at).toLocaleString():'; upload time not yet recorded'}.</p>
 {editable&&<div className="work-buttons">{row.state==='pending'&&<button disabled={busy||disabled} onClick={()=>{setRetryId(row.id);requestId.current=row.id;setCaption(row.caption);setFile(null);if(input.current){input.current.value='';input.current.focus()}setMessage('Select the same original image, then retry uploading.')}}>Retry photo upload</button>}
 <button disabled={busy||disabled} onClick={()=>action(async()=>{const r=await api(base+'/'+row.id,{method:'DELETE'});return r.cleanupPending?'Photo removed from the draft. Private object cleanup is pending reconciliation.':'Photo removed from the draft.'})}>Remove photo</button></div>}</li>)}</ul>
 {editable&&<fieldset disabled={busy||disabled}><legend>{retryId?'Retry incomplete photo':'Add a photo'}</legend><label htmlFor="evidence-file">Photo file</label><input id="evidence-file" ref={input} type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>{setFile(e.target.files?.[0]||null);if(!retryId)requestId.current=null}}/>
 <label htmlFor="evidence-caption">Photo caption</label><textarea id="evidence-caption" maxLength={1000} value={caption} disabled={Boolean(retryId)} onChange={e=>{setCaption(e.target.value);requestId.current=null}}/>
 <button type="button" className="primary" disabled={!file||!caption.trim()} onClick={upload}>{busy?'Uploading...':retryId?'Retry selected photo':'Upload photo'}</button>
 <div ref={feedback} aria-busy={busy} style={{scrollMarginBlock:'1rem'}}>
 {error&&<p role="alert">{error}</p>}{message&&<p role="status">{message}</p>}
 </div>
 {retryId&&<button onClick={()=>{setRetryId(null);requestId.current=null;setCaption('');setFile(null);if(input.current)input.current.value=''}}>Cancel retry selection</button>}
 <button onClick={()=>action(async()=>{const r=await api(base+'/reconcile',{method:'POST'});return r.results.some(x=>x.error)?'Some uploads remain incomplete. Select the original file to retry, or remove them.':'Stored uploads and removed objects reconciled.'})}>Reconcile interrupted uploads</button>
 <p>Keep this page open until saved. After a restart, reconcile uploaded bytes or select the same original file to retry an incomplete upload. Finalization locks all retained photos; amendments start with separate photo evidence.</p></fieldset>}
 </section>
}
