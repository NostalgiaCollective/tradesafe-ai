'use client'
import {useRef,useState} from 'react'
import {useRouter} from 'next/navigation'
import {command} from '@/lib/client/commands'
import {useOperation} from '@/lib/client/useOperation'
import OperationFeedback from './OperationFeedback'
export default function CreateCompany(){
 const router=useRouter(),operation=useOperation(),attempt=useRef(null)
 const [name,setName]=useState(''),[saved,setSaved]=useState(null),[started,setStarted]=useState(false)
 function submit(e){e.preventDefault();void operation.run('Creating company. Keep this page open.',async()=>{
  if(!name.trim())throw Error('Enter your business name.')
  attempt.current||={id:crypto.randomUUID(),name:name.trim()};setStarted(true)
  const result=await command('create_company',attempt.current);setSaved(result.id);router.push('/dashboard?company='+result.id);return 'Company created. Opening your reports.'
 })}
 return <section className="work-panel"><h1>Start your company workspace</h1><p>Your account is signed in. Create a company to start your first report, or join the company that invited you.</p><p>Already invited? Open the original invitation link from your company owner. You do not need a second company.</p>
 <form onSubmit={submit}><label htmlFor="new-company">Business name</label><input id="new-company" required maxLength={200} disabled={!operation.ready||operation.busy||started} value={name} onChange={e=>setName(e.target.value)}/><button className="primary" disabled={!operation.ready||operation.busy||Boolean(saved)}>{operation.busy?'Creating...':started?'Retry creating company':'Create company'}</button><OperationFeedback operation={operation}/>{saved&&<a href={'/dashboard?company='+saved}>Continue to your company reports</a>}</form></section>
}
