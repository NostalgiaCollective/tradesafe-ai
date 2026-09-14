// Actual SMTP-delivered links only. No administrator-generated links or fixture creation.
import {existsSync,readFileSync,writeFileSync,mkdirSync} from 'node:fs'
import {resolve} from 'node:path'
import {randomBytes,createHash} from 'node:crypto'
import assert from 'node:assert/strict'
import {createClient} from '@supabase/supabase-js'
import {requireStaging} from './config.mjs'
import {gitIdentity} from './evidence.mjs'
process.env.PLAYWRIGHT_BROWSERS_PATH=resolve('.staging/browsers')
const {chromium,expect}=await import('@playwright/test')
const config=requireStaging();if(!config)process.exit(2)
const {env}=config,origin=env.NEXT_PUBLIC_APP_URL
const [operation,label]=process.argv.slice(2)
assert.ok(['request','verify'].includes(operation));assert.ok(['expired','desktop','mobile'].includes(label))
const identityFile='.staging/recovery-email-account.json',privateFile='.staging/recovery-email-test-private.json',resultFile='.staging/recovery-email-tests.json'
const identity=JSON.parse(readFileSync(identityFile,'utf8'))
assert.equal(identity.projectRef,env.STAGING_ISOLATED_PROJECT_REF)
const state=existsSync(resultFile)?JSON.parse(readFileSync(resultFile,'utf8')):{projectRef:env.STAGING_ISOLATED_PROJECT_REF,startedAt:new Date().toISOString(),kind:'actual SMTP email delivery',checks:[],requests:{}}
const privateState=existsSync(privateFile)?JSON.parse(readFileSync(privateFile,'utf8')):{}
const directory='test-results/recovery-email/'+state.startedAt.replaceAll(':','-');mkdirSync(directory,{recursive:true})
const save=()=>{writeFileSync(resultFile,JSON.stringify(state,null,2));writeFileSync(directory+'/results.json',JSON.stringify(state,null,2))}
const savePrivate=()=>writeFileSync(privateFile,JSON.stringify(privateState,null,2))
const make=()=>createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}})
const ok=r=>{if(r.error)throw Error('Provider or Data API operation failed');return r.data}
const api=(c,path,body)=>c.request.fetch(origin+'/api/auth/recovery'+path,{method:body?'POST':'GET',headers:body?{origin,'content-type':'application/json'}:undefined,data:body})
async function login(c,email,password){const p=await c.newPage();await p.goto(origin+'/auth/login');await p.getByLabel('Email',{exact:true}).fill(email);await p.getByLabel('Password',{exact:true}).fill(password);await p.getByRole('button',{name:'Sign In',exact:true}).click();await p.waitForURL(u=>!u.pathname.startsWith('/auth/'));await p.close()}
const digest=b=>createHash('sha256').update(b).digest('hex')
let browser,activeCheck=operation+' '+label
try{
 if(state.checks.some(c=>c.name===activeCheck&&c.status==='PASS')){console.log('Already passed; preserving existing result without repeating.');process.exit(0)}
 state.nextStep=activeCheck;state.testedWorkingTree=gitIdentity();save()
 browser=await chromium.launch({headless:true})
 const context=await browser.newContext({viewport:label==='mobile'?{width:390,height:844}:{width:1365,height:900},isMobile:label==='mobile',hasTouch:label==='mobile',serviceWorkers:'block'})
 const p=await context.newPage()
 if(operation==='request'){
  if(state.requests[label]&&state.requests[label].status!=='confirmed not dispatched')throw Error('Request already attempted: inspect inbox and checkpoint; never resend blindly')
  privateState[label]??={oldPassword:identity.currentPassword||identity.password,newPassword:randomBytes(32).toString('base64url')};savePrivate()
  await p.goto(origin+'/auth/login');await p.getByRole('link',{name:'Forgot password?'}).click()
  await p.waitForURL(u=>u.pathname==='/auth/forgot-password')
  await p.waitForFunction(()=>{const e=document.querySelector('input[type=email]');return e&&Object.keys(e).some(k=>k.startsWith('__reactProps'))})
  await p.getByLabel('Email',{exact:true}).fill(identity.email)
  state.requests[label]={attemptedAt:new Date().toISOString(),status:'attempting'};save()
  const response=p.waitForResponse(r=>r.url()===origin+'/api/auth/recovery/request'&&r.request().method()==='POST')
  await p.getByRole('button',{name:'Request recovery email',exact:true}).click()
  const r=await response;assert.equal(r.status(),202);const body=await r.json()
  await expect(p.getByRole('main').getByRole('status')).toContainText(body.message)
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true)
  state.requests[label].status='generic 202; receipt must be checked separately';state.requests[label].responseAt=new Date().toISOString()
  const duplicate=await api(context,'/request',{email:identity.email});assert.equal(duplicate.status(),202);assert.deepEqual(await duplicate.json(),body)
  const unlisted=await api(context,'/request',{email:'not-authorized@example.test'});assert.equal(unlisted.status(),202);assert.deepEqual(await unlisted.json(),body)
  state.requests[label].duplicateAndUnlistedGeneric=true
  state.nextStep='Read authorized inbox; record actual receipt and save delivered link privately for '+label
 }else{
  const links=JSON.parse(readFileSync('.staging/recovery-email-links.json','utf8')),link=links[label],u=new URL(link)
  assert.equal(u.origin,origin);assert.equal(u.pathname,'/auth/recovery');assert.equal(u.search,'');assert.match(u.hash,/^#token_hash=[a-f0-9]{40,128}$/)
  if(label==='expired'){
   await p.goto(link);await p.getByRole('button',{name:'Continue with recovery link'}).click();await expect(p.getByRole('main').getByRole('alert')).toContainText(/expired|invalid|used/)
   assert.equal(p.url(),origin+'/auth/recovery');assert.equal(await p.getByLabel('New password',{exact:true}).count(),0)
   state.expiredPasswordUnchanged=Boolean(ok(await make().auth.signInWithPassword({email:identity.email,password:privateState[label].oldPassword})).user.id===identity.userId)
  }else{
   const test=privateState[label],oldClient=make()
   if(test.passwordAttemptedAt&&!test.passwordChangedAt)throw Error('Interrupted password attempt: reconcile the saved candidate password and recovery grant before resuming; do not request or consume another link blindly')
   test.oldSession??=ok(await oldClient.auth.signInWithPassword({email:identity.email,password:test.oldPassword})).session;savePrivate()
   if(!test.passwordChangedAt){
   await login(context,env.STAGING_OWNER_EMAIL,env.STAGING_OWNER_PASSWORD)
   await p.goto(link);await expect(p.getByRole('button',{name:'Continue with recovery link'})).toBeVisible();assert.equal(p.url(),origin+'/auth/recovery')
   // Refresh before verification loses only in-memory link; reopening the actual email link works.
   await p.reload();await expect(p.getByText(/If you refreshed before verifying/)).toBeVisible();await p.goto(link)
   await p.getByRole('button',{name:'Continue with recovery link'}).click();await expect(p.getByLabel('New password',{exact:true})).toBeVisible()
   await expect(p.getByRole('main')).toContainText(identity.email);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true)
   await p.reload();await expect(p.getByLabel('New password',{exact:true})).toBeVisible()
   await p.getByLabel('New password',{exact:true}).fill(test.newPassword);await p.getByLabel('Confirm new password',{exact:true}).fill(test.newPassword)
   test.passwordAttemptedAt=new Date().toISOString();savePrivate()
   await p.getByRole('button',{name:'Update password',exact:true}).click();await expect(p.getByText('Password recovery completed. Sign in with your new password.',{exact:true})).toBeVisible()
   identity.currentPassword=test.newPassword;writeFileSync(identityFile,JSON.stringify(identity,null,2));test.passwordChangedAt=new Date().toISOString();savePrivate()
   await p.reload();await expect(p.getByText('Password recovery completed. Sign in with your new password.',{exact:true})).toBeVisible()
   test.completedRefreshCheckedAt=new Date().toISOString();savePrivate()
   }
   const signed=make();assert.equal(ok(await signed.auth.signInWithPassword({email:identity.email,password:test.newPassword})).user.id,identity.userId)
   assert.equal((await make().auth.signInWithPassword({email:identity.email,password:test.oldPassword})).error?.code,'invalid_credentials')
   assert.equal((await make().auth.refreshSession({refresh_token:test.oldSession.refresh_token})).error?.code,'refresh_token_not_found')
   const member=ok(await signed.from('ts_members').select('role,active').eq('company_id',identity.companyId).eq('user_id',identity.userId).single());assert.deepEqual(member,{role:'worker',active:true})
   const priorData=await fetch(env.NEXT_PUBLIC_SUPABASE_URL+'/rest/v1/ts_reports?id=eq.'+identity.reportId+'&select=id',{headers:{apikey:env.NEXT_PUBLIC_SUPABASE_ANON_KEY,authorization:'Bearer '+test.oldSession.access_token}})
   state[label+'OldJwtDataApiStatus']=priorData.status
   const fresh=await browser.newContext();await api(fresh,'')
   assert.equal((await api(fresh,'/verify',{tokenHash:u.hash.slice('#token_hash='.length)})).status(),401)
   assert.equal((await api(fresh,'/verify',{tokenHash:'malformed'})).status(),401)
   assert.equal((await api(fresh,'/verify',{tokenHash:randomBytes(32).toString('hex')})).status(),401)
   await login(fresh,identity.email,test.newPassword)
   const photo=await fresh.request.get(origin+'/api/reports/'+identity.reportId+'/evidence/'+identity.photoId);assert.equal(photo.status(),200);assert.equal(photo.headers()['content-type'],'image/jpeg')
   const pdf=await fresh.request.get(origin+'/api/reports/'+identity.reportId+'/exports/'+identity.exportId);assert.equal(pdf.status(),200);assert.ok((await pdf.body()).subarray(0,5).equals(Buffer.from('%PDF-')))
   const hashes={photo:digest(await photo.body()),pdf:digest(await pdf.body())};if(state.retainedArtifactHashes)assert.deepEqual(hashes,state.retainedArtifactHashes);else state.retainedArtifactHashes=hashes
   const removal=await fresh.request.delete(origin+'/api/reports/'+identity.reportId+'/evidence/'+identity.photoId,{headers:{origin}})
   assert.equal(removal.status(),409);assert.equal((await removal.json()).code,'immutable')
   for(const next of ['https://evil.test','//evil.test','/%2f%2fevil.test','/%252f%252fevil.test','/%5cevil.test','/api/checkout']){
    assert.equal((await api(fresh,'/request?next='+encodeURIComponent(next),{email:identity.email})).status(),403)
    assert.equal((await api(fresh,'/request',{email:identity.email,redirectTo:next})).status(),400)
   }
   state[label+'IndependentContext']=true;state[label+'CompleteAt']=new Date().toISOString()
  }
  state.nextStep=label==='expired'?'Restore and verify provider email OTP lifetime 3600 seconds before next request':label==='desktop'?'Request the third and final authorized email for mobile verification after cooldown':'Record receipt evidence, quality gates, commit, push and exact GitHub CI'
 }
 state.checks.push({name:activeCheck,status:'PASS',at:new Date().toISOString(),...gitIdentity()});save();console.log('PASS: '+activeCheck+'; safe durable results saved')
}catch(error){
 let reason=String(error.message).replace(/https?:\/\/[^\s"'<>]+/g,'[URL redacted]')
 const redact=value=>{if(typeof value==='string'&&value.length>7)reason=reason.replaceAll(value,'[private value]');else if(value&&typeof value==='object')Object.values(value).forEach(redact)}
 redact(identity);redact(privateState);redact(env)
 state.checks.push({name:activeCheck,status:'FAIL',at:new Date().toISOString(),reason,...gitIdentity()});save();console.error('FAIL: '+activeCheck+'; '+reason);process.exitCode=1
}finally{await browser?.close()}
