import {navigationDiagnostic} from './navigation-diagnostic.mjs'
import {holdClientScripts} from './hold-client-scripts.mjs'
import {browserFailure} from '../../scripts/ci/browser-failure.mjs'
import {mkdirSync,writeFileSync} from 'node:fs'
import {expect as baseExpect} from '@playwright/test'
import {randomUUID,randomBytes} from 'node:crypto'
import {expectSuccess,expectDatabaseError} from '../../scripts/staging/assertions.mjs'
const expect=baseExpect.configure({timeout:30000})
export async function dailyBriefWorkflow({browser,origin,actors,options={},capture=async()=>{},record=()=>{}}){
 const company=randomUUID(),other=randomUUID(),tag='SYNTHETIC daily brief '+company.slice(0,6),contexts=[]
 let stage='setup',releaseCrewSave=()=>{},removeCrewRoute=async()=>{},crewSaveTask=null,crewSaveFailure=null,crewPage=null,failure=null,diagnostic=null
 const command=(role,command,p={})=>actors[role].client.rpc('ts_command',{command,p:{companyId:company,requestId:randomUUID(),...p}}).then(expectSuccess)
 const brief=(role,command,p={})=>actors[role].client.rpc('ts_brief_command',{command,p:{companyId:company,requestId:randomUUID(),...p}}).then(expectSuccess)
 const query=(role,table,id,column='brief_id')=>actors[role].client.from(table).select('*').eq(column,id).then(expectSuccess)
 async function login(role){
  const {localOnly,...settings}=options,context=await browser.newContext({viewport:{width:390,height:844},...settings});contexts.push(context)
  if(localOnly)await context.route('**/*',route=>[origin,actors[role].apiOrigin].includes(new URL(route.request().url()).origin)?route.continue():route.abort())
  const page=await context.newPage();page.setDefaultTimeout(30000);page.setDefaultNavigationTimeout(90000)
  await page.goto(origin+'/auth/login');await page.getByLabel('Email',{exact:true}).fill(actors[role].email);await page.getByLabel('Password',{exact:true}).fill(actors[role].password);await page.getByRole('button',{name:'Sign In',exact:true}).click();await page.waitForURL('**/dashboard');return page
 }
 const saved=page=>expect(page.locator('.save-state')).toHaveText(/^Saved(?: to server)?$/)
 try{
  await command('OWNER','create_company',{id:company,name:tag});await command('OWNER','create_company',{id:other,name:tag+' other'})
  for(const role of ['WORKER','SUPERVISOR']){const token=randomBytes(32).toString('hex');await command('OWNER','invite',{email:actors[role].email,role:role.toLowerCase(),token});await command(role,'accept_invitation',{token})}
  const worker=await login('WORKER'),context=worker.context(),supervisor=await login('SUPERVISOR'),api=origin+'/api/briefs'
  await worker.goto(origin+'/dashboard?company='+company);await worker.getByRole('link',{name:'Open daily site briefs',exact:true}).click()
  await worker.getByRole('button',{name:'Start daily brief',exact:true}).click();await worker.waitForURL(/\/briefs\/[a-f0-9-]{36}$/)
  const id=new URL(worker.url()).pathname.split('/').at(-1),read=async()=> (await query('OWNER','ts_briefs',id,'id'))[0]
  await worker.getByLabel('Site name or address',{exact:true}).fill(tag)
  await worker.getByLabel('Work date',{exact:true}).fill('2026-09-21')
  await worker.getByLabel('Jurisdiction',{exact:true}).selectOption('CA-ON');await worker.getByLabel('Workplace context',{exact:true}).selectOption('construction')
  await worker.getByLabel('I have checked the jurisdiction and workplace context for this record.',{exact:true}).check();await saved(worker)
  await worker.reload();await expect(worker.getByLabel('Site name or address',{exact:true})).toHaveValue(tag)
  // Begin with an actual user interaction after reload so Chromium has activated the field.
  // Keep the keyboard destination and visible-focus assertions, rather than weakening them.
  await worker.getByLabel('Site name or address',{exact:true}).click()
  await expect(worker.getByLabel('Site name or address',{exact:true})).toBeFocused()
  await worker.keyboard.press('Tab');await expect(worker.getByLabel('Work date',{exact:true})).toBeFocused()
  expect(await worker.getByLabel('Work date',{exact:true}).evaluate(e=>getComputedStyle(e).outlineStyle)).toBe('solid')
  await worker.getByRole('button',{name:'Continue',exact:true}).click();await expect(worker.locator('#brief-step')).toBeFocused()
  // Crew controls must remain disabled until the actual client handlers attach.
  // Opening a slow-loading page must not accept selections and then erase them.
  stage='crew-hydration'
  const hydration=await holdClientScripts(worker,origin)
  let hydrationFailure=null
  try{
   await worker.reload({waitUntil:'commit'});await expect.poll(hydration.count).toBeGreaterThan(0)
   await expect(worker.getByLabel('Today’s work',{exact:true})).toBeVisible()
   await expect(worker.getByLabel('Today’s work',{exact:true})).toBeDisabled()
   const serverCrew=worker.locator('.brief-journey .work-fieldset input[type=checkbox]')
   expect(await serverCrew.count()).toBeGreaterThan(0)
   for(const checkbox of await serverCrew.all())await expect(checkbox).toBeDisabled()
   await hydration.release();await expect(worker.getByLabel('Today’s work',{exact:true})).toBeEditable()
  }catch(error){hydrationFailure=error;throw error}finally{try{await hydration.release()}catch(error){if(!hydrationFailure)throw error}}
  // Keep the first real save response in flight while selecting crew. Inputs must
  // remain usable, and that older response must not erase the later selections.
  stage='crew-save-barrier';crewPage=worker
  let crewSaveHeld=false
  const crewSaveReleased=new Promise(resolve=>{releaseCrewSave=resolve})
  const holdCrewSave=async route=>{
   if(route.request().postDataJSON()?.command!=='save'||crewSaveHeld)return route.continue()
   crewSaveHeld=true
   crewSaveTask=(async()=>{const response=await route.fetch();expect(response.status()).toBe(200);await crewSaveReleased;await route.fulfill({response})})().catch(error=>{crewSaveFailure=error})
   await crewSaveTask
  }
  await context.route(api,holdCrewSave)
  removeCrewRoute=()=>context.unroute(api,holdCrewSave)
  await worker.getByLabel('Today’s work',{exact:true}).fill('SYNTHETIC material movement')
  await expect.poll(()=>crewSaveHeld).toBe(true);await expect(worker.locator('.save-state')).toHaveText('Saving')
  await worker.getByLabel('Responsible site contact',{exact:true}).fill('SYNTHETIC contact via local radio')
  const members=expectSuccess(await actors.OWNER.client.from('ts_members').select('*').eq('company_id',company)),name=role=>members.find(m=>m.user_id===actors[role].id).display_name
  await worker.evaluate(()=>{
   window.__briefCrewEvents=[]
   for(const type of ['pointerdown','pointerup','click','input','change'])document.addEventListener(type,event=>{
    const controls=Array.from(document.querySelectorAll('.brief-journey .work-fieldset input[type=checkbox]')),index=controls.indexOf(event.target)
    if(index>=0&&window.__briefCrewEvents.length<30)window.__briefCrewEvents.push({type,index,checked:event.target.checked,disabled:event.target.matches(':disabled'),trusted:event.isTrusted})
   },true)
  })
  const workerCrew=worker.getByRole('checkbox',{name:name('WORKER'),exact:true}),supervisorCrew=worker.getByRole('checkbox',{name:name('SUPERVISOR'),exact:true})
  stage='crew-worker-check';await expect(workerCrew).toBeEnabled();await workerCrew.check();await expect(workerCrew).toBeChecked()
  stage='crew-supervisor-check';await expect(supervisorCrew).toBeEnabled();await supervisorCrew.check();await expect(supervisorCrew).toBeChecked()
  stage='crew-save-response';releaseCrewSave();await crewSaveTask;if(crewSaveFailure)throw crewSaveFailure;await saved(worker);await removeCrewRoute()
  await expect(workerCrew).toBeChecked();await expect(supervisorCrew).toBeChecked()
  const crewSaved=await read()
  expect(crewSaved.document.crew.slice().sort()).toEqual([actors.WORKER.id,actors.SUPERVISOR.id].sort())
  expect(crewSaved.document.contact).toBe('SYNTHETIC contact via local radio')
  stage='crew-saved'
  await worker.getByRole('button',{name:'Continue',exact:true}).click()
  const promptSummary=worker.getByText('Task prompts and sources',{exact:true})
  await promptSummary.click();await expect(worker.getByLabel('Suggested task prompts',{exact:true})).toBeVisible()
  await worker.getByLabel('Suggested task prompts',{exact:true}).selectOption('plumbing-materials-ground');await saved(worker)
  const titles=['Check the route and destination','Reduce handling effort','Keep materials stable','Discuss concerns before the move']
  for(const title of titles){
   const toggle=worker.getByText('Why this matters / Source — '+title,{exact:true})
   await toggle.click();await toggle.focus();await expect(toggle).toBeFocused();await worker.keyboard.press('Enter')
   await expect(toggle.locator('..')).not.toHaveAttribute('open','')
   await worker.keyboard.press('Enter');await expect(toggle.locator('..')).toHaveAttribute('open','')
   await expect(toggle.locator('..')).toContainText('Draft content — pending qualified review')
   const links=toggle.locator('..').getByRole('link');expect(await links.count()).toBeGreaterThan(0)
   for(const link of await links.all())expect(await link.getAttribute('href')).toMatch(/^https:\/\/www\.(ontario|ccohs|ihsa)\.ca\//)
  }
  await capture(worker,'sources')
  const reviewPage=await context.newPage();await reviewPage.goto(origin+'/brief-content?company='+company+'&version=on-plumbing-materials-2026-09-21-v1')
  await expect(reviewPage.getByText('No qualified review decision has been recorded. All proposed wording remains draft.',{exact:true})).toBeVisible()
  await expect(reviewPage.getByRole('button',{name:'Record review decision',exact:true})).toHaveCount(0);await reviewPage.close()
  const reviewDenied=await context.request.post(origin+'/api/brief-content/review',{headers:{origin,'x-expected-actor':actors.WORKER.id},data:{version:'on-plumbing-materials-2026-09-21-v1',state:'reviewed',expectedState:'draft',decisionRef:'SYNTHETIC unauthorized attempt',notes:'Must fail',requestId:randomUUID()}});expect(reviewDenied.status()).toBe(403)
  await promptSummary.click();await worker.getByRole('button',{name:'Add task step and hazard',exact:true}).click()
  await expect(worker.getByLabel('Hazard or concern',{exact:true})).toHaveValue('')
  await worker.getByLabel('Task step',{exact:true}).fill('Move synthetic material')
  await worker.getByLabel('Hazard or concern',{exact:true}).fill('SYNTHETIC trip concern')
  await worker.getByLabel('Control or precaution',{exact:true}).fill('Propose clearing synthetic route')
  await worker.getByLabel('Responsible for this control',{exact:true}).selectOption(actors.SUPERVISOR.id);await saved(worker)
  expect((await read()).document.steps[0].controlState).toBe('proposed')
  // Simulated connection loss BEFORE commit. The real server record remains unchanged.
  await context.route(api,route=>route.request().postDataJSON()?.command==='save'?route.abort():route.continue())
  await worker.getByLabel('Control or precaution',{exact:true}).fill('SYNTHETIC route now reported clear')
  await expect(worker.getByRole('button',{name:'Retry saving',exact:true})).toBeVisible()
  expect((await read()).document.steps[0].control).toBe('Propose clearing synthetic route')
  await expect(worker.getByLabel('Control or precaution',{exact:true})).toHaveValue('SYNTHETIC route now reported clear')
  await context.unroute(api);await worker.getByRole('button',{name:'Retry saving',exact:true}).click();await saved(worker)
  await worker.getByLabel('Control status',{exact:true}).selectOption('reported_implemented');await saved(worker)
  await worker.getByRole('button',{name:'Back',exact:true}).click();await worker.getByRole('button',{name:'Continue',exact:true}).click();await expect(worker.getByLabel('Control or precaution',{exact:true})).toHaveValue('SYNTHETIC route now reported clear')
  await worker.reload();await expect(worker.getByLabel('Control status',{exact:true})).toHaveValue('reported_implemented')
  await capture(worker,'hazards');expect(await worker.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
  await worker.getByRole('button',{name:'Continue',exact:true}).click()
  await worker.getByLabel('What was discussed in the briefing?',{exact:true}).fill('SYNTHETIC discussion of route, residual concern and responsible contact')
  await worker.getByRole('checkbox',{name:name('WORKER'),exact:true}).check();await saved(worker)
  expect((await read()).document.briefingNote).toBe('SYNTHETIC discussion of route, residual concern and responsible contact')
  // Simulated lost response AFTER a real commit. Retrying must recover the same version/actions.
  let lost=false
  await context.route(api,async route=>{if(route.request().postDataJSON()?.command==='record'&&!lost){lost=true;const response=await route.fetch();expect(response.status()).toBe(200);await route.abort()}else await route.continue()})
  await worker.getByRole('button',{name:'Record briefing version',exact:true}).click();await expect(worker.getByRole('button',{name:'Retry recording briefing',exact:true})).toBeVisible()
  expect((await read()).lifecycle).toBe('recorded')
  await worker.getByRole('button',{name:'Retry recording briefing',exact:true}).click();await expect(worker.getByRole('heading',{name:'Authenticated acknowledgements',exact:false})).toBeVisible();await context.unroute(api)
  const first=(await query('OWNER','ts_brief_versions',id))[0],firstVersion=first.version,itemId=first.snapshot.document.steps[0].id
  expect(first.snapshot.content.version).toBe('on-plumbing-materials-2026-09-21-v1');expect(first.snapshot.content.state).toBe('draft');expect(first.snapshot.content.payload.prompts).toHaveLength(4)
  expect(await query('OWNER','ts_actions',id)).toHaveLength(1);expect((await query('OWNER','ts_actions',id))[0].responsible_id).toBe(actors.WORKER.id);expect(await query('OWNER','ts_brief_acknowledgements',id)).toHaveLength(0)
  expect(first.attendance).toEqual([actors.WORKER.id])
  await expect(worker.getByRole('button',{name:'Record supervisor review of control 1',exact:true})).toHaveCount(0)
  const denied=await context.request.post(api,{headers:{origin,'x-expected-actor':actors.WORKER.id},data:{command:'review_control',payload:{companyId:company,id,version:firstVersion,itemId,requestId:randomUUID()}}})
  expect(denied.status()).toBe(403)
  await worker.getByRole('button',{name:'Acknowledge this version',exact:true}).click();await expect(worker.getByRole('status').filter({hasText:'Your acknowledgement is recorded'})).toBeVisible()
  await supervisor.goto(origin+'/briefs/'+id);await supervisor.getByRole('button',{name:'Record supervisor review of control 1',exact:true}).click();await expect(supervisor.getByText('Review recorded by',{exact:false})).toBeVisible()
  expect(await query('OWNER','ts_brief_reviews',id)).toHaveLength(1)
  await worker.reload();await worker.getByRole('button',{name:'Revise brief',exact:true}).click();await expect(worker.getByLabel('Site name or address',{exact:true})).toHaveValue(tag)
  expect((await read()).document.attendance).toEqual([])
  await worker.getByRole('button',{name:'3. Hazards and controls',exact:true}).click()
  await worker.getByLabel('Control or precaution',{exact:true}).fill('SYNTHETIC revised control, needs fresh briefing');await saved(worker)
  await worker.getByRole('button',{name:'Continue',exact:true}).click();await worker.getByLabel('What was discussed in the briefing?',{exact:true}).fill('SYNTHETIC revised briefing');await saved(worker)
  expect((await read()).document.briefingNote).toBe('SYNTHETIC revised briefing')
  expect((await read()).document.steps[0].control).toBe('SYNTHETIC revised control, needs fresh briefing')
  await worker.getByRole('button',{name:'Record briefing version',exact:true}).click()
  await expect(worker.getByRole('button',{name:'Acknowledge this version',exact:true})).toBeVisible()
  const secondVersion=(await read()).revision;expect(secondVersion).toBeGreaterThan(firstVersion)
  expect((await query('OWNER','ts_brief_versions',id)).find(v=>v.version===firstVersion)).toEqual(first)
  expect((await query('OWNER','ts_brief_acknowledgements',id)).every(a=>a.version===firstVersion)).toBe(true)
  expect((await query('OWNER','ts_brief_reviews',id)).every(r=>r.version===firstVersion)).toBe(true)
  expect(await query('OWNER','ts_actions',id)).toHaveLength(1)
  await expect(worker.getByText('No worker acknowledgements recorded for this version.',{exact:true})).toBeVisible()
  const exported=await context.request.get(origin+'/api/briefs/'+id+'/export?version='+secondVersion)
  expect(exported.status()).toBe(200);const html=await exported.text()
  for(const text of ['on-plumbing-materials-2026-09-21-v1','material-route','https://www.ontario.ca/laws/regulation/910213','currency through 2026-09-16','No qualified review decision recorded.'])expect(html).toContain(text)
  for(const text of [tag,'SYNTHETIC revised control','SYNTHETIC revised briefing','DRAFT SAFETY CONTENT','None recorded; saving did not notify anyone','Follow-up status at export'])expect(html).toContain(text)
  await capture(worker,'recorded')
  record('draft/reload, simulated interrupted save, lost recording response recovery, version-bound acknowledgement and supervisor review, export PASS',{company,briefId:id,firstVersion,secondVersion})
  await worker.getByRole('link',{name:'Open follow-up action',exact:true}).click()
  const action=(await query('OWNER','ts_actions',id))[0],card=worker.locator('#action-'+action.id)
  const originalLink=new URL(await card.getByRole('link',{name:'Open original hazard and control',exact:true}).getAttribute('href'),origin)
  expect(originalLink.pathname).toBe('/briefs/'+id);expect(originalLink.searchParams.get('version')).toBe(String(firstVersion));expect(originalLink.hash).toBe('#hazard-'+itemId);expect(originalLink.searchParams.get('from')).toContain('/actions?company='+company)
  await card.getByLabel('Status after saving',{exact:true}).selectOption('awaiting_verification');await card.getByLabel('Progress or resolution notes',{exact:true}).fill('SYNTHETIC follow-up ready for review');await card.getByRole('button',{name:'Request verification',exact:true}).click();await expect(card.getByRole('status').filter({hasText:'Action update saved.'})).toBeVisible()
  await worker.reload();await expect(card.locator('.action-progress')).toContainText('SYNTHETIC follow-up ready for review')
  await supervisor.goto(origin+'/actions?company='+company+'&mine=0&status=all&focus='+action.id)
  const review=supervisor.locator('#action-'+action.id)
  await review.getByLabel('Status after saving',{exact:true}).click()
  await review.getByLabel('Status after saving',{exact:true}).selectOption('closed')
  await review.getByRole('button',{name:'Verify and close',exact:true}).click()
  await expect(review.getByRole('status').filter({hasText:'Action update saved.'})).toBeVisible()
  expect((await query('OWNER','ts_brief_versions',id)).find(v=>v.version===firstVersion)).toEqual(first)
  // A native select must not accept an entry before React's change handler exists.
  // Inspect the actual server-rendered form without executing browser scripts.
  const {localOnly:reuseLocalOnly,...reuseSettings}=options
  const unhydrated=await browser.newContext({...reuseSettings,storageState:await context.storageState(),javaScriptEnabled:false});contexts.push(unhydrated)
  if(reuseLocalOnly)await unhydrated.route('**/*',r=>[origin,actors.WORKER.apiOrigin].includes(new URL(r.request().url()).origin)?r.continue():r.abort())
  const initial=await unhydrated.newPage();await initial.goto(origin+'/briefs?company='+company)
  await expect(initial.locator('#reuse-site')).toBeDisabled()
  await expect(initial.locator('form:has(#reuse-site) button')).toBeDisabled()
  await unhydrated.close();contexts.pop()
  await worker.goto(origin+'/briefs?company='+company);await worker.getByLabel('Reuse site details (optional)',{exact:true}).selectOption(id);await worker.getByRole('button',{name:'Start daily brief',exact:true}).click();await worker.waitForURL(u=>u.pathname.startsWith('/briefs/')&&u.pathname!=='/briefs/'+id)
  await expect(worker.getByLabel('Site name or address',{exact:true})).toBeEditable();await expect(worker.getByLabel('Site name or address',{exact:true})).toHaveValue(tag)
  const reused=(await query('OWNER','ts_briefs',new URL(worker.url()).pathname.split('/').at(-1),'id'))[0]
  expect(reused.document.site).toBe(tag);expect(reused.document.steps).toEqual([]);expect(reused.document.crew).toEqual([]);expect(reused.document.date).toBe('');expect(reused.document.confirmed).toBe(false)
  const privateBrief=await brief('OWNER','create',{companyId:other,id:randomUUID()})
  // loading.jsx streams the shell: Next documents HTTP 200 for a streamed notFound.
  // Require the actual denial view and empty RLS data; API denial below remains HTTP 404.
  const deniedUrl=origin+'/briefs/'+privateBrief.id
  // A streamed Next notFound can replace its own navigation in WebKit. Accept only
  // that same-URL browser interruption; the denial view, RLS and API assertions below remain mandatory.
  try{await worker.goto(deniedUrl,{waitUntil:'domcontentloaded'})}catch(e){if(!e.message.includes('interrupted by another navigation')||worker.url()!==deniedUrl)throw e}
  await expect(worker).toHaveURL(deniedUrl)
  await expect(worker.getByRole('heading',{name:'Page or report not found',exact:true})).toBeVisible()
  expect(await query('WORKER','ts_briefs',privateBrief.id,'id')).toEqual([])
  expect((await context.request.get(origin+'/api/briefs/'+privateBrief.id+'/export?version=1')).status()).toBe(404)
  await command('OWNER','member',{userId:actors.WORKER.id,role:'remove'})
  await worker.goto(origin+'/briefs/'+id)
  await expect(worker.getByRole('heading',{name:'Page or report not found',exact:true})).toBeVisible()
  expect(await query('WORKER','ts_briefs',id,'id')).toEqual([])
  expect((await context.request.get(origin+'/api/briefs/'+id+'/export?version='+firstVersion)).status()).toBe(404)
  expectDatabaseError(await actors.WORKER.client.rpc('ts_brief_command',{command:'acknowledge',p:{companyId:company,id,version:secondVersion,requestId:randomUUID()}}),'TS_denied')
  record('existing Actions progress/reload/verification, original-version preservation, safe site reuse, cross-company and revoked brief/export denial PASS')
 }catch(e){
  failure=e;diagnostic=await navigationDiagnostic(contexts,e)
  diagnostic.stage=stage
  diagnostic.failure=['Clicking the checkbox did not change its state','intercepts pointer events','Element is not attached','strict mode violation','Timeout'].find(text=>(e.message||'').includes(text))||'other'
  try{diagnostic.crew=await crewPage?.evaluate(()=>({events:window.__briefCrewEvents||[],controls:Array.from(document.querySelectorAll('.brief-journey .work-fieldset input[type=checkbox]')).map(e=>({checked:e.checked,disabled:e.matches(':disabled'),connected:e.isConnected})),step:Array.from(document.querySelectorAll('.work-steps button')).findIndex(e=>e.hasAttribute('aria-current'))+1}))}catch{}
  throw e
 }finally{
  releaseCrewSave()
  const routeCleanup=await Promise.allSettled([removeCrewRoute()]);await crewSaveTask
  const cleanup=await Promise.allSettled(contexts.map(context=>context.close())),failed=[...routeCleanup,...cleanup].filter(r=>r.status==='rejected')
  if(crewSaveFailure)failed.unshift({status:'rejected',reason:crewSaveFailure})
  if(diagnostic||failed.length){mkdirSync('test-results',{recursive:true});writeFileSync('test-results/daily-brief-stage.json',JSON.stringify({...diagnostic,stage,cleanup:failed.map(r=>browserFailure(r.reason))}))}
  if(!failure&&failed.length)throw failed[0].reason
 }
}
