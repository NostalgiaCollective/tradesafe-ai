'use client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { command } from '@/lib/client/commands'
import { getTemplate } from '@/lib/domain/templates'
export default function StartReport({company}) {
 const router=useRouter()
 const [trade,setTrade]=useState('electrical'),[id,setId]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('')
 async function start(e){e.preventDefault();setBusy(true);setError('');const key=id||crypto.randomUUID();setId(key)
  try{const r=await command('create_report',{companyId:company.id,id:key,templateId:getTemplate(trade).id});router.push('/report/'+r.id)}catch(e){setError(e.message);setBusy(false)}
 }
 return <section className="work-panel"><p className="eyebrow">1 / 4 · Choose a trade</p><h1>Start a report</h1><p>A saved draft will be created for {company.name}. Its business details are copied now and retained with the report.</p>
 <form onSubmit={start}><label htmlFor="trade">Trade</label><select id="trade" value={trade} onChange={e=>setTrade(e.target.value)} disabled={Boolean(id)}><option value="electrical">Electrical</option><option value="plumbing">Plumbing</option><option value="roofing">Roofing</option></select>
 <p className="work-notice">Checklist content is pending qualified review. This records observations; it does not certify compliance or authorize work.</p><button className="primary" disabled={busy}>{busy?'Creating draft...':id?'Retry creating draft':'Create saved draft'}</button>{error&&<p role="alert">{error}</p>}</form></section>
}
