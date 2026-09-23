'use client'
import {useRef,useState} from 'react'
import {useRouter} from 'next/navigation'
import {siteCommand} from '@/lib/client/site-command'
import {useOperation} from '@/lib/client/useOperation'
import OperationFeedback from '@/app/components/OperationFeedback'
import pilot from '@/lib/domain/content-pilot.json'
export default function SiteStart({site,actor,briefs}){
 const [reuse,setReuse]=useState(''),attempt=useRef(null),operation=useOperation(),router=useRouter()
 function start(e){e.preventDefault();void operation.run('Creating a fresh saved brief.',async()=>{
  attempt.current||={id:crypto.randomUUID(),requestId:crypto.randomUUID(),companyId:site.company_id,siteId:site.id,contentVersion:pilot.version,...(reuse?{reuseId:reuse}:{})}
  const r=await siteCommand('create_brief',attempt.current,actor);router.push('/briefs/'+r.id);return 'Brief created.'
 })}
 return <form onSubmit={start}><details><summary>Reuse a previous task description</summary><label htmlFor="site-reuse">Starting task (optional)</label><select id="site-reuse" value={reuse} onChange={e=>setReuse(e.target.value)} disabled={operation.busy||!!attempt.current}><option value="">Start with a blank task</option>{briefs.filter(b=>b.document.task).map(b=><option key={b.id} value={b.id}>{b.document.date||'Undated draft'} — {b.document.task.slice(0,100)}</option>)}</select><p>Only the task description is reused. Enter this day’s date, contact, context, crew, hazards and controls afresh. No acknowledgements, implemented controls or verification carry forward.</p></details><button className="primary" disabled={!operation.ready||operation.busy||site.archived}>{operation.busy?'Creating brief…':attempt.current?'Retry creating brief':"Start today’s brief"}</button><OperationFeedback operation={operation}/></form>
}
