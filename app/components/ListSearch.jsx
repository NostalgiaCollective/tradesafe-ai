'use client'
import {useTransition} from 'react'
import {useRouter} from 'next/navigation'
export default function ListSearch({company,q,status}){
 const router=useRouter(),[pending,start]=useTransition()
 function submit(e){e.preventDefault();const data=new FormData(e.currentTarget);start(()=>router.push('/dashboard?'+new URLSearchParams({company,q:String(data.get('q')||'').trim(),status:String(data.get('status')||'')})))}
 return <form action="/dashboard" className="work-filters" onSubmit={submit} aria-busy={pending}><input type="hidden" name="company" value={company}/><div><label htmlFor="report-search">Job address / report title</label><input id="report-search" name="q" type="search" maxLength={120} defaultValue={q} placeholder="Find a job"/></div><div><label htmlFor="status">Report status</label><select name="status" id="status" defaultValue={status}><option value="">All reports</option><option value="draft">Drafts to resume</option><option value="finalized">Finalized reports</option></select></div><button className="primary" disabled={pending}>{pending?'Finding reports…':'Find reports'}</button><a href={'/dashboard?company='+company}>Clear filters</a>{pending&&<p role="status">Loading matching reports. Your filters will stay in the address bar.</p>}</form>
}
