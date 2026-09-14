// Explicitly administrator-assisted provider diagnostics. NEVER evidence of email delivery.
import { existsSync,readFileSync,writeFileSync,mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { parseEnv } from 'node:util'
import { randomBytes,randomUUID } from 'node:crypto'
import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'
import { requireStaging } from './config.mjs'
import { gitIdentity } from './evidence.mjs'
process.env.PLAYWRIGHT_BROWSERS_PATH=resolve('.staging/browsers')
const {chromium,expect}=await import('@playwright/test')
const config=requireStaging();if(!config)process.exit(2)
const {env}=config,origin=env.NEXT_PUBLIC_APP_URL,checkpoint='.staging/password-recovery-diagnostic.json',privateFile='.staging/password-recovery-diagnostic-private.json'
let state=existsSync(checkpoint)?JSON.parse(readFileSync(checkpoint,'utf8')):null
if(state&&!process.argv.includes('--resume'))throw Error('Inspect existing recovery diagnostic checkpoint and use --resume; never create duplicate fixtures blindly.')
state??={...gitIdentity(),startedAt:new Date().toISOString(),projectRef:env.STAGING_ISOLATED_PROJECT_REF,kind:'administrator-assisted diagnostics; no email requested or delivered',status:'running',checks:[]}
if(state.projectRef!==env.STAGING_ISOLATED_PROJECT_REF)throw Error('Wrong project')
if(state.status==='PASS'){console.log('Already complete: no repeat needed.');process.exit(0)}
const directory='test-results/password-recovery/'+state.startedAt.replaceAll(':','-');mkdirSync(directory,{recursive:true})
const save=()=>{writeFileSync(checkpoint,JSON.stringify(state,null,2));writeFileSync(directory+'/diagnostics.json',JSON.stringify(state,null,2))}
let privateState=existsSync(privateFile)?JSON.parse(readFileSync(privateFile,'utf8')):{email:'tradesafe-recovery-'+randomBytes(6).toString('hex')+'@example.test',password:randomBytes(24).toString('base64url'),nextPassword:randomBytes(24).toString('base64url'),mobilePassword:randomBytes(24).toString('base64url')}
const savePrivate=()=>writeFileSync(privateFile,JSON.stringify(privateState,null,2));savePrivate();save()
const key=parseEnv(readFileSync('.staging/server.env','utf8')).SUPABASE_SERVICE_ROLE_KEY
const claims=JSON.parse(Buffer.from(key.split('.')[1],'base64url').toString('utf8'));assert.equal(claims.ref,env.STAGING_ISOLATED_PROJECT_REF);assert.equal(claims.role,'service_role')
const make=(key=env.NEXT_PUBLIC_SUPABASE_ANON_KEY)=>createClient(env.NEXT_PUBLIC_SUPABASE_URL,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}})
const admin=make(key),owner=make(),ordinary=make();let browser
const ok=r=>{if(r.error)throw Error('provider_or_database_failure');return r.data}
const check=async(name,fn)=>{if(state.checks.some(c=>c.name===name&&c.status==='PASS'))return;state.nextStep=name;save();await fn();state.checks.push({name,status:'PASS',at:new Date().toISOString()});save();console.log('PASS: '+name)}
const api=(context,path,body)=>context.request.fetch(origin+'/api/auth/recovery'+path,{method:body?'POST':'GET',headers:body?{origin,'content-type':'application/json'}:undefined,data:body})
const data=async(r,status=200)=>{assert.equal(r.status(),status);return r.json()}
async function login(context,email,password){const p=await context.newPage();await p.goto(origin+'/auth/login');await p.getByLabel('Email',{exact:true}).fill(email);await p.getByLabel('Password',{exact:true}).fill(password);await p.getByRole('button',{name:'Sign In',exact:true}).click();await p.waitForURL(u=>!u.pathname.startsWith('/auth/'));await p.close()}
async function link(name){if(!privateState[name]){const result=ok(await admin.auth.admin.generateLink({type:'recovery',email:privateState.email}));privateState[name]=result.properties.hashed_token;savePrivate()}return privateState[name]}
try{
 ok(await owner.auth.signInWithPassword({email:env.STAGING_OWNER_EMAIL,password:env.STAGING_OWNER_PASSWORD}))
 await check('Dedicated synthetic identity reconciled without sending email',async()=>{
  const listed=ok(await admin.auth.admin.listUsers({perPage:1000})).users.filter(u=>u.email===privateState.email)
  const user=listed[0]||ok(await admin.auth.admin.createUser({email:privateState.email,password:privateState.password,email_confirm:true})).user
  state.userId=user.id;save()
  const fixture=JSON.parse(readFileSync('.staging/phase3-verification.json','utf8'));state.companyId=fixture.ids.company;state.reportId=fixture.ids.report;state.photoId=fixture.ids.photo;state.exportId=fixture.ids.export;save()
  ok(await ordinary.auth.signInWithPassword({email:privateState.email,password:privateState.password}))
  const members=ok(await ordinary.from('ts_members').select('user_id').eq('company_id',state.companyId).eq('active',true))
  if(!members.length){
   privateState.invitationToken??=randomBytes(32).toString('hex');savePrivate()
   ok(await owner.rpc('ts_command',{command:'invite',p:{companyId:state.companyId,requestId:randomUUID(),email:privateState.email,role:'worker',token:privateState.invitationToken}}))
   ok(await ordinary.rpc('ts_command',{command:'accept_invitation',p:{requestId:randomUUID(),token:privateState.invitationToken}}))
  }
 })
 browser=await chromium.launch({headless:true})
 const desktop=await browser.newContext({viewport:{width:1365,height:900},serviceWorkers:'block'}),mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block'}),existing=await browser.newContext()
 await check('Ordinary sessions and flags cannot authorize recovery; direct grant and throttle access denied',async()=>{
  ok(await ordinary.auth.signInWithPassword({email:privateState.email,password:privateState.password}))
  await login(existing,privateState.email,privateState.password)
  for(const table of ['ts_recovery_grants','ts_recovery_limits'])assert.equal((await ordinary.from(table).select('*')).error?.code,'42501')
  assert.equal((await ordinary.rpc('ts_recovery_grant',{command:'create',p:{id:'a'.repeat(64),userId:state.userId,session:'forged'}})).error?.code,'42501')
  assert.equal((await ordinary.rpc('ts_recovery_limit',{kind:'request',subject:'a'.repeat(64)})).error?.code,'42501')
  await data(await api(existing,''));await data(await api(existing,'/password',{password:privateState.nextPassword}),401)
  await data(await api(existing,'/verify',{tokenHash:'forged'}),401)
  await data(await api(existing,'/password',{password:privateState.nextPassword,recovery:true}),400)
 })
 await check('Redirect bypasses and wrong origins fail without exposing provider recovery material',async()=>{
  for(const next of ['https://evil.test','//evil.test','/%2f%2fevil.test','/%252f%252fevil.test','/%5cevil.test','/auth/callback','/api/checkout']){
   await data(await api(desktop,'/request?next='+encodeURIComponent(next),{email:privateState.email}),403)
   await data(await api(desktop,'/request',{email:privateState.email,redirectTo:next}),400)
  }
  const result=await desktop.request.post(origin+'/api/auth/recovery/verify',{headers:{origin:'https://evil.test','content-type':'application/json'},data:{tokenHash:'a'.repeat(64)}});await data(result,403)
 })
 await check('Unconfigured real email delivery fails truthfully; desktop/mobile forms and network retry are accessible',async()=>{
  for(const context of [desktop,mobile]){
   const p=await context.newPage();await p.goto(origin+'/auth/login');await p.getByRole('link',{name:'Forgot password?'}).click();await p.waitForURL(u=>u.pathname==='/auth/forgot-password')
   await p.getByLabel('Email',{exact:true}).fill(privateState.email)
   await p.route('**/api/auth/recovery/request',route=>route.abort('failed'));await p.getByRole('button',{name:'Request recovery email'}).click();await expect(p.getByRole('main').getByRole('alert')).toBeVisible();await p.unroute('**/api/auth/recovery/request')
   await p.getByRole('button',{name:'Request recovery email'}).click();await expect(p.getByRole('main').getByRole('alert')).toContainText('not configured')
   assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true)
   await p.close()
  }
 })
 let oldSession
 if(!state.checks.some(c=>c.name.startsWith('Cross-browser')&&c.status==='PASS'))oldSession=ok(await ordinary.auth.signInWithPassword({email:privateState.email,password:privateState.password})).session
 await check('Cross-browser provider recovery, wrong-account isolation, refreshed authorization and lost-response completion',async()=>{
  await data(await api(existing,'')) // request browser has a distinct recovery nonce
  await login(desktop,env.STAGING_OWNER_EMAIL,env.STAGING_OWNER_PASSWORD) // wrong ordinary account intentionally remains signed in
  const token=await link('desktopToken'),p=await desktop.newPage()
  await p.goto(origin+'/auth/recovery#token_hash='+token)
  await expect(p.getByRole('button',{name:'Continue with recovery link'})).toBeVisible();assert.equal(new URL(p.url()).hash,'')
  await p.getByRole('button',{name:'Continue with recovery link'}).click();await expect(p.getByLabel('New password',{exact:true})).toBeVisible()
  await p.reload();await expect(p.getByLabel('New password',{exact:true})).toBeVisible();await expect(p.getByText(privateState.email,{exact:true})).toBeVisible()
  await p.getByLabel('New password',{exact:true}).fill(privateState.nextPassword);await p.getByLabel('Confirm new password',{exact:true}).fill(privateState.nextPassword)
  await p.route('**/api/auth/recovery/password',async route=>{await route.fetch();await route.abort('failed')})
  await p.getByRole('button',{name:'Update password',exact:true}).click();await expect(p.getByRole('main').getByRole('alert')).toBeVisible();await p.unroute('**/api/auth/recovery/password');await p.reload()
  await expect(p.getByText('Password recovery completed. Sign in with your new password.',{exact:true})).toBeVisible()
  privateState.currentPassword=privateState.nextPassword;savePrivate()
  assert.equal((await make().auth.signInWithPassword({email:privateState.email,password:privateState.password})).error?.code,'invalid_credentials')
  ok(await make().auth.signInWithPassword({email:privateState.email,password:privateState.currentPassword}))
  assert.ok((await make().auth.refreshSession({refresh_token:oldSession.refresh_token})).error)
  const oldJwt=await make().auth.getUser(oldSession.access_token);state.oldAccessTokenAfterGlobalSignout=oldJwt.error?'provider rejected immediately':'provider accepted until expiry';save()
  const authStillOwner=await desktop.request.get(origin+'/settings');assert.equal(authStillOwner.status(),200)
  await p.close()
 })
 await check('Used/tampered links fail and verified attempts are durably rate limited',async()=>{
  const fresh=await browser.newContext();await data(await api(fresh,''))
  await data(await api(fresh,'/verify',{tokenHash:privateState.desktopToken}),401)
  for(let i=0;i<5;i++)await data(await api(fresh,'/verify',{tokenHash:randomBytes(32).toString('hex')}),401)
  await data(await api(fresh,'/verify',{tokenHash:randomBytes(32).toString('hex')}),503)
  await fresh.close()
 })
 await check('Mobile recovery changes only the dedicated account and retains original company/photo/PDF access',async()=>{
  const token=await link('mobileToken'),p=await mobile.newPage();await p.goto(origin+'/auth/recovery#token_hash='+token)
  await p.getByRole('button',{name:'Continue with recovery link'}).click();await expect(p.getByLabel('New password',{exact:true})).toBeVisible()
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true)
  await p.getByLabel('New password',{exact:true}).fill(privateState.mobilePassword);await p.getByLabel('Confirm new password',{exact:true}).fill(privateState.mobilePassword)
  await p.getByRole('button',{name:'Update password',exact:true}).click();await expect(p.getByText('Password recovery completed. Sign in with your new password.',{exact:true})).toBeVisible()
  privateState.currentPassword=privateState.mobilePassword;savePrivate()
  assert.equal((await make().auth.signInWithPassword({email:privateState.email,password:privateState.nextPassword})).error?.code,'invalid_credentials')
  const signed=make();ok(await signed.auth.signInWithPassword({email:privateState.email,password:privateState.currentPassword}))
  const member=ok(await signed.from('ts_members').select('role,active').eq('company_id',state.companyId).eq('user_id',state.userId).single());assert.equal(member.role,'worker');assert.equal(member.active,true)
  await login(mobile,privateState.email,privateState.currentPassword)
  const photo=await mobile.request.get(origin+'/api/reports/'+state.reportId+'/evidence/'+state.photoId);assert.equal(photo.status(),200);assert.equal(photo.headers()['content-type'],'image/jpeg')
  const pdf=await mobile.request.get(origin+'/api/reports/'+state.reportId+'/exports/'+state.exportId);assert.equal(pdf.status(),200);assert.ok((await pdf.body()).subarray(0,5).equals(Buffer.from('%PDF-')))
  const forbidden=await mobile.request.delete(origin+'/api/reports/'+state.reportId+'/evidence/'+state.photoId,{headers:{origin}});assert.ok([403,409].includes(forbidden.status()))
  await p.close()
 })
 state.status='PASS';state.finishedAt=new Date().toISOString();state.nextStep='Real delivered-email verification remains BLOCKED: custom SMTP/template and explicitly authorized inbox required. Diagnostics are not delivery proof.';save()
}catch(error){state.status='FAIL';let detail=error.message;for(const context of browser?.contexts()||[])for(const p of context.pages())detail+='\nVisible page: '+await p.locator('main').innerText().catch(()=>'(unavailable)');for(const value of [...Object.values(privateState),key])if(typeof value==='string'&&value.length>5)detail=detail.split(value).join('[redacted]');detail=detail.replace(/https?:\/\/[^\s]+/g,'[URL redacted]');state.checks.push({name:state.nextStep,status:'FAIL',errorType:error.name,detail,at:new Date().toISOString()});save();console.error('FAIL: '+state.nextStep+'; sanitized evidence preserved. No credentials or recovery URLs logged.');process.exitCode=1}
finally{await browser?.close()}
