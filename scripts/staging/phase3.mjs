// Serial, ordinary-session Phase3 verification. Privileged access is isolated to documented fault fixtures.
import { resolve } from 'node:path'
import { mkdirSync,existsSync,readFileSync,writeFileSync } from 'node:fs'
import { parseEnv } from 'node:util'
import { randomUUID,randomBytes } from 'node:crypto'
import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'
import { requireStaging,roles } from './config.mjs'
import { gitIdentity } from './evidence.mjs'
import { expectSuccess as ok,expectDatabaseError as denied } from './assertions.mjs'
import { validateImage,digest,MAX_IMAGE_BYTES } from '../../lib/evidence/images.mjs'
import { getTemplate } from '../../lib/domain/templates.ts'
process.env.PLAYWRIGHT_BROWSERS_PATH=resolve('.staging/browsers')
const {chromium,expect}=await import('@playwright/test')
const config=requireStaging();if(!config)process.exit(2)
const {env}=config,checkpoint='.staging/phase3-verification.json'
const args=process.argv.slice(2);if(args.some(a=>!['--resume','--new-run'].includes(a))||args.length>1)throw Error('Use --resume or --new-run')
let state=existsSync(checkpoint)?JSON.parse(readFileSync(checkpoint,'utf8')):null
if(state&&!args.length){console.error('Existing Phase3 checkpoint: inspect it, then choose --resume or --new-run after reconciling its status.');process.exit(2)}
if(args[0]==='--new-run'&&state?.status!=='PASS')throw Error('Finish or reconcile the previous run before starting new fixtures')
if(!state||args[0]==='--new-run')state={...gitIdentity(),startedAt:new Date().toISOString(),projectRef:env.STAGING_ISOLATED_PROJECT_REF,status:'running',checks:[],ids:{}}
if(state.projectRef!==env.STAGING_ISOLATED_PROJECT_REF)throw Error('Wrong checkpoint project')
state.runs??=[];state.runs.push({...gitIdentity(),at:new Date().toISOString()})
const artifactDirectory='test-results/phase3/'+state.startedAt.replaceAll(':','-')
mkdirSync(artifactDirectory,{recursive:true})
const artifact=(name,bytes)=>{writeFileSync('test-results/phase3/'+name,bytes);writeFileSync(artifactDirectory+'/'+name,bytes)}
const save=()=>{mkdirSync('test-results/staging-runs',{recursive:true});const body=JSON.stringify(state,null,2);writeFileSync(checkpoint,body);writeFileSync('test-results/staging-runs/phase3-'+state.startedAt.replaceAll(':','-')+'.json',body)}
const id=name=>{if(!state.ids[name]){state.ids[name]=randomUUID();save()}return state.ids[name]}
async function check(name,run){if(state.checks.some(c=>c.name===name&&c.status==='PASS'))return;state.nextStep=name;state.status='running';save();await run();state.checks.push({name,status:'PASS',at:new Date().toISOString()});save();console.log('PASS: '+name)}
const clients={},contexts={};let browser
const cmd=async(role,command,p)=>ok(await clients[role].client.rpc('ts_command',{command,p:{companyId:id('company'),requestId:randomUUID(),...p}}))
const read=async(table,key)=>ok(await clients.OWNER.client.from(table).select('*').eq('id',key).single())
const base=rid=>'/api/reports/'+rid
const template=getTemplate('electrical')
const doc=()=>({job:{address:'SYNTHETIC Phase3 evidence site',client:'Synthetic verification only',date:'2026-09-14'},answers:Object.fromEntries(template.items.map((i,n)=>[i.id,{state:n===0?'attention':n===1?'not_applicable':'meets',note:n===0?'SYNTHETIC enclosure damage; retained photographic observation':n===1?'SYNTHETIC item not installed':'',controls:n===0?'SYNTHETIC area isolated':''}]))})
const raw=await sharp({create:{width:1000,height:640,channels:3,background:'#c6d2d8'}}).composite([{input:Buffer.from('<svg width="1000" height="640"><rect x="220" y="70" width="560" height="490" fill="#475569"/><rect x="255" y="100" width="490" height="390" fill="#cbd5e1"/><path d="M270 135 L670 440" stroke="#b91c1c" stroke-width="18"/><text x="280" y="530" font-size="34" fill="white">SYNTHETIC TEST PHOTO</text></svg>')}]).png().toBuffer()
const image=await validateImage(raw)
mkdirSync('test-results/phase3',{recursive:true});writeFileSync('test-results/phase3/synthetic-photo.png',raw)
const meta=(rid,eid,caption)=>({reportId:rid,id:eid,caption,sha256:image.sha256,byteSize:image.byteSize,width:image.width,height:image.height})
const json=async(response,status=200)=>{assert.equal(response.status(),status);return response.json()}
const api=async(role,path,{method='GET',data,headers={}}={})=>contexts[role].request.fetch(env.NEXT_PUBLIC_APP_URL+path,{method,data,headers:{Origin:env.NEXT_PUBLIC_APP_URL,...headers}})
const upload=(role,rid,eid,caption,bytes=raw)=>api(role,base(rid)+'/evidence',{method:'POST',data:bytes,headers:{'Content-Type':'application/octet-stream','X-Evidence-Id':eid,'X-Evidence-Caption':encodeURIComponent(caption)}})
async function login(context,role){const page=await context.newPage();await page.goto(env.NEXT_PUBLIC_APP_URL+'/auth/login');await page.getByLabel('Email',{exact:true}).fill(env['STAGING_'+role+'_EMAIL']);await page.getByLabel('Password',{exact:true}).fill(env['STAGING_'+role+'_PASSWORD']);await page.getByRole('button',{name:'Sign In',exact:true}).click();await page.waitForURL('**/dashboard');return page}
try{
 for(const role of roles){const client=createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});const auth=ok(await client.auth.signInWithPassword({email:env['STAGING_'+role+'_EMAIL'],password:env['STAGING_'+role+'_PASSWORD']}));clients[role]={client,user:auth.user,token:auth.session.access_token}}
 browser=await chromium.launch({headless:true})
 for(const role of ['OWNER','WORKER','OUTSIDER']){contexts[role]=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'block'});await login(contexts[role],role)}
 await check('Existing synthetic users; idempotent scoped Phase3 company and draft',async()=>{
  await cmd('OWNER','create_company',{id:id('company'),name:'SYNTHETIC Phase3 evidence verification'})
  const members=ok(await clients.OWNER.client.from('ts_members').select('*').eq('company_id',id('company')))
  if(!members.some(m=>m.user_id===clients.WORKER.user.id&&m.active)){const token=randomBytes(32).toString('hex');await cmd('OWNER','invite',{email:env.STAGING_WORKER_EMAIL,role:'worker',token});await cmd('WORKER','accept_invitation',{token})}
  await cmd('WORKER','create_report',{id:id('report'),templateId:template.id})
 })
 await check('Invalid and oversized bytes rejected before reservation; direct bypasses denied',async()=>{
  await json(await upload('WORKER',id('report'),id('invalid'),'Invalid image',Buffer.from('<svg/>')),422)
  await json(await upload('WORKER',id('report'),id('oversized'),'Oversized image',Buffer.alloc(MAX_IMAGE_BYTES+1)),422)
  assert.equal(ok(await clients.OWNER.client.from('ts_evidence').select('id').in('id',[id('invalid'),id('oversized')])).length,0)
  denied(await clients.WORKER.client.from('ts_evidence').insert({id:randomUUID()}),'42501')
  denied(await clients.WORKER.client.rpc('ts_complete_evidence',{evidence_id:id('invalid'),actor_id:clients.WORKER.user.id}),'42501')
  denied(await clients.WORKER.client.rpc('ts_evidence_cleanup_candidate',{evidence_id:id('invalid')}),'42501')
  denied(await clients.WORKER.client.rpc('ts_export_job',{command:'begin',p:{reportId:id('report'),attempt:randomUUID()},actor_id:clients.WORKER.user.id}),'42501')
  const malformed=await api('WORKER',base(id('report'))+'/evidence',{method:'POST',data:raw,headers:{'X-Evidence-Id':id('invalid'),'X-Evidence-Caption':'%bad%encoding'}});await json(malformed,400)
 })
 await check('Desktop photo capture, saved feedback, retained preview and draft reload',async()=>{
  const page=await contexts.WORKER.newPage();await page.goto(env.NEXT_PUBLIC_APP_URL+'/report/'+id('report'))
  const existing=ok(await clients.OWNER.client.from('ts_evidence').select('*').eq('report_id',id('report')).eq('caption','SYNTHETIC panel enclosure'))
  if(!existing.length){await page.getByLabel('Photo file',{exact:true}).setInputFiles({name:'../../unsafe-name.png',mimeType:'image/png',buffer:raw});await page.getByLabel('Photo caption',{exact:true}).fill('SYNTHETIC panel enclosure');await page.getByRole('button',{name:'Upload photo',exact:true}).click();await expect(page.getByText('Photo saved and retained.',{exact:true})).toBeVisible()}
  await page.reload();await expect(page.getByRole('img',{name:'SYNTHETIC panel enclosure',exact:true})).toBeVisible()
  const row=ok(await clients.OWNER.client.from('ts_evidence').select('*').eq('report_id',id('report')).eq('caption','SYNTHETIC panel enclosure').single());state.ids.photo=row.id;save()
  assert.equal(row.uploader_id,clients.WORKER.user.id);assert.ok(row.uploaded_at);assert.match(row.object_path,/^[a-f0-9-]+\/[a-f0-9-]+\/[a-f0-9-]+\.jpg$/)
  const downloaded=await api('WORKER',base(id('report'))+'/evidence/'+row.id);assert.equal(downloaded.status(),200);assert.equal(digest(await downloaded.body()),row.sha256)
  await page.screenshot({path:'test-results/phase3/desktop-draft.png',fullPage:true});await page.close()
 })
 await check('Cross-company photos and guessed/direct Storage paths remain private',async()=>{
  const row=await read('ts_evidence',id('photo'))
  await json(await api('OUTSIDER',base(id('report'))+'/evidence/'+row.id),404)
  await json(await upload('OUTSIDER',id('report'),randomUUID(),'Cross company'),404)
  assert.equal(ok(await clients.OUTSIDER.client.from('ts_evidence').select('*').eq('id',row.id)).length,0)
  for(const role of ['OWNER','WORKER','OUTSIDER']){
   const result=await clients[role].client.storage.from('tradesafe-evidence').download(row.object_path);assert.ok(['400','404'].includes(String(result.error?.statusCode)));assert.equal(result.data,null)
   const attempt=await clients[role].client.storage.from('tradesafe-evidence').upload(row.object_path,raw,{upsert:true,contentType:'image/jpeg'});assert.equal(String(attempt.error?.statusCode),'403')
   const signed=await clients[role].client.storage.from('tradesafe-evidence').createSignedUrl(row.object_path,60);assert.ok(['400','404'].includes(String(signed.error?.statusCode)))
   const removed=await clients[role].client.storage.from('tradesafe-evidence').remove([row.object_path]);if(removed.error)assert.equal(String(removed.error.statusCode),'403');else assert.equal(removed.data.length,0)
  }
  const publicRead=await fetch(env.NEXT_PUBLIC_SUPABASE_URL+'/storage/v1/object/public/tradesafe-evidence/'+row.object_path);assert.ok([400,404].includes(publicRead.status))
  assert.equal((await read('ts_evidence',row.id)).sha256,row.sha256)
  const retained=await api('OWNER',base(id('report'))+'/evidence/'+row.id);assert.equal(retained.status(),200);assert.equal(digest(await retained.body()),row.sha256)
 })
 await check('Pending upload blocks concurrent finalization; same-byte retry is durable',async()=>{
  let r=await read('ts_reports',id('report'));if(r.lifecycle==='finalized')return
  const p=meta(r.id,id('pending'),'SYNTHETIC interrupted upload')
  const e=ok(await clients.WORKER.client.rpc('ts_evidence_command',{command:'reserve',p}));assert.equal(e.id,p.id)
  r=await cmd('WORKER','save_report',{id:r.id,revision:r.revision,document:doc()})
  const result=await clients.WORKER.client.rpc('ts_command',{command:'finalize',p:{companyId:id('company'),id:r.id,revision:r.revision,requestId:randomUUID(),acknowledged:true}});denied(result,'TS_evidence_pending')
  await json(await upload('WORKER',r.id,p.id,p.caption));await json(await upload('WORKER',r.id,p.id,p.caption))
  assert.equal((await read('ts_evidence',p.id)).state,'ready')
 })
 await check('Lost upload response reconciles without duplicate evidence',async()=>{
  const rid=id('report'),page=await contexts.WORKER.newPage();await page.goto(env.NEXT_PUBLIC_APP_URL+'/report/'+rid)
  const e=id('lost'),caption='SYNTHETIC lost response'
  await page.route('**/api/reports/'+rid+'/evidence',async route=>{if(route.request().method()==='POST'){await route.fetch();await route.abort('failed')}else await route.continue()})
  const result=await page.evaluate(async({rid,e,caption,bytes})=>{try{await fetch('/api/reports/'+rid+'/evidence',{method:'POST',headers:{'X-Evidence-Id':e,'X-Evidence-Caption':caption},body:new Uint8Array(bytes)});return 'unexpected'}catch{return 'lost'}},{rid,e,caption,bytes:[...raw]});assert.equal(result,'lost')
  await page.unrouteAll({behavior:'wait'});await json(await upload('WORKER',rid,e,caption));assert.equal((await read('ts_evidence',e)).state,'ready');await page.close()
 })
 await check('Upload count, worker permissions and authorized draft removal',async()=>{
  const rid=id('limitReport');await cmd('WORKER','create_report',{id:rid,templateId:template.id})
  for(let n=0;n<10;n++)ok(await clients.WORKER.client.rpc('ts_evidence_command',{command:'reserve',p:meta(rid,id('limit'+n),'Limit fixture '+n)}))
  denied(await clients.WORKER.client.rpc('ts_evidence_command',{command:'reserve',p:meta(rid,id('limitExtra'),'Overflow')}),'TS_evidence_limit')
  await json(await api('WORKER',base(rid)+'/evidence/'+id('limit0'),{method:'DELETE'}))
  assert.equal((await read('ts_evidence',id('limit0'))).state,'removed')
  const own=id('ownerReport');await cmd('OWNER','create_report',{id:own,templateId:template.id});await json(await upload('WORKER',own,id('workerOther'),'Not own report'),403)
  const removeId=id('removeReady'),prior=ok(await clients.OWNER.client.from('ts_evidence').select('state').eq('id',removeId).maybeSingle())
  if(prior?.state!=='removed'){await json(await upload('OWNER',own,removeId,'SYNTHETIC removable draft photo'));const removed=await json(await api('OWNER',base(own)+'/evidence/'+removeId,{method:'DELETE'}));assert.equal(removed.cleanupPending,false)}
  await json(await api('OWNER',base(own)+'/evidence/'+removeId),404);assert.equal((await read('ts_evidence',removeId)).state,'removed')
 })
 await check('Real concurrent upload and finalization serialize without untracked attachments',async()=>{
  const rid=id('raceReport'),eid=id('racePhoto');await cmd('WORKER','create_report',{id:rid,templateId:template.id})
  let r=await read('ts_reports',rid)
  if(r.lifecycle==='draft'){
   ok(await clients.WORKER.client.rpc('ts_evidence_command',{command:'reserve',p:meta(rid,eid,'SYNTHETIC concurrent upload')}))
   r=await cmd('WORKER','save_report',{id:rid,revision:r.revision,document:doc()})
   const [up,final]=await Promise.all([upload('WORKER',rid,eid,'SYNTHETIC concurrent upload'),clients.WORKER.client.rpc('ts_command',{command:'finalize',p:{companyId:id('company'),id:rid,revision:r.revision,acknowledged:true,requestId:randomUUID()}})])
   await json(up)
   if(final.error){denied(final,'TS_evidence_pending');await cmd('WORKER','finalize',{id:rid,revision:r.revision,acknowledged:true})}
  }
  r=await read('ts_reports',rid);assert.equal(r.lifecycle,'finalized');assert.equal(r.evidence_snapshot.length,1);assert.equal(r.evidence_snapshot[0].id,eid)
  await json(await upload('WORKER',rid,eid,'SYNTHETIC replacement'),409)
 })
 await check('Finalization snapshots photos; later mutation rejected; amendments start separate',async()=>{
  let r=await read('ts_reports',id('report'));if(r.lifecycle==='draft')r=await cmd('WORKER','finalize',{id:r.id,revision:r.revision,acknowledged:true})
  assert.equal(r.evidence_snapshot.length,3)
  await json(await upload('WORKER',r.id,id('afterFinal'),'After finalization'),409)
  await json(await api('WORKER',base(r.id)+'/evidence/'+id('photo'),{method:'DELETE'}),409)
  const a=await cmd('WORKER','amend',{id:id('amendment'),amendmentOf:r.id,reason:'SYNTHETIC independent evidence amendment'})
  assert.equal(a.evidence_snapshot,null)
  assert.equal(ok(await clients.WORKER.client.from('ts_evidence').select('id').eq('report_id',a.id)).length,0)
  await json(await upload('WORKER',a.id,id('amendmentPhoto'),'SYNTHETIC amendment photo'))
  assert.deepEqual((await read('ts_reports',r.id)).evidence_snapshot,r.evidence_snapshot)
 })
 await check('Authorized multipage PDF generation, retry identity and private download',async()=>{
  const rid=id('report'),job=await json(await api('WORKER',base(rid)+'/exports',{method:'POST'}));state.ids.export=job.id;save()
  const same=await json(await api('WORKER',base(rid)+'/exports',{method:'POST'}));assert.equal(same.id,job.id)
  const result=await api('WORKER',base(rid)+'/exports/'+job.id);assert.equal(result.status(),200);assert.match(result.headers()['cache-control'],/no-store/)
  const bytes=await result.body();assert.equal(bytes.subarray(0,5).toString(),'%PDF-');artifact('finalized-with-photos.pdf',bytes)
  await json(await api('OUTSIDER',base(rid)+'/exports',{method:'POST'}),404);await json(await api('OUTSIDER',base(rid)+'/exports/'+job.id),404)
  const row=await read('ts_exports',job.id);assert.equal(row.sha256,digest(bytes));assert.ok(row.snapshot.amendments.some(a=>a.id===id('amendment')))
  const anonymous=await browser.newContext()
  try{await json(await anonymous.request.get(env.NEXT_PUBLIC_APP_URL+base(rid)+'/exports/'+job.id),401);await json(await anonymous.request.get(env.NEXT_PUBLIC_APP_URL+base(rid)+'/evidence/'+id('photo')),401)}finally{await anonymous.close()}
  await json(await contexts.WORKER.request.post(env.NEXT_PUBLIC_APP_URL+base(rid)+'/exports',{headers:{Origin:'https://untrusted.example.test'}}),403)
  const direct=await clients.WORKER.client.storage.from('tradesafe-exports').download(row.object_path);assert.ok(['400','404'].includes(String(direct.error?.statusCode)))
  denied(await clients.WORKER.client.from('ts_exports').update({state:'ready'}).eq('id',job.id),'42501')
  denied(await clients.WORKER.client.from('ts_evidence').delete().eq('id',id('photo')),'42501')
 })
 await check('Phone photo capture/review, finalized export and accessible download',async()=>{
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block'});const page=await login(context,'WORKER')
  try{
   const rid=id('phoneReport');await cmd('WORKER','create_report',{id:rid,templateId:template.id});await page.goto(env.NEXT_PUBLIC_APP_URL+'/report/'+rid)
   const existing=ok(await clients.WORKER.client.from('ts_evidence').select('id').eq('report_id',rid))
   if(!existing.length){await page.getByLabel('Photo file',{exact:true}).setInputFiles({name:'synthetic-phone.png',mimeType:'image/png',buffer:raw});await page.getByLabel('Photo caption',{exact:true}).fill('SYNTHETIC phone evidence');await page.getByRole('button',{name:'Upload photo',exact:true}).click();await expect(page.getByText('Photo saved and retained.',{exact:true})).toBeVisible()}
   await page.reload();await expect(page.getByRole('img',{name:'SYNTHETIC phone evidence',exact:true})).toBeVisible()
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
   await page.screenshot({path:'test-results/phase3/phone-evidence.png',fullPage:true})
   let r=await read('ts_reports',rid);if(r.lifecycle==='draft'){r=await cmd('WORKER','save_report',{id:rid,revision:r.revision,document:doc()});await cmd('WORKER','finalize',{id:rid,revision:r.revision,acknowledged:true})}
   await page.reload();const generate=page.getByRole('button',{name:'Generate retained PDF',exact:true});if(await generate.count())await generate.click()
   await expect(page.getByRole('button',{name:'Download retained PDF',exact:true})).toBeVisible({timeout:30000})
   const download=page.waitForEvent('download');await page.getByRole('button',{name:'Download retained PDF',exact:true}).click();await(await download).saveAs('test-results/phase3/phone-export.pdf');artifact('phone-export.pdf',readFileSync('test-results/phase3/phone-export.pdf'))
  }finally{await context.close()}
 })
 await check('Missing object prevents export; interrupted stored upload reconciliation repairs forward',async()=>{
  // ADMIN FAULT SETUP ONLY: mark a synthetic photo ready without writing bytes, to model provider loss.
  // All generation and authorization assertions still use ordinary WORKER sessions.
  const key=parseEnv(readFileSync('.staging/server.env','utf8')).SUPABASE_SERVICE_ROLE_KEY
  const claims=JSON.parse(Buffer.from(key.split('.')[1],'base64url').toString());assert.equal(claims.ref,env.STAGING_ISOLATED_PROJECT_REF)
  const admin=createClient(env.NEXT_PUBLIC_SUPABASE_URL,key,{auth:{persistSession:false,autoRefreshToken:false}})
  const rid=id('missingReport'),eid=id('missingPhoto');await cmd('WORKER','create_report',{id:rid,templateId:template.id})
  let r=await read('ts_reports',rid)
  if(r.lifecycle==='draft'){
   ok(await clients.WORKER.client.rpc('ts_evidence_command',{command:'reserve',p:meta(rid,eid,'SYNTHETIC missing-object fault fixture')}))
   ok(await admin.rpc('ts_complete_evidence',{evidence_id:eid,actor_id:clients.WORKER.user.id}))
   r=await cmd('WORKER','save_report',{id:rid,revision:r.revision,document:doc()});await cmd('WORKER','finalize',{id:rid,revision:r.revision,acknowledged:true})
  }
  const e=await read('ts_evidence',eid),existing=await admin.storage.from('tradesafe-evidence').download(e.object_path)
  if(existing.error){
   const before=ok(await clients.WORKER.client.from('ts_exports').select('*').eq('report_id',rid).maybeSingle())
   if(!before){const attempt=randomUUID();ok(await admin.rpc('ts_export_job',{command:'begin',p:{reportId:rid,attempt},actor_id:clients.WORKER.user.id}));const busy=await json(await api('WORKER',base(rid)+'/exports',{method:'POST'}),409);assert.equal(busy.code,'export_busy');ok(await admin.rpc('ts_export_job',{command:'fail',p:{reportId:rid,attempt,code:'generation_failed'},actor_id:clients.WORKER.user.id}))}
   const failed=await json(await api('WORKER',base(rid)+'/exports',{method:'POST'}),503);assert.equal(failed.code,'evidence_missing');const job=ok(await clients.WORKER.client.from('ts_exports').select('*').eq('report_id',rid).single());assert.equal(job.state,'failed');assert.equal(job.failure_code,'evidence_missing');state.missingFailureObserved=true;save()
   ok(await admin.storage.from('tradesafe-evidence').upload(e.object_path,image.bytes,{contentType:'image/jpeg',upsert:false}))
  }
  assert.equal(state.missingFailureObserved,true);await json(await api('WORKER',base(rid)+'/exports',{method:'POST'}))
  const pendingId=id('storedPending'),ar=id('amendment');const pending=ok(await clients.WORKER.client.rpc('ts_evidence_command',{command:'reserve',p:meta(ar,pendingId,'SYNTHETIC interrupted completion')}))
  const prior=await admin.storage.from('tradesafe-evidence').download(pending.object_path);if(prior.error)ok(await admin.storage.from('tradesafe-evidence').upload(pending.object_path,image.bytes,{contentType:'image/jpeg',upsert:false}))
  await json(await api('WORKER',base(ar)+'/evidence/reconcile',{method:'POST'}));assert.equal((await read('ts_evidence',pendingId)).state,'ready')
 })
 await check('Finalized amendment exports separate photos and leaves original PDF unchanged',async()=>{
  const original=await read('ts_exports',id('export')),rid=id('amendment');let r=await read('ts_reports',rid)
  if(r.lifecycle==='draft')r=await cmd('WORKER','finalize',{id:rid,revision:r.revision,acknowledged:true})
  assert.equal(r.evidence_snapshot.length,2);assert.equal(r.amendment_of,id('report'))
  const job=await json(await api('WORKER',base(rid)+'/exports',{method:'POST'}))
  const download=await api('WORKER',base(rid)+'/exports/'+job.id);assert.equal(download.status(),200);artifact('amendment-with-photos.pdf',await download.body())
  assert.deepEqual(await read('ts_exports',id('export')),original)
 })
 await check('Membership removal revokes photo/export access with the existing browser and JWT',async()=>{
  await cmd('OWNER','member',{userId:clients.WORKER.user.id,role:'remove'})
  await json(await api('WORKER',base(id('report'))+'/evidence/'+id('photo')),404)
  await json(await api('WORKER',base(id('report'))+'/exports/'+id('export')),404)
  await json(await api('WORKER',base(id('report'))+'/exports',{method:'POST'}),404)
  const result=await fetch(env.NEXT_PUBLIC_SUPABASE_URL+'/rest/v1/ts_evidence?report_id=eq.'+id('report'),{headers:{apikey:env.NEXT_PUBLIC_SUPABASE_ANON_KEY,Authorization:'Bearer '+clients.WORKER.token}});assert.equal(result.status,200);assert.deepEqual(await result.json(),[])
 })
 state.status='PASS';state.nextStep='Render and inspect both PDFs, then run Phase2 regressions and quality gates; retain all fixtures.'
}catch(error){state.status='FAIL';state.failureLines=[...(error.stack||'').matchAll(/phase3\.mjs:(\d+)/g)].map(m=>Number(m[1]));console.error('FAIL: '+state.nextStep+'; inspect sanitized checkpoint source lines.');process.exitCode=1}
finally{state.finishedAt=new Date().toISOString();save();for(const context of Object.values(contexts))await context.close();await browser?.close();for(const {client} of Object.values(clients))await client.auth.signOut({scope:'local'}).catch(()=>{})}
