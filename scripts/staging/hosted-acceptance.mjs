// Hosted-only acceptance with ordinary synthetic accounts; never changes provider settings.
import assert from 'node:assert/strict'
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs'
import {resolve} from 'node:path'
import {createHash} from 'node:crypto'
import {createClient} from '@supabase/supabase-js'
import {requireStaging} from './config.mjs'
import {gitIdentity} from './evidence.mjs'
import {HOSTED_ORIGIN,STAGING_PROJECT} from '../../lib/staging/hosted.mjs'
process.env.PLAYWRIGHT_BROWSERS_PATH=resolve('.staging/browsers')
const {chromium,expect}=await import('@playwright/test')
const config=requireStaging();assert.ok(config)
const {env}=config,origin=HOSTED_ORIGIN
const access=JSON.parse(readFileSync('.staging/hosted-access.json','utf8'))
const retained=JSON.parse(readFileSync('.staging/recovery-email-account.json','utf8'))
assert.equal(retained.projectRef,STAGING_PROJECT)
const file='.staging/hosted-acceptance.json'
const state=existsSync(file)?JSON.parse(readFileSync(file,'utf8')):{startedAt:new Date().toISOString(),origin,checks:[],reports:{},diagnostics:[]}
assert.equal(state.origin,origin)
const dir='test-results/hosted-acceptance/'+state.startedAt.replaceAll(':','-');mkdirSync(dir,{recursive:true})
const save=()=>{const body=JSON.stringify(state,null,2);writeFileSync(file,body);writeFileSync(dir+'/results.json',body)}
const check=async(name,fn)=>{state.nextStep=name;state.status='running';delete state.failure;save();await fn();state.checks=state.checks.filter(c=>c.name!==name);state.checks.push({name,status:'PASS',at:new Date().toISOString()});save();console.log('PASS: '+name)}
const hash=b=>createHash('sha256').update(b).digest('hex')
const authorization='Basic '+Buffer.from(access.username+':'+access.password).toString('base64')
const request=(path,options={})=>fetch(origin+path,{...options,signal:AbortSignal.timeout(90000)})
const make=()=>createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}})
let browser,workflowPage
async function login(c,email,password){const p=await c.newPage();await p.goto(origin+'/auth/login');await p.getByLabel('Email',{exact:true}).fill(email);await p.getByLabel('Password',{exact:true}).fill(password);await p.getByRole('button',{name:'Sign In',exact:true}).click();await p.waitForURL('**/dashboard',{timeout:60000});return p}
try{
 await check('HTTPS liveness and whole-site password gate',async()=>{
  const h=await request('/api/staging/health');assert.equal(h.status,200);assert.equal(await h.text(),'ok')
  for(const path of ['/auth/login','/api/staging/identity','/_next/static/test.js']){const r=await request(path);assert.equal(r.status,401);assert.match(r.headers.get('www-authenticate'),/Basic/)}
  assert.equal((await request('/auth/login',{headers:{authorization:'Basic '+Buffer.from('wrong:wrong').toString('base64')}})).status,401)
  const r=await request('/api/staging/identity',{headers:{authorization}});assert.equal(r.status,200);state.identity=await r.json();assert.equal(state.identity.origin,origin);assert.equal(state.identity.projectRef,STAGING_PROJECT);assert.equal(state.identity.branch,'astra/production-mvp');assert.equal(state.identity.commit,gitIdentity().commit);assert.equal(state.identity.publicKeyDigest,hash(env.NEXT_PUBLIC_SUPABASE_ANON_KEY));assert.match(r.headers.get('cache-control'),/no-store/)
  assert.equal((await request('/api/staging/identity',{headers:{authorization,origin:'https://untrusted.example.test'}})).status,403)
 })
 browser=await chromium.launch({headless:true})
 const contextOptions={httpCredentials:{username:access.username,password:access.password},serviceWorkers:'block'}
 await check('Gate preserves fragment and unauthenticated protected routes redirect',async()=>{
  const c=await browser.newContext(contextOptions)
  await c.addInitScript(()=>{if(location.pathname==='/auth/recovery')window.__initialRecoveryHash=location.hash})
  const p=await c.newPage();await p.goto(origin+'/auth/recovery#probe=staging');assert.equal(await p.evaluate(()=>window.__initialRecoveryHash),'#probe=staging');await expect(p.getByRole('main')).toBeVisible();await p.goto(origin+'/dashboard');await p.waitForURL(u=>u.pathname==='/auth/login',{timeout:30000});assert.equal(new URL(p.url()).searchParams.get('redirect'),'/dashboard');await c.close()
 })
 await check('Retained ordinary-account photo and PDF access and integrity',async()=>{
  const c=await browser.newContext(contextOptions);await login(c,retained.email,retained.currentPassword||retained.password)
  const photo=await c.request.get(origin+'/api/reports/'+retained.reportId+'/evidence/'+retained.photoId);assert.equal(photo.status(),200)
  const pdf=await c.request.get(origin+'/api/reports/'+retained.reportId+'/exports/'+retained.exportId);assert.equal(pdf.status(),200)
  const client=make();const auth=await client.auth.signInWithPassword({email:retained.email,password:retained.currentPassword||retained.password});assert.equal(auth.error,null)
  for(const [table,id,response] of [['ts_evidence',retained.photoId,photo],['ts_exports',retained.exportId,pdf]]){const r=await client.from(table).select('sha256').eq('id',id).single();assert.equal(r.error,null);assert.equal(hash(await response.body()),r.data.sha256)}
  assert.ok((await pdf.body()).subarray(0,5).equals(Buffer.from('%PDF-')));assert.ok((await c.cookies()).filter(k=>k.name.startsWith('sb-')).every(k=>k.secure&&k.sameSite==='Lax'));await c.close()
 })
 for(const device of ['desktop','mobile'])await check(device+' report creation, autosave, checklist, photo, finalization and PDF download',async()=>{
  const c=await browser.newContext({...contextOptions,viewport:device==='mobile'?{width:390,height:844}:{width:1440,height:1000},isMobile:device==='mobile',hasTouch:device==='mobile'})
  const p=await login(c,env.STAGING_OWNER_EMAIL,env.STAGING_OWNER_PASSWORD);workflowPage=p;p.setDefaultTimeout(30000);p.setDefaultNavigationTimeout(60000)
  p.on('pageerror',e=>{state.diagnostics.push({device,type:'pageerror',name:e.name});save()})
  p.on('console',m=>{if(m.type()==='error'){state.diagnostics.push({device,type:'console-error'});save()}})
  p.on('response',r=>{if(r.status()>=400&&new URL(r.url()).origin===origin){state.diagnostics.push({device,type:'http',status:r.status(),path:new URL(r.url()).pathname});save()}})
  if(!state.reports[device]){
   await p.goto(origin+'/report/new?company='+retained.companyId)
   p.on('request',r=>{if(r.url()===origin+'/api/workspace'&&r.method()==='POST'){const body=r.postDataJSON();if(body.command==='create_report'){state.reports[device]=body.payload.id;save()}}})
   await p.getByRole('button',{name:'Create saved draft',exact:true}).click();await p.waitForURL(/\/report\/[a-f0-9-]{36}$/);state.reports[device]=new URL(p.url()).pathname.split('/').at(-1);save()
  }
  const rid=state.reports[device];console.log('STEP: '+device+' opening saved report');await p.goto(origin+'/report/'+rid)
  if(await p.getByLabel('Job address',{exact:true}).count()){
   console.log('STEP: '+device+' saving job details');await p.getByLabel('Job address',{exact:true}).fill('SYNTHETIC hosted '+device+' verification');await p.getByLabel('Work date',{exact:true}).fill('2026-09-15');await expect(p.locator('.save-state')).toHaveText('Saved',{timeout:30000});await p.reload();await expect(p.getByLabel('Job address',{exact:true})).toHaveValue('SYNTHETIC hosted '+device+' verification')
   await p.getByRole('button',{name:'Continue to observations',exact:true}).click()
   console.log('STEP: '+device+' checklist');const selects=p.getByLabel('Observation',{exact:true});for(let i=0;i<await selects.count();i++){if(await selects.nth(i).inputValue()!=='meets'){await selects.nth(i).selectOption('meets');await expect(p.locator('.save-state')).toHaveText('Saved',{timeout:30000})}}
   await p.reload();for(let i=0;i<await selects.count();i++)assert.equal(await selects.nth(i).inputValue(),'meets')
   await p.getByRole('button',{name:'3. Photos',exact:true}).click();const caption='SYNTHETIC hosted '+device+' photo'
   const priorPhotos=await c.request.get(origin+'/api/reports/'+rid+'/evidence');assert.equal(priorPhotos.status(),200)
   if(!(await priorPhotos.json()).some(row=>row.caption===caption&&row.state==='ready')){
    await p.getByLabel('Photo file',{exact:true}).setInputFiles(resolve('test-results/phase3/synthetic-photo.png'));await p.getByLabel('Photo caption',{exact:true}).fill(caption);await p.getByRole('button',{name:'Upload photo',exact:true}).click();await expect(p.getByText('Photo saved and retained.',{exact:true})).toBeVisible({timeout:60000})
   }
   await p.reload();await expect(p.getByRole('img',{name:caption,exact:true}).first()).toBeVisible();await expect.poll(()=>p.getByRole('img',{name:caption,exact:true}).evaluateAll(es=>es.length>0&&es.every(i=>i.complete&&i.naturalWidth>0)),{timeout:30000}).toBe(true)
   assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await p.screenshot({path:dir+'/'+device+'-draft.png',fullPage:true})
   console.log('STEP: '+device+' finalizing');await p.getByRole('button',{name:'4. Review',exact:true}).click();await p.getByRole('checkbox').check();await p.getByRole('button',{name:'Finalize report',exact:true}).click();await expect(p.getByRole('heading',{name:'Your finalized report',exact:true})).toBeVisible({timeout:60000})
  }
  console.log('STEP: '+device+' generating PDF');await expect(p.getByRole('button',{name:'Open PDF',exact:true})).toBeEnabled({timeout:30000});await p.getByRole('button',{name:'Open PDF',exact:true}).click()
  const download=p.getByRole('button',{name:'Download PDF',exact:true});await expect(download).toBeVisible({timeout:90000});const wait=p.waitForEvent('download');await download.click();const d=await wait;await d.saveAs(dir+'/'+device+'.pdf');const bytes=readFileSync(dir+'/'+device+'.pdf');assert.equal(bytes.subarray(0,5).toString(),'%PDF-');state[device+'Pdf']={bytes:bytes.length,sha256:hash(bytes)};save()
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await p.screenshot({path:dir+'/'+device+'-final.png',fullPage:true});await c.close()
 })
 await check('Outsider cannot retrieve retained photos or PDFs',async()=>{
  const c=await browser.newContext(contextOptions);await login(c,env.STAGING_OUTSIDER_EMAIL,env.STAGING_OUTSIDER_PASSWORD)
  for(const path of ['/evidence/'+retained.photoId,'/exports/'+retained.exportId])assert.equal((await c.request.get(origin+'/api/reports/'+retained.reportId+path)).status(),404)
  await c.close()
 })
 await check('Existing worker and supervisor sign in with verified email',async()=>{
  for(const role of ['WORKER','SUPERVISOR']){const client=make();const auth=await client.auth.signInWithPassword({email:env['STAGING_'+role+'_EMAIL'],password:env['STAGING_'+role+'_PASSWORD']});assert.equal(auth.error,null);assert.ok(auth.data.user.email_confirmed_at);const c=await browser.newContext(contextOptions);await login(c,env['STAGING_'+role+'_EMAIL'],env['STAGING_'+role+'_PASSWORD']);await c.close()}
 })
 state.status='PASS';state.nextStep='Verify staging Auth settings, hosted email recovery, and inspect rendered PDF artifacts';save()
}catch(error){state.status='FAIL';state.failure={name:error.name,code:error.code,lines:[...(error.stack||'').matchAll(/hosted-acceptance\.mjs:(\d+)/g)].map(m=>Number(m[1]))};if(workflowPage&&!workflowPage.isClosed()){state.failure.path=new URL(workflowPage.url()).pathname;await workflowPage.screenshot({path:dir+'/failure-'+Date.now()+'.png',fullPage:true}).catch(()=>{});state.failure.alerts=await workflowPage.locator('main [role=alert]').allTextContents().catch(()=>[])}save();console.error('FAIL: '+state.nextStep+'; '+error.name+'; lines '+state.failure.lines.join(','));process.exitCode=1}
finally{await browser?.close()}
