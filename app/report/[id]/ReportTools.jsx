'use client'
import {useRouter} from 'next/navigation'
import {useEffect,useRef,useState} from 'react'
import {command} from '@/lib/client/commands'
import {useOperation} from '@/lib/client/useOperation'
import {reportState} from '@/lib/client/report-state'
import {useUnsavedWarning} from '@/lib/client/useUnsavedWarning'
import OperationFeedback from '@/app/components/OperationFeedback'
export default function ReportTools({report,actor,canAmend,returnTo,initialReason=''}){
 const router=useRouter(),operation=useOperation(),attempt=useRef(null)
 useEffect(()=>{if(!operation.ready)return;const focus=()=>{if(window.location.hash==='#amend-report')document.getElementById('amendment-reason')?.focus()};focus();window.addEventListener('hashchange',focus);return()=>window.removeEventListener('hashchange',focus)},[operation.ready])
 const [reason,setReason]=useState(initialReason),[started,setStarted]=useState(false),[saved,setSaved]=useState(null)
 useUnsavedWarning(Boolean(reason.trim()&&!saved))
 function amend(e){e.preventDefault();void operation.run('Creating a correction draft. The original report will remain unchanged.',async()=>{
  if(!reason.trim())throw Error('Enter the reason for this correction.')
  attempt.current||={id:crypto.randomUUID(),companyId:report.company_id,amendmentOf:report.id,reason:reason.trim()};setStarted(true)
  let r
  if(started){try{r=await reportState(attempt.current.id,actor)}catch(e){if(e.code!=='not_found')throw e}}
  r ||= await command('amend',attempt.current,actor);setSaved(r.id);setReason('');router.push('/report/'+r.id+(returnTo?'?'+new URLSearchParams({from:returnTo}):''));return 'Correction draft created. Opening the new draft.'
 })}
 return <div id="amend-report" className="no-print work-panel">
{canAmend?<form onSubmit={amend}><h2>Make a correction</h2><p>Create a separate amendment draft. The original report, photos and PDF stay unchanged. Review the copied observations and add any photos needed for the correction.</p><label htmlFor="amendment-reason">Reason for correction</label><textarea id="amendment-reason" required maxLength={4000} disabled={!operation.ready||operation.busy||started} value={reason} onChange={e=>setReason(e.target.value)}/><button disabled={!operation.ready||operation.busy||Boolean(saved)}>{operation.busy?'Creating correction...':started?'Retry creating correction':'Create correction draft'}</button><OperationFeedback operation={operation} returnTo={'/report/'+report.id}/>{saved&&<a href={'/report/'+saved}>Open correction draft</a>}</form>:report.lifecycle==='finalized'?<p>Ask the report author, a supervisor or an owner to create a correction draft (a separate amendment).</p>:null}
 <details><summary>Print text only</summary><p>Browser printing includes text and current follow-up status without photos. Use the PDF for the finalized snapshot with photos.</p><button type="button" onClick={()=>window.print()}>Print text review (no photos)</button></details></div>
}
