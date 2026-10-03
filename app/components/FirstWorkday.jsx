'use client'
import Link from 'next/link'
import {useRouter} from 'next/navigation'
import {useRef} from 'react'
import {request} from '@/lib/client/request'
import {useOperation} from '@/lib/client/useOperation'
import OperationFeedback from './OperationFeedback'
export default function FirstWorkday({guide,company,actor,help=false}){
 const router=useRouter(),op=useOperation(),attempt=useRef(null)
 if(guide.dismissed&&!help)return null
 function toggle(){void op.run('Saving guidance preference.',async()=>{attempt.current||={command:'guidance',payload:{companyId:company,requestId:crypto.randomUUID(),dismissed:!guide.dismissed}};await request('/api/pilot',{method:'POST',headers:{'Content-Type':'application/json','X-Expected-Actor':actor},body:JSON.stringify(attempt.current)});attempt.current=null;router.refresh();return 'Guidance preference saved.'})}
 return <section className="daily-section" aria-labelledby="first-workday-title"><h2 id="first-workday-title">Your first workday</h2><p>{guide.worker?'Your next steps as a worker.':'Your next steps coordinating a crew.'} Recorded activity below is scoped to this company; it is not a safety assessment.</p><ol className="work-list">{guide.steps.map(s=><li key={s.label}><Link href={s.href}>{s.label}</Link><p>{s.done?'Recorded activity: ':''}{s.detail}</p></li>)}</ol><button disabled={!op.ready||op.busy} onClick={toggle}>{guide.dismissed?'Show guide on Today':'Dismiss guide from Today'}</button><p>Available again in Help. Dismissing does not complete any task.</p><OperationFeedback operation={op}/></section>
}
