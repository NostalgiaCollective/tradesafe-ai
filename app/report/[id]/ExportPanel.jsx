'use client'
import { useEffect,useState } from 'react'
export default function ExportPanel({reportId}){
 const [job,setJob]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState('')
 const base='/api/reports/'+reportId+'/exports'
 useEffect(()=>{let active=true;fetch(base,{cache:'no-store'}).then(async r=>{const data=await r.json();if(!r.ok)throw Error(data.error);if(active)setJob(data)}).catch(e=>{if(active)setError(e.message)});return()=>{active=false}},[base])
 async function generate(){setBusy(true);setError('');try{const r=await fetch(base,{method:'POST'}),data=await r.json();if(!r.ok)throw Error(data.error);setJob(data)}catch(e){setError(e.message||'PDF generation failed. Retry.')}finally{setBusy(false)}}
 async function download(){setBusy(true);setError('');try{const r=await fetch(base+'/'+job.id,{cache:'no-store'});if(!r.ok){const data=await r.json();throw Error(data.error)}const blob=await r.blob(),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='tradesafe-'+reportId+'-v1.pdf';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}catch(e){setError(e.message||'PDF download failed. Retry.')}finally{setBusy(false)}}
 return <section className="work-panel no-print"><h2>Retained PDF export</h2><p>Version 1 contains the finalized observations and retained photos. Later corrective-action history is excluded. Related amendments are listed at the export cutoff. This document does not certify compliance or provide a digital signature.</p>
 {error&&<p role="alert">{error}</p>}{job?.state==='failed'&&<p>Previous generation failed. Retry to generate the same snapshot; missing photos will never be silently omitted.</p>}{job?.state==='generating'&&<p>Generation was started. Retry after two minutes if interrupted.</p>}
 {job?.state==='ready'?<button className="primary" disabled={busy} onClick={download}>{busy?'Checking and downloading...':'Download retained PDF'}</button>:<button className="primary" disabled={busy} onClick={generate}>{busy?'Generating PDF...':job?'Retry PDF generation':'Generate retained PDF'}</button>}
 </section>
}
