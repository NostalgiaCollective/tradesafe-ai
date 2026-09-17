'use client'
import {useRouter} from 'next/navigation'
import {useRef,useState} from 'react'
import {command} from '@/lib/client/commands'
import {getTemplate} from '@/lib/domain/templates'
import {useOperation} from '@/lib/client/useOperation'
import OperationFeedback from '@/app/components/OperationFeedback'
export default function StartReport({company}){
 const router=useRouter(),operation=useOperation(),attempt=useRef(null)
 const [trade,setTrade]=useState('electrical'),[saved,setSaved]=useState(null),[started,setStarted]=useState(false)
 function start(e){e.preventDefault();void operation.run('Creating a saved draft. Keep this page open.',async()=>{
  attempt.current||={companyId:company.id,id:crypto.randomUUID(),templateId:getTemplate(trade).id};setStarted(true)
  const r=await command('create_report',attempt.current);setSaved(r.id);router.push('/report/'+r.id);return 'Draft created. Opening job details.'
 })}
 return <section className="work-panel"><p className="eyebrow">New report</p><h1>Start a report</h1><p>A saved draft will be created for {company.name}. Choose a trade, then add job details, observations and photos. You can leave and resume after Saved appears.</p><form onSubmit={start}><label htmlFor="trade">Trade</label><select id="trade" value={trade} onChange={e=>setTrade(e.target.value)} disabled={!operation.ready||operation.busy||started}><option value="electrical">Electrical</option><option value="plumbing">Plumbing</option><option value="roofing">Roofing</option></select><p className="work-notice">Checklist content is pending qualified review. This records observations; it does not certify compliance or authorize work.</p><button className="primary" disabled={!operation.ready||operation.busy||Boolean(saved)}>{operation.busy?'Creating draft...':started?'Retry creating draft':'Create saved draft'}</button><OperationFeedback operation={operation}/>{saved&&<a href={'/report/'+saved}>Open your saved draft</a>}</form></section>
}
