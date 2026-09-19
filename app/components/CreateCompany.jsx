'use client'
import {useEffect,useRef,useState} from 'react'
import {useRouter} from 'next/navigation'
import {command} from '@/lib/client/commands'
import {useOperation} from '@/lib/client/useOperation'
import OperationFeedback from './OperationFeedback'
import {readProgress,writeProgress,clearProgress} from '@/lib/client/onboarding-storage'
export default function CreateCompany({actor}){
 const router=useRouter(),operation=useOperation(),attempt=useRef(null)
 const [name,setName]=useState(''),[saved,setSaved]=useState(null),[started,setStarted]=useState(false)
 const key='tradesafe:create-company:'+actor
 useEffect(()=>{const prior=readProgress(key);if(prior&&typeof prior.name==='string'){queueMicrotask(()=>{setName(prior.name);if(prior.id){attempt.current=prior;setStarted(true)}})}},[key])
 function submit(e){e.preventDefault();void operation.run('Creating company. Keep this page open.',async()=>{
  if(!name.trim())throw Error('Enter your business name.')
  attempt.current||={id:crypto.randomUUID(),name:name.trim()};setStarted(true)
  writeProgress(key,attempt.current)
  const result=await command('create_company',attempt.current);clearProgress(key);setSaved(result.id);router.push('/report/new?company='+result.id);return 'Company created. Choose a trade for your first report.'
 })}
 return <section className="work-panel"><h1>Start your company workspace</h1><p>Your account is signed in. Create a company to start your first report, or join the company that invited you.</p><p>Already invited? Open the original invitation link from your company owner. You do not need a second company.</p>
 <p>Only a business name is required. You will be its owner. Contact and trade details can be added later in Company &amp; people; existing report snapshots will not change.</p>
 <form onSubmit={submit}><label htmlFor="new-company">Business name</label><input id="new-company" required maxLength={200} disabled={!operation.ready||operation.busy||started} value={name} onChange={e=>{setName(e.target.value);writeProgress(key,{name:e.target.value})}}/><button className="primary" disabled={!operation.ready||operation.busy||Boolean(saved)}>{operation.busy?'Creating...':started?'Retry creating company':'Create company'}</button><OperationFeedback operation={operation}/>{saved&&<a href={'/report/new?company='+saved}>Create your first report</a>}</form></section>
}
