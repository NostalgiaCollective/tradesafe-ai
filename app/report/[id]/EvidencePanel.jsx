'use client'
/* eslint-disable @next/next/no-img-element -- Private images require the caller's cookies and no shared image-optimizer cache. */
import { useCallback,useEffect,useRef,useState } from 'react'

async function api(url,options){const response=await fetch(url,{cache:'no-store',...options});const data=await response.json();if(!response.ok)throw Error(data.error||'Evidence is unavailable. Retry.');return data}
export default function EvidencePanel({reportId,editable=false,disabled=false}){
 const [rows,setRows]=useState([]),[error,setError]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[file,setFile]=useState(null),[caption,setCaption]=useState(''),[retryId,setRetryId]=useState(null)
 const requestId=useRef(null),input=useRef(null),base='/api/reports/'+reportId+'/evidence'
 const refresh=useCallback(async()=>setRows(await api(base)),[base])
 useEffect(()=>{let active=true;api(base).then(data=>{if(active)setRows(data)}).catch(e=>{if(active)setError(e.message)});return()=>{active=false}},[base])
 async function action(run){setBusy(true);setError('');setMessage('');try{const message=await run();await refresh();setMessage(message)}catch(e){setError(e.message)}finally{setBusy(false)}}
 function upload(){action(async()=>{
  if(!file)throw Error('Choose the original image file to upload. Unsaved files are not retained after closing this page.')
  if(file.size>3*1024*1024)throw Error('The image must be no larger than 3 MiB.')
  requestId.current ||= retryId||crypto.randomUUID()
  await api(base,{method:'POST',headers:{'Content-Type':'application/octet-stream','X-Evidence-Id':requestId.current,'X-Evidence-Caption':encodeURIComponent(caption)},body:file})
  setFile(null);setCaption('');setRetryId(null);requestId.current=null;if(input.current)input.current.value=''
  return 'Photo saved and retained.'
 })}
 return <section className="work-panel no-print" aria-labelledby="photo-evidence-heading"><h2 id="photo-evidence-heading">Photographic evidence</h2>
 <p>JPEG, PNG or WebP; up to 3 MiB and 20 megapixels each. Maximum 10 photos per report. Photos are normalized to JPEG and EXIF is removed. Upload time is server recorded; capture time and location are unverified.</p>
 {error&&<p role="alert">{error}</p>}{message&&<p role="status">{message}</p>}
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
 {retryId&&<button onClick={()=>{setRetryId(null);requestId.current=null;setCaption('');setFile(null);if(input.current)input.current.value=''}}>Cancel retry selection</button>}
 <button onClick={()=>action(async()=>{const r=await api(base+'/reconcile',{method:'POST'});return r.results.some(x=>x.error)?'Some uploads remain incomplete. Select the original file to retry, or remove them.':'Stored uploads and removed objects reconciled.'})}>Reconcile interrupted uploads</button>
 <p>Keep this page open until saved. After a restart, reconcile uploaded bytes or select the same original file to retry an incomplete upload. Finalization locks all retained photos; amendments start with separate photo evidence.</p></fieldset>}
 </section>
}
