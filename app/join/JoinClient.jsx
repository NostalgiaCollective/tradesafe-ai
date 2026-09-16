'use client'
import {useRouter} from 'next/navigation'
import {useEffect,useRef,useState} from 'react'
import {command} from '@/lib/client/commands'
import {useOperation} from '@/lib/client/useOperation'
import OperationFeedback from '@/app/components/OperationFeedback'
export default function JoinClient(){
 const router=useRouter(),operation=useOperation(),captured=useRef(false)
 const [token,setToken]=useState(''),[saved,setSaved]=useState(null)
 useEffect(()=>{if(captured.current)return;captured.current=true;const value=new URLSearchParams(window.location.hash.slice(1)).get('token')||'';queueMicrotask(()=>setToken(/^[a-f0-9]{64}$/.test(value)?value:''));window.history.replaceState(null,'',window.location.pathname)},[])
 function accept(){void operation.run('Checking your invitation and company access.',async()=>{const result=await command('accept_invitation',{token});setSaved(result.company_id);router.push('/dashboard?company='+result.company_id);return 'Company joined. Opening its reports.'})}
 return <section className="work-panel"><h1>Join your company</h1><p>Use the verified email address your invitation was created for. Joining grants company access; it does not create another company.</p><p><a href="/auth/login" target="_blank" rel="noopener noreferrer">Sign in or create your account in another tab</a>, confirm your email if needed, then return here to accept. Keep this invitation tab open.</p><button className="primary" onClick={accept} disabled={!token||operation.busy||!operation.ready||Boolean(saved)}>{operation.busy?'Accepting...':'Accept invitation'}</button>{!token&&<p>Open the original invitation link to continue. Refreshing this page clears the invitation for your privacy. Ask the company owner for a new link if it is lost or expired.</p>}<OperationFeedback operation={operation}/>{saved&&<a href={'/dashboard?company='+saved}>Open company reports</a>}</section>
}
