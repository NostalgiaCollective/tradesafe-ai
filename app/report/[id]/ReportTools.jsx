'use client'
import {useRouter} from 'next/navigation'
import {useRef,useState} from 'react'
import {command} from '@/lib/client/commands'
import {useOperation} from '@/lib/client/useOperation'
import OperationFeedback from '@/app/components/OperationFeedback'
export default function ReportTools({report,canAmend}){
 const router=useRouter(),operation=useOperation(),attempt=useRef(null)
 const [reason,setReason]=useState(''),[started,setStarted]=useState(false),[saved,setSaved]=useState(null)
 function amend(e){e.preventDefault();void operation.run('Creating an amendment. The original report will remain unchanged.',async()=>{
  if(!reason.trim())throw Error('Enter the reason for this amendment.')
  attempt.current||={id:crypto.randomUUID(),companyId:report.company_id,amendmentOf:report.id,reason:reason.trim()};setStarted(true)
  const r=await command('amend',attempt.current);setSaved(r.id);router.push('/report/'+r.id);return 'Amendment created. Opening the new draft.'
 })}
 return <div id="amend-report" className="no-print work-panel">
{canAmend?<form onSubmit={amend}><h2>Make a correction</h2><p>Create a separate amendment draft. The original report, photos and PDF stay unchanged. Review the copied observations and add any photos needed for the correction.</p><label htmlFor="amendment-reason">Reason for amendment</label><textarea id="amendment-reason" required maxLength={4000} disabled={!operation.ready||operation.busy||started} value={reason} onChange={e=>setReason(e.target.value)}/><button disabled={!operation.ready||operation.busy||Boolean(saved)}>{operation.busy?'Creating amendment...':started?'Retry creating amendment':'Create amendment'}</button><OperationFeedback operation={operation}/>{saved&&<a href={'/report/'+saved}>Open amendment draft</a>}</form>:report.lifecycle==='finalized'?<p>Ask the report author, a supervisor or an owner to create an amendment.</p>:null}
 <details><summary>Print text only</summary><p>Browser printing includes text and current follow-up status without photos. Use the PDF for the finalized snapshot with photos.</p><button type="button" onClick={()=>window.print()}>Print text review (no photos)</button></details></div>
}
