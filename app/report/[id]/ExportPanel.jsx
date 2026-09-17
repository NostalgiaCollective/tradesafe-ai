'use client'
import {useEffect,useState} from 'react'
import {request} from '@/lib/client/request.mjs'
import {useOperation} from '@/lib/client/useOperation'
import OperationFeedback from '@/app/components/OperationFeedback'
export default function ExportPanel({reportId}){
 const [job,setJob]=useState(null),[loadError,setLoadError]=useState(''),[loading,setLoading]=useState(true),[preview,setPreview]=useState('')
 const operation=useOperation(),base='/api/reports/'+reportId+'/exports'
 useEffect(()=>{let active=true;request(base).then(data=>{if(active)setJob(data)}).catch(e=>{if(active)setLoadError(e.message)}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[base])
 useEffect(()=>()=>{if(preview)URL.revokeObjectURL(preview)},[preview])
 async function readyJob(){setLoadError('');const current=await request(base);const result=current?.state==='ready'?current:await request(base,{method:'POST',timeoutMs:90000});setJob(result);return result}
 async function pdf(result){const blob=await request(base+'/'+result.id,{timeoutMs:90000},'blob');if(blob.type!=='application/pdf')throw Error('The PDF could not be opened. Retry; no replacement report was created.');return blob}
 function open(){void operation.run('Preparing and checking your PDF. Keep this page open.',async()=>{
  // Open during the user gesture, before asynchronous generation, for mobile browsers.
  const viewer=window.open('about:blank','_blank');if(viewer){viewer.opener=null;viewer.document.title='Opening report PDF';viewer.document.body.textContent='Preparing your report PDF… You can return to the report tab while it loads.'}
  try{const result=await readyJob(),blob=await pdf(result),url=URL.createObjectURL(blob);setPreview(url)
   if(viewer&&!viewer.closed){viewer.location.replace(url);return 'PDF sent to a new tab. Use Download PDF if your browser cannot display it.'}
   return 'Your PDF is ready. Use Open prepared PDF below; your browser did not keep the new tab open.'
  }catch(e){viewer?.close();throw e}
 })}
 function download(){void operation.run('Checking and downloading your PDF.',async()=>{
  const result=await readyJob(),blob=await pdf(result),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='tradesafe-'+reportId+'-v1.pdf';a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);return 'PDF sent to your browser. Check its downloads or PDF viewer; this page cannot confirm that you saved the file.'
 })}
 return <section id="report-pdf" className="work-panel no-print"><h2>Your finalized report</h2><p>The original observations and photos are locked. Open your PDF, or create a separate amendment to make a correction.</p>
 {loading&&<p role="status">Checking for a saved PDF…</p>}{loadError&&<p role="alert">{loadError} Use Open PDF to try again.</p>}{job?.state==='failed'&&<p>PDF preparation was interrupted. Open PDF retries the same report; no photos will be left out.</p>}{job?.state==='generating'&&<p>Your PDF is being prepared. If interrupted, wait two minutes and use Open PDF again.</p>}
 <div className="work-buttons"><button type="button" className="primary" disabled={operation.busy||!operation.ready||loading} onClick={open}>{operation.busy?'Preparing PDF…':'Open PDF'}</button>{job?.state==='ready'&&<button type="button" disabled={operation.busy||!operation.ready||loading} onClick={download}>Download PDF</button>}<a href="#amend-report">Make a correction</a></div><OperationFeedback operation={operation}/>{preview&&<a href={preview} target="_blank" rel="noopener noreferrer">Open prepared PDF</a>}
 <details><summary>What is in the PDF?</summary><p>Version 1 contains finalized observations and photos. Later corrective-action history is excluded. Amendments linked at the export cutoff are listed. This document does not certify compliance or provide a digital signature.</p></details></section>
}
