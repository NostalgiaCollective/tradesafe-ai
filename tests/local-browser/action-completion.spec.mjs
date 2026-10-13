import {test,expect as baseExpect,devices} from '@playwright/test'
import {createClient} from '@supabase/supabase-js'
import {randomBytes,randomUUID,createHash} from 'node:crypto'
import sharp from 'sharp'
import {mkdirSync} from 'node:fs'
import {API_ORIGIN,APP_ORIGIN,localEnvironment} from '../../scripts/ci/local-environment.mjs'
import {expectSuccess} from '../../scripts/staging/assertions.mjs'
import {prepareConcerns} from '../fixtures/concerns.mjs'
import {getTemplate,buildChecklistState} from '../../lib/domain/templates.ts'
import {emptyElectricalJob} from '../../lib/domain/electrical-job.mjs'
import {todayInZone} from '../../lib/domain/handover.mjs'
import {readPackage} from '../fixtures/operations.mjs'
import {holdClientScripts} from '../fixtures/hold-client-scripts.mjs'
const expect=baseExpect.configure({timeout:30000}),hash=b=>createHash('sha256').update(b).digest('hex')
test('WebKit concern completion: capture, assignment, nonauthor photo retry, supervisor review and retained electrical handover',async({browser})=>{
 localEnvironment({API_URL:process.env.NEXT_PUBLIC_SUPABASE_URL,ANON_KEY:process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,SERVICE_ROLE_KEY:process.env.SUPABASE_SERVICE_ROLE_KEY})
 const config={auth:{persistSession:false,autoRefreshToken:false}},admin=createClient(API_ORIGIN,process.env.SUPABASE_SERVICE_ROLE_KEY,config),actors={},contexts=[]
 for(const role of ['OWNER','WORKER','SUPERVISOR','OUTSIDER']){
  const credentials={email:'completion-'+role.toLowerCase()+'-'+randomUUID()+'@example.test',password:randomBytes(24).toString('base64url')}
  const {user}=expectSuccess(await admin.auth.admin.createUser({...credentials,email_confirm:true})),client=createClient(API_ORIGIN,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,config)
  expectSuccess(await client.auth.signInWithPassword(credentials));actors[role]={...credentials,id:user.id,client,apiOrigin:API_ORIGIN}
 }
 const f=await prepareConcerns(actors,'SYNTHETIC electrical completion',true),date=todayInZone(),origin=APP_ORIGIN
 const rpc=(role,fn,command,p)=>actors[role].client.rpc(fn,{command,p:{companyId:f.company,requestId:randomUUID(),...p}}).then(expectSuccess)
 const rows=(table,key,id)=>actors.OWNER.client.from(table).select('*').eq(key,id).then(expectSuccess)
 async function login(role){const c=await browser.newContext({...devices['iPhone 13']});contexts.push(c);await c.route('**/*',r=>[origin,API_ORIGIN].includes(new URL(r.request().url()).origin)?r.continue():r.abort());const p=await c.newPage();p.setDefaultTimeout(30000);p.setDefaultNavigationTimeout(90000);await p.goto(origin+'/auth/login');await p.getByLabel('Email',{exact:true}).fill(actors[role].email);await p.getByLabel('Password',{exact:true}).fill(actors[role].password);await p.getByRole('button',{name:'Sign In',exact:true}).click();await p.waitForURL('**/dashboard');return p}
 try{
  await rpc('OWNER','ts_electrical_command','save',{siteId:f.siteId,revision:0,document:{...emptyElectricalJob(),workKind:'alteration',scope:'SYNTHETIC kitchen circuit completion'}})
  let report=await rpc('OWNER','ts_site_command','create_report',{id:randomUUID(),siteId:f.siteId,templateId:getTemplate('electrical').id})
  const answers=buildChecklistState('electrical');Object.values(answers).forEach((a,i)=>Object.assign(a,{state:i===0?'attention':'not_applicable',note:'SYNTHETIC test observation',controls:i===0?'SYNTHETIC correction required':''}))
  report=await rpc('OWNER','ts_command','save_report',{id:report.id,revision:report.revision,document:{job:{address:'SYNTHETIC electrical kitchen',client:'SYNTHETIC customer',date},answers}})
  report=await rpc('OWNER','ts_command','finalize',{id:report.id,revision:report.revision,acknowledged:true})
  const original=JSON.stringify((await rows('ts_reports','id',report.id))[0]),worker=await login('WORKER'),supervisor=await login('SUPERVISOR'),owner=await login('OWNER'),outsider=await login('OUTSIDER')
  // The owner records the original concern; the separately assigned worker must
  // evidence the correction without amending or changing that original record.
  await owner.goto(origin+'/sites/'+f.siteId)
  await owner.getByRole('link',{name:'Report a concern',exact:true}).click()
  await owner.getByLabel('What did you observe?',{exact:true}).fill('SYNTHETIC kitchen panel label missing at service visit')
  await owner.getByLabel('Where on this site?',{exact:true}).fill('SYNTHETIC kitchen panel A')
  await owner.getByRole('button',{name:'Save concern draft',exact:true}).click()
  await owner.waitForURL(u=>/^\/concerns\/[a-f0-9-]{36}$/.test(u.pathname))
  const concernId=new URL(owner.url()).pathname.split('/').at(-1)
  const originalImage=await sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="240"><rect width="400" height="240" fill="orange"/><text x="12" y="120" font-size="22">SYNTHETIC MISSING LABEL</text></svg>')).jpeg().toBuffer()
  await owner.getByLabel('Photo file',{exact:true}).setInputFiles({name:'synthetic-original-missing-label.jpg',mimeType:'image/jpeg',buffer:originalImage})
  await owner.getByLabel('Photo caption',{exact:true}).fill('SYNTHETIC original panel missing label')
  await owner.getByRole('button',{name:'Upload photo',exact:true}).click()
  await expect(owner.getByRole('status').filter({hasText:'Photo saved and retained.'})).toBeVisible()
  await owner.getByRole('button',{name:'Submit concern',exact:true}).click()
  await owner.getByRole('link',{name:'View concern and follow-up',exact:true}).click()
  await expect(owner.getByRole('heading',{name:'Original observation',exact:true})).toBeVisible()
  const originalConcern=(await rows('ts_concerns','id',concernId))[0],originalPhotos=await rows('ts_concern_photos','concern_id',concernId)
  expect(originalConcern.author_id).toBe(actors.OWNER.id);expect(originalConcern.lifecycle).toBe('submitted');expect(originalPhotos).toHaveLength(1)
  const originalPhotoUrl=origin+'/api/concerns/'+concernId+'/evidence/'+originalPhotos[0].id,originalPhotoBytes=await(await owner.context().request.get(originalPhotoUrl)).body()
  expect(hash(originalPhotoBytes)).toBe(originalPhotos[0].sha256)
  mkdirSync('test-results/electrical-release-review',{recursive:true})
  await owner.screenshot({path:'test-results/electrical-release-review/connected-original-concern.png',fullPage:true})
  let action=(await rows('ts_actions','concern_id',concernId))[0]
  expect(action.responsible_id).toBe(actors.OWNER.id)
  await supervisor.goto(origin+'/concerns/'+concernId)
  await supervisor.getByRole('link',{name:'Open follow-up action',exact:true}).click()
  const assignment=supervisor.locator('#action-'+action.id)
  await expect(assignment.getByLabel('Status after saving',{exact:true})).toBeEnabled()
  await assignment.getByText('Assignment, due date and immediate controls',{exact:true}).click()
  await assignment.getByLabel('Responsible member',{exact:true}).selectOption(actors.WORKER.id)
  await assignment.getByRole('button',{name:'Save progress',exact:true}).click()
  await expect(assignment.getByRole('status').filter({hasText:'Action update saved.'})).toBeVisible()
  action=(await rows('ts_actions','id',action.id))[0]
  expect(action.responsible_id).toBe(actors.WORKER.id);expect(action.concern_id).toBe(concernId)
  await supervisor.screenshot({path:'test-results/electrical-release-review/connected-supervisor-assignment.png',fullPage:true})
  const actionUrl=origin+'/actions?'+new URLSearchParams({company:f.company,focus:action.id,status:'all',site:f.siteId}),api=origin+'/api/actions/'+action.id
  await worker.goto(actionUrl);const card=worker.locator('#action-'+action.id)
  await expect(card.getByRole('heading',{name:'Original finding',exact:true})).toBeVisible()
  await expect(card).toContainText('SYNTHETIC kitchen panel label missing at service visit')
  expect(hash(await(await worker.context().request.get(originalPhotoUrl)).body())).toBe(originalPhotos[0].sha256)
  expect((await outsider.context().request.get(originalPhotoUrl)).status()).toBe(404)

  await card.getByLabel('Completion update notes',{exact:true}).fill('SYNTHETIC label corrected; please review retained photo')
  await worker.keyboard.press('Tab');await expect(card.getByLabel('After recording this update',{exact:true})).toBeFocused()
  await card.getByLabel('After recording this update',{exact:true}).selectOption('awaiting_verification')
  const photo=await sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="240"><rect width="400" height="240" fill="navy"/><text x="20" y="120" fill="white" font-size="24">SYNTHETIC CORRECTED LABEL</text></svg>')).jpeg().withExif({IFD0:{Artist:'Synthetic untrusted metadata'}}).toBuffer()
  let uploadLost=false;await worker.context().route(api+'/evidence',async r=>{if(r.request().method()==='POST'&&!uploadLost){uploadLost=true;expect((await r.fetch({postData:photo})).status()).toBe(200);return r.abort()}return r.continue()})
  await card.getByLabel('Completion photo (optional)',{exact:true}).setInputFiles({name:'synthetic-corrected-label.jpg',mimeType:'image/jpeg',buffer:photo})
  await card.getByLabel('Completion photo caption',{exact:true}).fill('SYNTHETIC corrected panel label')
  await card.getByRole('button',{name:'Upload completion photo',exact:true}).click();await expect(card.getByRole('button',{name:'Retry photo upload',exact:true})).toBeEnabled();await card.getByRole('button',{name:'Retry photo upload',exact:true}).click();await expect(card.getByRole('status').filter({hasText:'Photo uploaded to the server.'})).toBeVisible();await worker.context().unroute(api+'/evidence')
  let submitLost=false;await worker.context().route(api+'/completion-updates',async r=>{if(r.request().method()==='POST'&&!submitLost){submitLost=true;expect((await r.fetch()).status()).toBe(200);return r.abort()}return r.continue()})
  await card.getByRole('button',{name:'Submit completion for verification',exact:true}).click();await expect(card.getByRole('button',{name:'Retry the same completion update',exact:true})).toBeEnabled();await expect(card.getByLabel('Completion update notes',{exact:true})).toHaveValue('SYNTHETIC label corrected; please review retained photo');await card.getByRole('button',{name:'Retry the same completion update',exact:true}).click();await expect(card.getByRole('status').filter({hasText:'Completion update saved to server and awaiting supervisor review.'})).toBeVisible();await worker.context().unroute(api+'/completion-updates')
  const updates=await rows('ts_action_updates','action_id',action.id),photos=await rows('ts_action_photos','action_id',action.id);expect(updates).toHaveLength(1);expect(photos).toHaveLength(1);expect(updates[0].actor_id).toBe(actors.WORKER.id);expect(updates[0].evidence_snapshot[0].id).toBe(photos[0].id);expect((await rows('ts_actions','id',action.id))[0].state).toBe('awaiting_verification')
  const photoUrl=api+'/evidence/'+photos[0].id,retainedPhoto=await(await worker.context().request.get(photoUrl)).body();expect(hash(retainedPhoto)).toBe(photos[0].sha256);expect((await sharp(retainedPhoto).metadata()).exif).toBeUndefined()
  expect((await outsider.context().request.get(photoUrl)).status()).toBe(404)
  const hydration=await holdClientScripts(worker,origin),reads={history:0,pending:0}
  const countRead=req=>{const url=new URL(req.url());if(req.method()==='GET'&&url.pathname==='/api/actions/'+action.id+'/completion-updates')reads.history++;if(req.method()==='GET'&&url.pathname==='/api/actions/'+action.id+'/evidence'&&url.searchParams.has('pending'))reads.pending++}
  worker.on('request',countRead)
  try{
   await worker.reload({waitUntil:'commit'});await expect.poll(hydration.count).toBeGreaterThan(0)
   const history=card.getByText('Recorded completion updates',{exact:true}),pending=card.getByText('Unsubmitted uploads',{exact:true})
   await history.click();await expect(history.locator('..')).toHaveAttribute('open','')
   await pending.click();await expect(pending.locator('..')).toHaveAttribute('open','')
   expect(reads).toEqual({history:0,pending:0})
   await hydration.release()
   await expect(card.getByRole('link',{name:'Completion photo: SYNTHETIC corrected panel label',exact:true})).toBeVisible()
   await expect(card.getByText('No unsubmitted uploads.',{exact:true})).toBeVisible()
   expect(reads).toEqual({history:1,pending:1})
  }finally{await hydration.release();worker.off('request',countRead)}
  expect(await worker.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
  await supervisor.goto(actionUrl);const review=supervisor.locator('#action-'+action.id);await review.getByText('Recorded completion updates',{exact:true}).click();await expect(review.getByRole('link',{name:'Completion photo: SYNTHETIC corrected panel label',exact:true})).toBeVisible();await review.getByLabel('Status after saving',{exact:true}).selectOption('closed');await review.getByRole('button',{name:'Verify and close',exact:true}).click();await expect(review.getByRole('status').filter({hasText:'Action update saved.'})).toBeVisible()
  expect((await rows('ts_actions','id',action.id))[0].verified_by).toBe(actors.SUPERVISOR.id)
  // Bounded PDF preparation remains separate from package generation.
  const packageUrl=origin+'/api/sites/'+f.siteId+'/package',range=new URLSearchParams({start:date,end:date,timezone:'America/Toronto'})
  const preparation=await owner.context().request.get(packageUrl+'?'+range);expect(preparation.status()).toBe(200);expect(JSON.stringify(await preparation.json())).toContain(report.id)
  const pdfResponse=await owner.context().request.post(origin+'/api/reports/'+report.id+'/exports',{headers:{origin,'X-Expected-Actor':actors.OWNER.id},timeout:90000});expect(pdfResponse.status()).toBe(200);const pdf=await pdfResponse.json(),pdfBytes=await(await owner.context().request.get(origin+pdf.download)).body()
  let generation=null,packageLost=false;const generations=[]
  await owner.context().route(packageUrl+'?*',async r=>{if(r.request().method()==='POST'){const id=new URL(r.request().url()).searchParams.get('generation');generations.push(id);if(!packageLost){packageLost=true;generation=id;const committed=await r.fetch({timeout:120000});expect(committed.status()).toBe(200);expect(committed.headers()['x-package-id']).toBe(id);return r.abort()}}return r.continue()})
  await owner.goto(origin+'/sites/'+f.siteId);const panel=owner.getByRole('region',{name:'Evidence package',exact:true});await panel.getByLabel('Package from',{exact:true}).fill(date);await panel.getByLabel('Package through',{exact:true}).fill(date);await panel.getByRole('button',{name:'Download evidence package',exact:true}).click();await expect(panel.getByRole('button',{name:'Retry evidence package',exact:true})).toBeEnabled()
  const downloadPromise=owner.waitForEvent('download');await panel.getByRole('button',{name:'Retry evidence package',exact:true}).click();const download=await downloadPromise,stream=await download.createReadStream(),chunks=[];for await(const chunk of stream)chunks.push(chunk);const archive=Buffer.concat(chunks),parsed=readPackage(archive);expect(generations).toEqual([generation,generation]);await owner.context().unroute(packageUrl+'?*')
  expect(JSON.stringify(parsed.records)).toContain(concernId);expect(JSON.stringify(parsed.records)).toContain(originalPhotos[0].id);expect(Object.values(parsed.files).some(b=>b.equals(originalPhotoBytes))).toBe(true)
  expect(parsed.files['reports/'+report.id+'.pdf']).toEqual(pdfBytes);expect(JSON.stringify(parsed.records)).toContain(updates[0].id);expect(JSON.stringify(parsed.records)).toContain('SYNTHETIC label corrected');expect(Object.values(parsed.files).some(b=>b.equals(retainedPhoto))).toBe(true);expect(Object.values(parsed.files).some(b=>b.toString().includes('SYNTHETIC kitchen circuit completion'))).toBe(true)
  action=(await rows('ts_actions','id',action.id))[0];await rpc('SUPERVISOR','ts_command','update_action',{id:action.id,revision:action.revision,state:'open',responsibleId:action.responsible_id,targetDate:'',priority:action.priority,controls:action.controls,resolution:'SYNTHETIC new review question'})
  const again=await owner.context().request.get(packageUrl+'?generation='+generation);expect(again.status()).toBe(200);expect(await again.body()).toEqual(archive);expect(JSON.stringify((await rows('ts_reports','id',report.id))[0])).toBe(original);expect(await rows('ts_action_updates','action_id',action.id)).toEqual(updates);expect(hash(await(await owner.context().request.get(photoUrl)).body())).toBe(photos[0].sha256);expect((await rows('ts_concerns','id',concernId))[0]).toEqual(originalConcern);expect(await rows('ts_concern_photos','concern_id',concernId)).toEqual(originalPhotos);expect(hash(await(await owner.context().request.get(originalPhotoUrl)).body())).toBe(originalPhotos[0].sha256);expect(await(await owner.context().request.get(origin+pdf.download)).body()).toEqual(pdfBytes)
 }finally{for(const c of contexts)await c.close()}
})
