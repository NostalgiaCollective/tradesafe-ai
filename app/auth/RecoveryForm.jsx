'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

const field='block w-full rounded border border-white/30 bg-black p-3 text-white'
const button='rounded bg-amber px-4 py-3 font-semibold text-black disabled:opacity-50'
async function api(path,body){
 const result=await fetch('/api/auth/recovery'+path,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined,cache:'no-store'})
 const data=await result.json()
 if(!result.ok)throw Error(data.error||'Recovery is unavailable. Try again.')
 return data
}
export default function RecoveryForm({requestOnly=false}){
 const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[confirm,setConfirm]=useState('')
 const [state,setState]=useState(requestOnly?'request':'loading'),[busy,setBusy]=useState(false)
 const [error,setError]=useState(''),[message,setMessage]=useState(''),[hasToken,setHasToken]=useState(false)
 const token=useRef(''),inFlight=useRef(false),initialized=useRef(false)
 async function refresh(){const current=await api('');setState(current.state);setEmail(current.email||'')}
 useEffect(()=>{
  if(requestOnly)return
  function captureLink(){
   // Reopening an email in this tab can change only the fragment, without a mount.
   // This captures a candidate; only provider verification grants authorization.
   const hash=new URLSearchParams(window.location.hash.slice(1))
   const values=hash.getAll('token_hash')
   token.current=values.length===1&&[...hash.keys()].every(k=>k==='token_hash')?values[0]:''
   setHasToken(Boolean(token.current));setError('')
   window.history.replaceState(null,'','/auth/recovery')
  }
  if(!initialized.current){
   initialized.current=true
   captureLink()
   refresh().catch(e=>{setError(e.message);setState('unavailable')})
  }
  window.addEventListener('hashchange',captureLink)
  return ()=>window.removeEventListener('hashchange',captureLink)
 },[requestOnly])
 async function run(action){
  if(inFlight.current)return
  inFlight.current=true;setBusy(true);setError('');setMessage('')
  try{await action()}catch(e){setError(e.message||'Connection interrupted. Retry or request a new recovery email.')}
  finally{inFlight.current=false;setBusy(false)}
 }
 function requestEmail(e){e.preventDefault();run(async()=>{const result=await api('/request',{email});setMessage(result.message)})}
 function verify(){run(async()=>{await api('/verify',{tokenHash:token.current});token.current='';setHasToken(false);await refresh()})}
 function update(e){
  e.preventDefault()
  if(password!==confirm){setError('Passwords must match.');return}
  run(async()=>{const result=await api('/password',{password});setPassword('');setConfirm('');setState(result.state);setMessage(result.message)})
 }
 return <main className="mx-auto w-full max-w-lg px-4 py-12 text-white">
  <h1 className="mb-6 text-2xl font-semibold">{requestOnly?'Reset your password':'Choose a new password'}</h1>
  {requestOnly?<form onSubmit={requestEmail} className="space-y-4">
   <p>Enter your account email. We will show the same confirmation whether or not an account exists.</p>
   <label className="block">Email<input className={field} type="email" autoComplete="email" required maxLength={254} value={email} onChange={e=>setEmail(e.target.value)}/></label>
   <button className={button} disabled={busy}>{busy?'Requesting…':'Request recovery email'}</button>
  </form>:<>
   {state==='loading'&&<p role="status">Checking recovery authorization…</p>}
   {state==='unverified'&&(hasToken?<div className="space-y-4"><p>Continue to verify the recovery link before choosing a password. This does not change any password yet.</p><button className={button} disabled={busy} onClick={verify}>{busy?'Verifying…':'Continue with recovery link'}</button></div>:<p>This recovery link is missing, expired, or already used. If you refreshed before verifying, reopen the original email or request a new link.</p>)}
   {['verified','updating','changed'].includes(state)&&<form onSubmit={update} className="space-y-4">
    <p>Recovering <strong className="break-all">{email}</strong>. Any account already signed in on this browser does not determine whose password changes.</p>
    <p id="password-rules">Use at least 6 characters and no more than 72 UTF-8 bytes. A longer unique password is recommended. The provider may reject weak or unchanged passwords.</p>
    {state!=='verified'&&<p role="status">An update started earlier. Wait 90 seconds, then retry the exact same password to confirm completion.</p>}
    <label className="block">New password<input className={field} type="password" autoComplete="new-password" aria-describedby="password-rules" required minLength={6} maxLength={72} value={password} onChange={e=>setPassword(e.target.value)}/></label>
    <label className="block">Confirm new password<input className={field} type="password" autoComplete="new-password" required minLength={6} maxLength={72} value={confirm} onChange={e=>setConfirm(e.target.value)}/></label>
    <p>After completion, sign in again. Previous sessions lose refresh access; already-issued access tokens can remain usable until expiry.</p>
    <button className={button} disabled={busy}>{busy?'Updating password…':'Update password'}</button>
   </form>}
   {state==='complete'&&<p role="status">Password recovery completed. Sign in with your new password.</p>}
   {hasToken&&['complete','verified','updating','changed'].includes(state)&&<button className={button} disabled={busy} onClick={()=>run(async()=>{await api('/start',{});await refresh()})}>Use this new recovery link instead</button>}
   {state==='unavailable'&&<button className={button} disabled={busy} onClick={()=>run(refresh)}>Retry recovery check</button>}
  </>}
  {error&&<p role="alert" className="mt-4">{error}</p>}
  {message&&<p role="status" className="mt-4">{message}</p>}
  <nav className="mt-6 flex flex-wrap gap-4" aria-label="Account recovery"><Link className="underline" href="/auth/login">Back to sign in</Link>{!requestOnly&&<Link className="underline" href="/auth/forgot-password">Request a new link</Link>}</nav>
 </main>
}
