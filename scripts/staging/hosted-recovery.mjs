// One journaled hosted email request and ordinary browser recovery; secrets stay in ignored files.
import assert from 'node:assert/strict'
import {readFileSync,writeFileSync,existsSync} from 'node:fs'
import {resolve} from 'node:path'
import {randomBytes} from 'node:crypto'
import {createClient} from '@supabase/supabase-js'
import {requireStaging} from './config.mjs'
import {HOSTED_ORIGIN} from '../../lib/staging/hosted.mjs'
process.env.PLAYWRIGHT_BROWSERS_PATH=resolve('.staging/browsers')
const {chromium,expect}=await import('@playwright/test')
const {env}=requireStaging(),origin=HOSTED_ORIGIN,operation=process.argv[2]
assert.ok(['request','verify'].includes(operation))
const accountFile='.staging/recovery-email-account.json',account=JSON.parse(readFileSync(accountFile,'utf8')),access=JSON.parse(readFileSync('.staging/hosted-access.json','utf8'))
const privateFile='.staging/hosted-recovery-private.json',resultFile='.staging/hosted-recovery.json'
const secret=existsSync(privateFile)?JSON.parse(readFileSync(privateFile,'utf8')):{oldPassword:account.currentPassword||account.password,newPassword:randomBytes(32).toString('base64url')}
const state=existsSync(resultFile)?JSON.parse(readFileSync(resultFile,'utf8')):{origin,startedAt:new Date().toISOString(),checks:[]}
const save=()=>{writeFileSync(privateFile,JSON.stringify(secret,null,2));writeFileSync(resultFile,JSON.stringify(state,null,2))}
const make=()=>createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}})
let browser
try{
 browser=await chromium.launch({headless:true})
 const c=await browser.newContext({httpCredentials:{username:access.username,password:access.password},viewport:{width:390,height:844},isMobile:true,hasTouch:true})
 const p=await c.newPage()
 if(operation==='request'){
  assert.ok(!state.requestAttemptedAt,'Existing request must be reconciled; no blind resend')
  const auth=await make().auth.signInWithPassword({email:account.email,password:secret.oldPassword});assert.equal(auth.error,null);assert.equal(auth.data.user.id,account.userId)
  await p.goto(origin+'/auth/forgot-password');await p.getByLabel('Email',{exact:true}).fill(account.email)
  state.requestAttemptedAt=new Date().toISOString();state.status='requesting';save()
  const response=p.waitForResponse(r=>r.url()===origin+'/api/auth/recovery/request'&&r.request().method()==='POST')
  await p.getByRole('button',{name:'Request recovery email',exact:true}).click();assert.equal((await response).status(),202)
  await expect(p.getByRole('main').getByRole('status')).toBeVisible();state.status='202; awaiting independent receipt';save()
 }else{
  const link=JSON.parse(readFileSync('.staging/hosted-recovery-link.json','utf8')).link,u=new URL(link)
  assert.equal(u.origin,origin);assert.equal(u.pathname,'/auth/recovery');assert.equal(u.search,'');assert.match(u.hash,/^#token_hash=[a-f0-9]{40,128}$/)
  state.receiptOriginVerified=true;save()
  if(!state.passwordChangedAt){
   assert.ok(!state.passwordAttemptedAt,'Interrupted password attempt requires reconciliation')
   await p.goto(link);await p.getByRole('button',{name:'Continue with recovery link',exact:true}).click();await expect(p.getByLabel('New password',{exact:true})).toBeVisible({timeout:30000})
   await expect(p.getByRole('main')).toContainText(account.email);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
   const flags=(await c.cookies()).filter(k=>k.name.includes('recovery')).map(k=>({name:k.name,secure:k.secure,httpOnly:k.httpOnly,sameSite:k.sameSite}));assert.ok(flags.length>0&&flags.every(k=>k.secure&&k.httpOnly&&k.sameSite==='Strict'));state.recoveryCookieFlags=flags;save()
   await p.getByLabel('New password',{exact:true}).fill(secret.newPassword);await p.getByLabel('Confirm new password',{exact:true}).fill(secret.newPassword)
   state.passwordAttemptedAt=new Date().toISOString();save();await p.getByRole('button',{name:'Update password',exact:true}).click();await expect(p.getByText('Password recovery completed. Sign in with your new password.',{exact:true})).toBeVisible({timeout:30000})
   account.currentPassword=secret.newPassword;writeFileSync(accountFile,JSON.stringify(account,null,2));state.passwordChangedAt=new Date().toISOString();save()
  }
  const fresh=make();assert.equal((await fresh.auth.signInWithPassword({email:account.email,password:secret.newPassword})).error,null);assert.equal((await make().auth.signInWithPassword({email:account.email,password:secret.oldPassword})).error?.code,'invalid_credentials')
  await p.goto(origin+'/auth/login');await p.getByLabel('Email',{exact:true}).fill(account.email);await p.getByLabel('Password',{exact:true}).fill(secret.newPassword);await p.getByRole('button',{name:'Sign In',exact:true}).click();await p.waitForURL('**/dashboard',{timeout:30000})
  for(const suffix of ['/evidence/'+account.photoId,'/exports/'+account.exportId])assert.equal((await c.request.get(origin+'/api/reports/'+account.reportId+suffix)).status(),200)
  const logout=p.getByRole('button',{name:/sign out|log out/i});await logout.click();await p.waitForURL(u=>u.pathname==='/auth/login'||u.pathname==='/',{timeout:30000});await p.goto(origin+'/dashboard');await p.waitForURL(u=>u.pathname==='/auth/login',{timeout:30000})
  state.status='PASS';state.checks=['actual hosted-origin email received','mobile-emulated recovery link and identity','Secure HttpOnly Strict recovery cookie','password updated','new password succeeds; old fails','hosted sign-in','retained photo/PDF after recovery','logout and protected-route redirect'];state.completedAt=new Date().toISOString();save()
 }
 console.log('PASS: hosted recovery '+operation+'; private state saved')
}catch(error){state.status='FAIL';state.failure={name:error.name,code:error.code,lines:[...(error.stack||'').matchAll(/hosted-recovery\.mjs:(\d+)/g)].map(m=>Number(m[1]))};save();console.error('FAIL: hosted recovery '+operation+'; '+error.name+'; lines '+state.failure.lines.join(','));process.exitCode=1}
finally{await browser?.close()}
