'use client'
import { useRouter } from 'next/navigation'
import { useEffect,useRef,useState } from 'react'
import { command } from '@/lib/client/commands'
export default function JoinClient(){
 const router=useRouter()
 const [token,setToken]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false)
 const captured=useRef(false)
 useEffect(()=>{if(captured.current)return;captured.current=true;const value=new URLSearchParams(window.location.hash.slice(1)).get('token')||'';queueMicrotask(()=>setToken(/^[a-f0-9]{64}$/.test(value)?value:''));window.history.replaceState(null,'',window.location.pathname)},[])
 async function accept(){setBusy(true);try{const result=await command('accept_invitation',{token});router.push('/dashboard?company='+result.company_id)}catch(e){setMessage(e.message);setBusy(false)}}
 return <section className="work-panel"><h1>Join your company</h1><p>Sign in with the verified email address your invitation was sent to. An invitation only grants access to company records.</p><p><a href="/auth/login" target="_blank" rel="noopener noreferrer">Sign in in another tab</a>, then return here to accept.</p><button className="primary" onClick={accept} disabled={!token||busy}>{busy?'Accepting...':'Accept invitation'}</button>{!token&&<p>Open the original invitation link to continue. Refreshing this page clears the invitation for your privacy.</p>}{message&&<p role="alert">{message}</p>}</section>
}
