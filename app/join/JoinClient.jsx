'use client'
import {useEffect,useRef,useState} from 'react'
import Link from 'next/link'
import {command} from '@/lib/client/commands'
import {request} from '@/lib/client/request.mjs'
import {readProgress,writeProgress,clearProgress} from '@/lib/client/onboarding-storage'
const key='tradesafe:invitation'
const messages={wrong_account:'This invitation is for another verified email address. Switch to the account your owner invited, then check again.',expired:'This invitation has expired. Ask your company owner for a new link.',revoked:'The company owner revoked this invitation. Ask them for a new link if you still need access.',access_removed:'You previously joined, but your company access has been removed. Ask an owner to restore access with a new invitation.',unavailable:'This invitation is unavailable. Ask your company owner for a new link.'}
export default function JoinClient(){
 const captured=useRef(false),lock=useRef(false),generation=useRef(0)
 const [token,setToken]=useState(''),[context,setContext]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[checked,setChecked]=useState(false),[volatile,setVolatile]=useState(false)
 async function check(value){
  const current=++generation.current;lock.current=true;setBusy(true);setError('');setContext(null)
  try{const result=await request('/api/invitations/context',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:value})});if(current===generation.current)setContext(result)}
  catch(e){if(current===generation.current){setContext(null);setError(e.code==='unauthorized'?'Sign in with the verified email your company owner invited. Your invitation will remain in this tab.':e.message)}}
  finally{if(current===generation.current){setChecked(true);setBusy(false);lock.current=false}}
 }
 useEffect(()=>{function capture(){
  const value=new URLSearchParams(window.location.hash.slice(1)).get('token')||'',prior=readProgress(key)
  const selected=window.location.hash?/^[a-f0-9]{64}$/.test(value)?value:'':prior?.expires>Date.now()&&/^[a-f0-9]{64}$/.test(prior.token)?prior.token:''
  window.history.replaceState(null,'',window.location.pathname)
  setToken(selected);if(selected){setVolatile(!writeProgress(key,{token:selected,expires:selected===value?Date.now()+7*86400000:prior.expires}));void check(selected)}else{generation.current++;lock.current=false;setContext(null);setError('');setBusy(false);setChecked(true);clearProgress(key)}
  }
  if(!captured.current){captured.current=true;queueMicrotask(capture)}
  const changed=()=>{if(window.location.hash)capture()};window.addEventListener('hashchange',changed)
  return()=>window.removeEventListener('hashchange',changed)
 },[])
 async function accept(){
  if(lock.current||context?.status!=='pending')return;const current=++generation.current;lock.current=true;setBusy(true);setError('')
  try{const r=await command('accept_invitation',{token});if(current===generation.current)setContext({status:'accepted',company_id:r.company_id})}
  catch(e){if(current===generation.current)setError(e.message)}finally{if(current===generation.current){setBusy(false);lock.current=false}}
 }
 return <section className="work-panel"><h1>Join your company</h1><p>Use the verified email address your company owner invited. Joining does not create another company.</p>
 {context?.signedInAs&&<p>Signed in as <strong>{context.signedInAs}</strong>.</p>}
 {(!checked||busy)&&<p role="status">{busy?'Checking your invitation. Keep this page open.':'Preparing invitation…'}</p>}
 {checked&&!token&&<p>Open the private invitation link your company owner shared. If you no longer have it, ask for a new link.</p>}
 {volatile&&<p role="status">This browser cannot retain the invitation across reload. Keep this tab open, or reopen the original private link.</p>}
 {context?.status==='pending'&&<><h2>{context.company_name}</h2><p>You are invited as a <strong>{context.role}</strong>. Expires {new Date(context.expires_at).toLocaleDateString('en-CA')}.</p><button className="primary" disabled={busy} onClick={accept}>Accept invitation</button></>}
 {context?.status==='accepted'&&<><h2>You have joined this company</h2><p>This invitation is already accepted. Your existing membership is unchanged.</p><Link className="primary button" href={'/report/new?company='+context.company_id}>Create your first report</Link><p><Link href={'/dashboard?company='+context.company_id}>Open company reports</Link></p></>}
 {messages[context?.status]&&<p role="status">{messages[context.status]}</p>}
 {error&&<p role="alert">{error}</p>}
 {token&&context?.status!=='accepted'&&<div className="work-buttons"><Link href="/auth/login?redirect=%2Fjoin">{context?'Switch account':'Sign in or create account'}</Link><button disabled={busy} onClick={()=>check(token)}>Check invitation again</button></div>}
 <p><Link href="/dashboard">Back to my companies</Link></p></section>
}
