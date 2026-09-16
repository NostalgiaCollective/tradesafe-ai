'use client'
import {useEffect,useState} from 'react'
import {request} from '@/lib/client/request.mjs'
import {useOperation} from '@/lib/client/useOperation'
import OperationFeedback from '@/app/components/OperationFeedback'
export default function ExportPanel({reportId}){
 const [job,setJob]=useState(null),[loadError,setLoadError]=useState(''),[loading,setLoading]=useState(true)
 const operation=useOperation(),base='/api/reports/'+reportId+'/exports'
 useEffect(()=>{let active=true;request(base).then(data=>{if(active)setJob(data)}).catch(e=>{if(active)setLoadError(e.message)}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[base])
 function generate(){void operation.run('Checking the saved export and generating if needed. Keep this page open.',async()=>{
  setLoadError('');const current=await request(base);if(current?.state==='ready'){setJob(current);return 'Retained PDF is ready to download.'}
  const data=await request(base,{method:'POST',timeoutMs:90000});setJob(data);return 'Retained PDF is ready to download.'
 })}
 function download(){void operation.run('Checking and downloading your retained PDF.',async()=>{
  const blob=await request(base+'/'+job.id,{timeoutMs:90000},'blob');if(blob.type!=='application/pdf')throw Error('The download was not a PDF. No file was saved. Retry the download.')
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='tradesafe-'+reportId+'-v1.pdf';a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);return 'PDF sent to your browser. Check its downloads or PDF viewer; this page cannot confirm that you saved the file.'
 })}
 return <section className="work-panel no-print"><h2>Retained PDF export</h2><p>Version 1 contains the finalized observations and retained photos. Later corrective-action history is excluded. Related amendments are listed at the export cutoff. This document does not certify compliance or provide a digital signature.</p>
 {loading&&<p role="status">Checking for a retained PDF...</p>}{loadError&&<p role="alert">{loadError} Use the button below to check again.</p>}{job?.state==='failed'&&<p>Previous generation failed. Retry the same snapshot; missing photos will never be silently omitted.</p>}{job?.state==='generating'&&<p>Generation was started. Retry after two minutes if interrupted.</p>}
 {job?.state==='ready'?<button className="primary" disabled={operation.busy||!operation.ready||loading} onClick={download}>{operation.busy?'Checking and downloading...':'Download retained PDF'}</button>:<button className="primary" disabled={operation.busy||!operation.ready||loading} onClick={generate}>{operation.busy?'Generating PDF...':job?'Retry PDF generation':'Generate retained PDF'}</button>}<OperationFeedback operation={operation}/></section>
}
