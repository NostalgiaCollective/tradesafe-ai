'use client'
import {useState} from 'react'
import {useOperation} from '@/lib/client/useOperation'
import {signInDemo} from '@/lib/client/demo-login.mjs'
export default function DemoLogin(){
 const [login,setLogin]=useState(''),[passphrase,setPassphrase]=useState(''),op=useOperation()
 function submit(e){e.preventDefault();void op.run('Signing in?',async()=>{const next=await signInDemo(login,passphrase);window.location.assign(next);return 'Opening demo job?'})}
 return <div className="work-app"><main className="work-main"><h1>Try TradeSafe</h1><p>DEMO ? SYNTHETIC DATA. Explore an electrical job using the shared demo login Daniel gave you. No signup or email is needed.</p><p>Anything you enter is visible to other visitors. Use fictional details only. This is shared demonstration activity, not an individual worker acknowledgement or safety approval.</p>
 <form onSubmit={submit} aria-busy={op.busy} aria-describedby="demo-result demo-error"><label htmlFor="demo-login">Demo login</label><input id="demo-login" autoComplete="username" autoCapitalize="none" spellCheck={false} disabled={!op.ready||op.busy} required maxLength={64} value={login} onChange={e=>setLogin(e.target.value)}/><label htmlFor="demo-passphrase">Demo passphrase</label><input id="demo-passphrase" type="password" autoComplete="current-password" required disabled={!op.ready||op.busy} maxLength={160} value={passphrase} onChange={e=>setPassphrase(e.target.value)}/><button className="primary" disabled={!op.ready||op.busy}>Open demo job</button><p id="demo-result" role="status">{op.message}</p><p id="demo-error" role="alert">{op.error}</p></form>
 <p>Access lasts up to one hour. Sign in here again if it expires. Saved demo records remain; no automatic reset runs.</p></main></div>
}
