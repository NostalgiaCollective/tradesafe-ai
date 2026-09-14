'use client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { command } from '@/lib/client/commands'
export default function ReportTools({report,canAmend}) {
 const router=useRouter()
 const [reason,setReason]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[id,setId]=useState('')
 async function amend(e){e.preventDefault();setBusy(true);const key=id||crypto.randomUUID();setId(key)
 try{const r=await command('amend',{id:key,companyId:report.company_id,amendmentOf:report.id,reason});router.push('/report/'+r.id)}catch(e){setError(e.message);setBusy(false)}}
 return <div className="no-print work-panel"><button onClick={()=>window.print()}>Print text review (no photos)</button><p>Browser printing includes the text review and current follow-up status, without retained photos. Use the retained PDF export for the finalized snapshot with photographs. Payments and paid access are unavailable.</p>
 {canAmend&&<form onSubmit={amend}><h2>Correct an observation</h2><p>The original remains unchanged. A new draft amendment records who made the correction and why.</p><label htmlFor="amendment-reason">Reason for amendment</label><textarea id="amendment-reason" required maxLength={4000} value={reason} onChange={e=>setReason(e.target.value)}/><button disabled={busy}>{busy?'Creating amendment...':'Create amendment'}</button>{error&&<p role="alert">{error}</p>}</form>}</div>
}
