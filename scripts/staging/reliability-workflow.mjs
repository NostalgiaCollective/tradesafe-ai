import {readFileSync,writeFileSync,existsSync} from 'node:fs'
import {resolve} from 'node:path'
import {parseEnv} from 'node:util'
import {randomUUID,randomBytes,createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'
import assert from 'node:assert/strict'
import {createClient} from '@supabase/supabase-js'
import {largePhoto} from '../../tests/fixtures/large-photo.mjs'
import {HOSTED_ORIGIN,STAGING_PROJECT} from '../../lib/staging/hosted.mjs'
import {requireStaging} from './config.mjs'
const config=requireStaging();assert.ok(config)
const env=config.env,serverEnv=parseEnv(readFileSync('.staging/server.env','utf8')),hosted=process.argv.includes('--hosted'),origin=hosted?HOSTED_ORIGIN:'https://localhost:3000',label=hosted?'hosted':'local'
assert.equal(env.NEXT_PUBLIC_SUPABASE_URL,'https://'+STAGING_PROJECT+'.supabase.co')
const filename='.staging/reliability-'+label+'.json',privateFile='.staging/reliability-'+label+'-private.json'
const state=existsSync(filename)?JSON.parse(readFileSync(filename)):{origin,startedAt:new Date().toISOString(),checks:[]}
assert.equal(state.origin,origin)
state.sourceCommit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();state.sourceDirty=Boolean(execFileSync('git',['diff','HEAD','--name-only'],{encoding:'utf8'}).trim());state.status='RUNNING'
const secrets=existsSync(privateFile)?JSON.parse(readFileSync(privateFile)):{owner:{email:'synthetic-reliability-'+randomUUID()+'@example.test',password:randomBytes(24).toString('base64url')},worker:{email:'synthetic-reliability-'+randomUUID()+'@example.test',password:randomBytes(24).toString('base64url')}}
const save=()=>{writeFileSync(filename,JSON.stringify(state,null,2)+'\n');writeFileSync(privateFile,JSON.stringify(secrets,null,2)+'\n')};save()
const pass=name=>{state.checks.push({name,at:new Date().toISOString()});save();console.log('PASS '+name)}
const has=name=>state.checks.some(c=>c.name===name)
const admin=createClient(env.NEXT_PUBLIC_SUPABASE_URL,serverEnv.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}})
const ordinary=()=>createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}})
process.env.PLAYWRIGHT_BROWSERS_PATH=resolve('.staging/browsers')
const {chromium,devices,expect}=await import('@playwright/test')
const gate=JSON.parse(readFileSync('.staging/hosted-access.json')),browser=await chromium.launch(),options={...devices['iPhone 14 Pro Max'],...(hosted?{httpCredentials:{username:gate.username,password:gate.password}}:{})}
let c,p
async function login(context,account){const page=await context.newPage();page.setDefaultTimeout(30000);page.setDefaultNavigationTimeout(90000);await page.goto(origin+'/auth/login',{waitUntil:'networkidle'});await page.getByLabel('Email',{exact:true}).fill(account.email);await page.getByLabel('Password',{exact:true}).fill(account.password);await page.getByRole('button',{name:'Sign In',exact:true}).click();await page.waitForURL('**/dashboard');return page}
async function post(context,path,data){return context.request.post(origin+path,{headers:{origin},data})}
try{
 if(hosted){assert.match(process.env.EXPECTED_COMMIT||'',/^[a-f0-9]{40}$/);const temp=await browser.newContext(options);const r=await temp.request.get(origin+'/api/staging/identity');const identity=await r.json();assert.equal(identity.commit,process.env.EXPECTED_COMMIT);state.deployedCommit=identity.commit;await temp.close()}
 if(!has('mocked signup feedback, slow duplicate guard and unavailable methods hidden')){
  const ctx=await browser.newContext(options),page=await ctx.newPage();let requests=0,release
  const hold=new Promise(resolve=>{release=resolve})
  await ctx.route(env.NEXT_PUBLIC_SUPABASE_URL+'/auth/v1/**',async route=>{requests++;assert.ok(route.request().url().includes('/signup'));await hold;await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({id:randomUUID(),aud:'authenticated',role:'authenticated',email:'synthetic-ui@example.test',identities:[],created_at:new Date().toISOString()})})})
  await page.goto(origin+'/auth/login',{waitUntil:'networkidle'});await expect(page.getByRole('button',{name:'Continue with Google'})).toHaveCount(0);await expect(page.getByRole('button',{name:'Use magic link instead'})).toHaveCount(0)
  await page.getByRole('button',{name:'Sign up',exact:true}).click();await page.getByLabel('Email',{exact:true}).fill('synthetic-ui@example.test');await page.getByLabel('Password',{exact:true}).fill('synthetic-only-password')
  await page.getByRole('button',{name:'Create Account',exact:true}).evaluate(b=>{b.click();b.click()});await expect(page.getByRole('button',{name:'Please wait...',exact:true})).toBeDisabled();await expect(page.getByRole('status')).toContainText('Keep this page open');assert.equal(requests,1);release()
  await expect(page.getByRole('status')).toContainText('Creating an account does not yet create or join a company');await expect(page.getByLabel('Email',{exact:true})).toHaveValue('synthetic-ui@example.test');await page.getByRole('button',{name:'Sign in',exact:true}).focus();await page.keyboard.press('Enter');await expect(page.getByRole('button',{name:'Sign In',exact:true})).toBeVisible();await ctx.close();pass('mocked signup feedback, slow duplicate guard and unavailable methods hidden')
 }
 for(const key of ['owner','worker'])if(!secrets[key].id){const result=await admin.auth.admin.generateLink({type:'signup',email:secrets[key].email,password:secrets[key].password});assert.equal(result.error,null);secrets[key].id=result.data.user.id;secrets[key].tokenHash=result.data.properties.hashed_token;save()}
 if(!has('provider confirmation boundary; no email sent')){
  const client=ordinary(),unconfirmed=await client.auth.signInWithPassword(secrets.owner);assert.equal(unconfirmed.error?.code,'email_not_confirmed')
  for(const key of ['owner','worker']){const result=await ordinary().auth.verifyOtp({token_hash:secrets[key].tokenHash,type:'signup'});assert.equal(result.error,null);secrets[key].confirmed=true;delete secrets[key].tokenHash;save()}
  pass('provider confirmation boundary; no email sent')
 }
 c=await browser.newContext(options);p=await login(c,secrets.owner)
 if(!state.companyId){
  await expect(p.getByRole('heading',{name:'Start your company workspace'})).toBeVisible();await p.getByLabel('Business name',{exact:true}).fill('SYNTHETIC reliability '+label)
  const create=p.waitForResponse(r=>r.url()===origin+'/api/workspace'&&r.request().postDataJSON()?.command==='create_company');await p.getByRole('button',{name:'Create company',exact:true}).evaluate(b=>{b.click();b.click()});const r=await create;assert.equal(r.status(),200);state.companyId=(await r.json()).id;save();await p.waitForURL('**/dashboard?company=*');pass('fresh confirmed account creates company with repeated tap guard')
 }
 if(!state.reportId){await p.goto(origin+'/report/new?company='+state.companyId,{waitUntil:'networkidle'});const response=p.waitForResponse(r=>r.url()===origin+'/api/workspace'&&r.request().postDataJSON()?.command==='create_report');await p.getByRole('button',{name:'Create saved draft',exact:true}).evaluate(b=>{b.click();b.click()});const r=await response;assert.equal(r.status(),200);state.reportId=(await r.json()).id;save();await p.waitForURL(/\/report\/[a-f0-9-]{36}/);pass('first saved report creation through mobile UI')}
 const report=origin+'/report/'+state.reportId,base='/api/reports/'+state.reportId+'/evidence'
 if(!has('draft interrupted response, stable retry, session loss and resume')){
  await p.goto(report,{waitUntil:'networkidle'});let lost=false,requestIds=[]
  await c.route(origin+'/api/workspace',async route=>{const data=route.request().postDataJSON();if(data.command==='save_report'){requestIds.push(data.payload.requestId);if(!lost){lost=true;const r=await route.fetch();assert.equal(r.status(),200);return route.abort()}}return route.continue()})
  await p.getByLabel('Job address',{exact:true}).fill('SYNTHETIC reliable workflow '+label);await expect(p.getByRole('alert').filter({hasText:'No completion was confirmed'})).toBeVisible();await expect(p.locator('.save-state')).toHaveText('Not saved');await p.getByRole('button',{name:'Retry saving',exact:true}).click();await expect(p.locator('.save-state')).toHaveText('Saved');assert.equal(requestIds[0],requestIds[1]);await c.unroute(origin+'/api/workspace')
  await p.getByLabel('Work date',{exact:true}).fill('2026-09-16');await expect(p.locator('.save-state')).toHaveText('Saved')
  await c.clearCookies();await p.getByLabel('Client or job reference (optional)',{exact:true}).fill('SYNTHETIC preserved across session loss');await expect(p.getByRole('alert').filter({hasText:'session has expired'})).toBeVisible();await expect(p.locator('.save-state')).toHaveText('Not saved')
  const signin=await login(c,secrets.owner);await signin.close();await p.getByRole('button',{name:'Retry saving',exact:true}).click();await expect(p.locator('.save-state')).toHaveText('Saved');await p.reload({waitUntil:'networkidle'});await expect(p.getByLabel('Client or job reference (optional)',{exact:true})).toHaveValue('SYNTHETIC preserved across session loss');pass('draft interrupted response, stable retry, session loss and resume')
 }
 if(!has('real larger photo upload, collapsed diagnostics and retained reload')){
  await p.goto(report+'?step=5',{waitUntil:'networkidle'});if(hosted){await expect(p.getByTestId('upload-diagnostics')).not.toBeVisible();await p.getByText('Photo upload troubleshooting',{exact:true}).click();await expect(p.getByTestId('upload-diagnostics')).toBeVisible();await p.getByText('Photo upload troubleshooting',{exact:true}).click()}
  const caption='SYNTHETIC reliability photo',rows=await (await c.request.get(origin+base)).json()
  if(!rows.some(r=>r.caption===caption&&r.state==='ready')){await p.getByLabel('Photo file',{exact:true}).setInputFiles({name:'synthetic.jpeg',mimeType:'image/jpeg',buffer:await largePhoto()});await p.getByLabel('Photo caption',{exact:true}).fill(caption);await p.getByRole('button',{name:'Upload photo',exact:true}).tap();await expect(p.getByRole('status').filter({hasText:'Photo saved and retained.'})).toBeVisible()}
  await p.reload({waitUntil:'networkidle'});await expect.poll(()=>p.getByRole('img',{name:caption,exact:true}).evaluate(e=>e.complete&&e.naturalWidth>0)).toBe(true);await expect(p.getByText(caption,{exact:true})).toBeVisible();const saved=await (await c.request.get(origin+base)).json();state.photoId=saved.find(r=>r.caption===caption).id;save();pass('real larger photo upload, collapsed diagnostics and retained reload')
 }
 if(!has('invitation accepted through actual UI without email')){
  if(!secrets.invitation){await p.goto(origin+'/settings?company='+state.companyId,{waitUntil:'networkidle'});await p.getByLabel('Their sign-in email',{exact:true}).fill(secrets.worker.email);await p.getByRole('button',{name:'Create invitation link',exact:true}).click();await expect(p.getByLabel('Private invitation link',{exact:true})).toBeVisible();secrets.invitation=await p.getByLabel('Private invitation link',{exact:true}).inputValue();save()}
  const workerContext=await browser.newContext(options),workerPage=await login(workerContext,secrets.worker);await workerPage.goto(secrets.invitation,{waitUntil:'networkidle'});await workerPage.getByRole('button',{name:'Accept invitation',exact:true}).evaluate(b=>{b.click();b.click()});await workerPage.waitForURL('**/dashboard?company=*');await expect(workerPage.getByRole('heading',{name:'Reports',exact:true})).toBeVisible();await workerContext.close();pass('invitation accepted through actual UI without email')
 }
 if(!has('real cross-company and privileged admission denial')){
  const outsiderContext=await browser.newContext(options);await login(outsiderContext,{email:env.STAGING_OUTSIDER_EMAIL,password:env.STAGING_OUTSIDER_PASSWORD});assert.equal((await outsiderContext.request.get(origin+base)).status(),404);assert.equal((await outsiderContext.request.get(origin+base+'/'+state.photoId)).status(),404);const forbidden=await post(outsiderContext,'/api/workspace',{command:'save_report',payload:{companyId:state.companyId,id:state.reportId}});assert.equal(forbidden.status(),403);await outsiderContext.close()
  const client=ordinary();await client.auth.signInWithPassword(secrets.owner);const rpc=await client.rpc('ts_resource_admit',{kind:'upload',report_id:state.reportId,actor_id:secrets.owner.id});assert.equal(rpc.error?.code,'42501');pass('real cross-company and privileged admission denial')
 }
 if(!has('finalization is immutable and PDF is retained and authorized')){
  await p.goto(report+'?step=3',{waitUntil:'networkidle'});const fields=p.getByLabel('Observation',{exact:true})
  if(await fields.count()){for(let i=0;i<await fields.count();i++){await fields.nth(i).selectOption(i===0?'attention':'meets');if(i===0)await p.getByLabel('Explanation (required)',{exact:true}).fill('SYNTHETIC concern for action retry');await expect(p.locator('.save-state')).toHaveText('Saved')}await p.getByRole('button',{name:'4. Review',exact:true}).click();await p.getByRole('checkbox').check();await p.getByRole('button',{name:'Finalize report',exact:true}).evaluate(b=>{b.click();b.click()});await expect(p.getByRole('heading',{name:'Your finalized report',exact:true})).toBeVisible()}
  await p.reload({waitUntil:'networkidle'});if(await p.getByRole('button',{name:'Open PDF',exact:true}).count()){await p.getByRole('button',{name:'Open PDF',exact:true}).evaluate(b=>{b.click();b.click()})}
  await expect(p.getByRole('button',{name:'Download PDF',exact:true})).toBeEnabled({timeout:90000});const download=p.waitForEvent('download');await p.getByRole('button',{name:'Download PDF',exact:true}).click();await download;await expect(p.getByRole('status').filter({hasText:'PDF sent to your browser'})).toBeVisible()
  const job=await (await c.request.get(origin+'/api/reports/'+state.reportId+'/exports')).json();state.exportId=job.id;const bytes=await (await c.request.get(origin+'/api/reports/'+state.reportId+'/exports/'+job.id)).body();assert.equal(bytes.subarray(0,5).toString(),'%PDF-');state.pdfHash=createHash('sha256').update(bytes).digest('hex');save()
  pass('finalization is immutable and PDF is retained and authorized')
 }
 if(!has('valid finalized edit denied; other company cannot read retained PDF')){
  const client=ordinary();await client.auth.signInWithPassword(secrets.owner);const {data:original,error}=await client.from('ts_reports').select('*').eq('id',state.reportId).single();assert.equal(error,null)
  const r=await post(c,'/api/workspace',{command:'save_report',payload:{companyId:state.companyId,id:state.reportId,revision:original.revision,requestId:randomUUID(),document:original.document}});assert.equal(r.status(),409);assert.equal((await r.json()).code,'immutable')
  const outsider=await browser.newContext(options);await login(outsider,{email:env.STAGING_OUTSIDER_EMAIL,password:env.STAGING_OUTSIDER_PASSWORD});assert.equal((await outsider.request.get(origin+'/api/reports/'+state.reportId+'/exports/'+state.exportId)).status(),404);await outsider.close();pass('valid finalized edit denied; other company cannot read retained PDF')
 }
 if(!has('action lost-response retry is idempotent and confirmation is nearby')){
  await p.goto(origin+'/actions?company='+state.companyId,{waitUntil:'networkidle'});const action=p.locator('article').filter({hasText:'SYNTHETIC concern for action retry'});await action.getByText('Update action',{exact:true}).click();let lost=false,ids=[]
  await c.route(origin+'/api/workspace',async route=>{const data=route.request().postDataJSON();if(data.command==='update_action'){ids.push(data.payload.requestId);if(!lost){lost=true;const r=await route.fetch();assert.equal(r.status(),200);return route.abort()}}return route.continue()})
  await action.getByLabel('Immediate controls or action taken',{exact:true}).fill('SYNTHETIC controls retained on retry');await p.getByRole('button',{name:'Save action update',exact:true}).evaluate(b=>{b.click();b.click()});await expect(p.getByRole('alert').filter({hasText:'No completion was confirmed'})).toBeVisible();await action.getByRole('button',{name:'Retry action update',exact:true}).click();await expect(p.getByRole('status').filter({hasText:'Action update saved.'}).last()).toBeVisible();assert.equal(ids[0],ids[1]);await c.unroute(origin+'/api/workspace');await p.reload({waitUntil:'networkidle'});await action.getByText('Update action',{exact:true}).click();await expect(action.getByLabel('Immediate controls or action taken',{exact:true})).toHaveValue('SYNTHETIC controls retained on retry');pass('action lost-response retry is idempotent and confirmation is nearby')
 }
 if(!has('amendment repeated taps preserve original retained PDF')){
  await p.goto(report,{waitUntil:'networkidle'});await p.getByLabel('Reason for amendment',{exact:true}).fill('SYNTHETIC reliability amendment');const response=p.waitForResponse(r=>r.url()===origin+'/api/workspace'&&r.request().postDataJSON()?.command==='amend');await p.getByRole('button',{name:'Create amendment',exact:true}).evaluate(b=>{b.click();b.click()});const r=await response;assert.equal(r.status(),200);state.amendmentId=(await r.json()).id;save();await p.waitForURL(url=>url.pathname==='/report/'+state.amendmentId);const bytes=await (await c.request.get(origin+'/api/reports/'+state.reportId+'/exports/'+state.exportId)).body();assert.equal(createHash('sha256').update(bytes).digest('hex'),state.pdfHash);pass('amendment repeated taps preserve original retained PDF')
 }
 if(!has('real server resource limit rejects excess work; retained bytes still readable')){
  const path='/api/reports/'+state.amendmentId+'/evidence';let limited=false
  for(let i=0;i<22;i++){const r=await c.request.post(origin+path,{headers:{origin,'Content-Type':'application/octet-stream','X-Evidence-Id':randomUUID(),'X-Evidence-Caption':'SYNTHETIC quota verification'},data:Buffer.from('invalid synthetic image')});if(r.status()===429){assert.equal((await r.json()).code,'resource_limited');assert.equal(r.headers()['retry-after'],'600');limited=true;break}assert.equal(r.status(),422)}
  assert.equal(limited,true);assert.equal((await c.request.get(origin+base+'/'+state.photoId)).status(),200);assert.equal((await c.request.get(origin+'/api/reports/'+state.reportId+'/exports/'+state.exportId)).status(),200);pass('real server resource limit rejects excess work; retained bytes still readable')
 }
 const anon=await browser.newContext(options);assert.equal((await anon.request.get(origin+'/api/reports/'+state.reportId+'/exports/'+state.exportId)).status(),401);await anon.close();pass('retained PDF still requires an account session')
 state.status='PASS';delete state.failure
}catch(e){state.status='FAIL';state.failure={name:e.name,lines:[...(e.stack||'').matchAll(/reliability-workflow\.mjs:(\d+)/g)].map(m=>Number(m[1]))};process.exitCode=1}
finally{await browser.close();state.finishedAt=new Date().toISOString();save();console.log(JSON.stringify({status:state.status,checks:state.checks,failure:state.failure,reportId:state.reportId,sourceCommit:state.sourceCommit,sourceDirty:state.sourceDirty}))}
