'use client'
import {useRef,useState} from 'react'
import {useRouter} from 'next/navigation'
import {briefCommand} from '@/lib/client/brief-command'
import {useOperation} from '@/lib/client/useOperation'
import OperationFeedback from '@/app/components/OperationFeedback'
export default function CreateBrief({companyId,actor,briefs}){
 const [reuse,setReuse]=useState(''),attempt=useRef(null),operation=useOperation(),router=useRouter()
 function create(e){e.preventDefault();void operation.run('Creating a saved brief.',async()=>{
  attempt.current||={companyId,id:crypto.randomUUID(),requestId:crypto.randomUUID(),...(reuse?{reuseId:reuse}:{})}
  const b=await briefCommand('create',attempt.current,actor);router.push('/briefs/'+b.id);return 'Brief created. Opening site details.'
 })}
 return <form className="work-panel" onSubmit={create}><label htmlFor="reuse-site">Reuse site details (optional)</label><select id="reuse-site" value={reuse} onChange={e=>setReuse(e.target.value)} disabled={operation.busy||Boolean(attempt.current)}><option value="">New site details</option>{briefs.filter(b=>b.document.site).map(b=><option key={b.id} value={b.id}>{b.document.site} — {b.document.date||'Draft'}</option>)}</select><p>Only site and contact are copied. Confirm today’s context, crew, hazards and controls afresh.</p><button className="primary" disabled={!operation.ready||operation.busy}>{operation.busy?'Creating brief…':attempt.current?'Retry creating brief':'Start daily brief'}</button><OperationFeedback operation={operation}/></form>
}
