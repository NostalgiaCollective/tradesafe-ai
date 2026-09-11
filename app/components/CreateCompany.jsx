'use client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { command } from '@/lib/client/commands'
export default function CreateCompany() {
 const router=useRouter()
 const [name,setName]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[id,setId]=useState('')
 async function submit(e){e.preventDefault();setBusy(true);setError('');const key=id||crypto.randomUUID();setId(key)
  try{const c=await command('create_company',{id:key,name});router.push('/dashboard?company='+c.id)}catch(e){setError(e.message);setBusy(false)}
 }
 return <section className="work-panel"><h1>Start your company workspace</h1><p>Keep observations, reports and follow-up actions together. Each person uses their own sign-in.</p><p>If you were invited, open the invitation link from your company owner.</p>
 <form onSubmit={submit}><label htmlFor="new-company">Business name</label><input id="new-company" required maxLength={200} value={name} onChange={e=>setName(e.target.value)} /><button className="primary" disabled={busy}>{busy?'Creating...':'Create company'}</button>{error&&<p role="alert">{error}</p>}</form></section>
}
