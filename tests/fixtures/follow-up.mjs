import {expect as baseExpect} from '@playwright/test'
import {randomUUID,randomBytes,createHash} from 'node:crypto'
import sharp from 'sharp'
import {getTemplate,buildChecklistState} from '../../lib/domain/templates.ts'
import {expectSuccess,expectDatabaseError} from '../../scripts/staging/assertions.mjs'
const expect=baseExpect.configure({timeout:30000}),hash=value=>createHash('sha256').update(value).digest('hex')

// Actual application + ordinary authorized RPCs. Actors supplied by local CI or existing staging fixtures.
export async function followUpWorkflow({browser,origin,actors,options={},capture=async()=>{},record=()=>{}}){
 const company=randomUUID(),other=randomUUID(),contexts={},pages={},tag='SYNTHETIC Follow-up '+company.slice(0,6)
 const command=async(role,command,p={})=>expectSuccess(await actors[role].client.rpc('ts_command',{command,p:{companyId:company,requestId:randomUUID(),...p}}))
 const update=async(role,action,state,extra={})=>command(role,'update_action',{id:action.id,revision:action.revision,state,responsibleId:action.responsible_id,targetDate:action.target_date||'',controls:action.controls,resolution:action.resolution||'SYNTHETIC prior progress',...extra})
 const rows=async()=>expectSuccess(await actors.OWNER.client.from('ts_actions').select('*').eq('company_id',company).order('id'))
 const current=async id=>(await rows()).find(a=>a.id===id)
 const events=async id=>expectSuccess(await actors.OWNER.client.from('ts_events').select('id').eq('entity_id',id).eq('kind','action_updated'))
 async function login(role){
  const {localOnly,...browserOptions}=options
  const context=contexts[role]=await browser.newContext({viewport:{width:390,height:844},...browserOptions})
  if(localOnly)await context.route('**/*',route=>[origin,new URL(actors[role].apiOrigin).origin].includes(new URL(route.request().url()).origin)?route.continue():route.abort())
  const page=pages[role]=await context.newPage();page.setDefaultTimeout(30000);page.setDefaultNavigationTimeout(90000)
  await page.goto(origin+'/auth/login');await page.getByLabel('Email',{exact:true}).fill(actors[role].email);await page.getByLabel('Password',{exact:true}).fill(actors[role].password);await page.getByRole('button',{name:'Sign In',exact:true}).click();await page.waitForURL('**/dashboard');return page
 }
 async function report(role,n,companyId=company){
  let r=await command(role,'create_report',{companyId,id:randomUUID(),templateId:getTemplate('electrical').id})
  const answers=buildChecklistState('electrical');Object.values(answers).forEach((a,i)=>Object.assign(a,{state:i<n?'attention':'meets',note:i<n?'SYNTHETIC finding '+(i+1):''}))
  r=await command(role,'save_report',{companyId,id:r.id,revision:r.revision,document:{job:{address:tag+' '+role,client:'Synthetic follow-up',date:'2026-09-20'},answers}});return r
 }
 try{
  await command('OWNER','create_company',{id:company,name:tag});await command('OWNER','create_company',{id:other,name:tag+' other'})
  for(const role of ['WORKER','SUPERVISOR']){const token=randomBytes(32).toString('hex');await command('OWNER','invite',{email:actors[role].email,role:role.toLowerCase(),token});await command(role,'accept_invitation',{token})}
  record('fixtures',{company,other})
  const worker=await login('WORKER'),supervisor=await login('SUPERVISOR'),owner=await login('OWNER')
  let original=await report('WORKER',18),second=await report('OWNER',10)
  const privateReport=await report('OWNER',1,other);await command('OWNER','finalize',{companyId:other,id:privateReport.id,revision:privateReport.revision,acknowledged:true})
  const reportId=original.id,base=origin+'/api/reports/'+reportId
  await worker.goto(origin+'/report/'+reportId+'?step=3')
  const photo=await sharp(Buffer.from('<svg width="800" height="600"><rect width="800" height="600" fill="#173d5a"/><path d="M400 60L210 500H590Z" fill="#ff8800"/><text x="40" y="560" fill="white" font-size="30">SYNTHETIC FOLLOW-UP CONE</text></svg>')).jpeg().toBuffer()
  await worker.getByLabel('Photo file',{exact:true}).setInputFiles({name:'SYNTHETIC-follow-up-cone.jpg',mimeType:'image/jpeg',buffer:photo});await worker.getByLabel('Photo caption',{exact:true}).fill('SYNTHETIC original cone finding');await worker.getByRole('button',{name:'Upload photo',exact:true}).click();await expect(worker.getByRole('status').filter({hasText:'Photo saved and retained.'})).toBeVisible()
  original=await command('WORKER','finalize',{id:reportId,revision:original.revision,acknowledged:true});await command('OWNER','finalize',{id:second.id,revision:second.revision,acknowledged:true})
  const originals=await rows(),mine=originals.filter(a=>a.responsible_id===actors.WORKER.id),crew=originals.filter(a=>a.responsible_id===actors.OWNER.id),action=mine[0],id=action.id
  await update('OWNER',action,'open',{targetDate:'2026-09-01'});await update('OWNER',mine[1],'awaiting_verification');await update('OWNER',mine[2],'closed');await update('OWNER',crew[0],'awaiting_verification');await update('OWNER',crew[1],'closed')
  const evidence=await(await contexts.WORKER.request.get(base+'/evidence')).json(),photoId=evidence[0].id,photoHash=hash(await(await contexts.WORKER.request.get(base+'/evidence/'+photoId)).body())
  const exported=await contexts.WORKER.request.post(base+'/exports',{headers:{origin},timeout:90000});expect(exported.status()).toBe(200);const exportId=(await exported.json()).id,pdfHash=hash(await(await contexts.WORKER.request.get(base+'/exports/'+exportId)).body())
  const locked=expectSuccess(await actors.OWNER.client.from('ts_reports').select('*').eq('id',reportId).single())
  record('prepared',{reportId,actionId:id,photoId,exportId,photoHash,pdfHash})
  await worker.goto(origin+'/dashboard?company='+company);await expect(worker.getByRole('heading',{name:'Outstanding actions',exact:true})).toBeVisible();await expect(worker.getByRole('link',{name:'17 outstanding actions',exact:true})).toBeInViewport();await expect(worker.getByRole('link',{name:'16 Needs attention',exact:true})).toBeVisible();await expect(worker.getByRole('link',{name:'1 Awaiting verification',exact:true})).toBeVisible();await capture(worker,'dashboard-worker')
  await supervisor.goto(origin+'/dashboard?company='+company);await expect(supervisor.getByRole('link',{name:'24 Needs attention',exact:true})).toBeVisible();await expect(supervisor.getByRole('link',{name:'2 Awaiting verification',exact:true})).toBeVisible()
  await supervisor.getByRole('link',{name:'View crew actions',exact:true}).click();await expect(supervisor.getByRole('status').filter({hasText:'26 matching actions'})).toBeVisible();await expect(supervisor.locator('.action-card')).toHaveCount(25);await supervisor.getByRole('link',{name:'Next actions',exact:true}).click();await expect(supervisor.locator('.action-card')).toHaveCount(1)
  await owner.goto(origin+'/actions?company='+company+'&mine=0&status=closed');await expect(owner.getByRole('status').filter({hasText:'2 matching actions'})).toBeVisible()
  await owner.getByLabel('Whose actions?',{exact:true}).selectOption('1');await owner.getByRole('button',{name:'Show actions',exact:true}).click();await expect(owner.getByRole('status').filter({hasText:'1 matching action.'})).toBeVisible()
  await supervisor.goto(origin+'/actions?company='+company);await expect(supervisor.getByRole('heading',{name:'No matching actions assigned to you',exact:true})).toBeVisible()
  await worker.getByRole('link',{name:'16 Needs attention',exact:true}).click();await expect(worker.getByRole('status').filter({hasText:'16 matching actions'})).toBeVisible();const card=worker.locator('#action-'+id)
  await card.getByText('Update progress',{exact:true}).click();await card.getByRole('link',{name:'Open original observation',exact:true}).click();await expect(worker.locator('#observation-'+action.item_id)).toContainText(action.observation);await worker.getByRole('link',{name:'Back to actions',exact:true}).click();await expect(card).toBeFocused();await expect(card.locator('.action-editor')).toHaveAttribute('open','');expect(new URL(worker.url()).searchParams.get('status')).toBe('attention');await expect(worker.getByLabel('Whose actions?',{exact:true})).toHaveValue('1')
  await card.getByLabel('Status after saving',{exact:true}).focus();await worker.keyboard.press('Tab');await expect(card.getByLabel('Progress or resolution notes',{exact:true})).toBeFocused();expect(await card.getByLabel('Progress or resolution notes',{exact:true}).evaluate(e=>getComputedStyle(e).outlineStyle)).toBe('solid');expect(await worker.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
  await expect(card.getByLabel('Status after saving',{exact:true}).locator('option[value="closed"]')).toHaveCount(0);await expect(card.getByLabel('Responsible member',{exact:true})).toHaveCount(0)
  record('counts, server filters, pagination, scoped roles, return focus and keyboard PASS')
  const countBefore=(await events(id)).length,url=origin+'/api/workspace'
  await card.getByLabel('Status after saving',{exact:true}).selectOption('in_progress');await card.getByLabel('Progress or resolution notes',{exact:true}).fill('SYNTHETIC cover isolated; replacement underway')
  await contexts.WORKER.route(url,route=>route.request().postDataJSON()?.command==='update_action'?route.abort():route.continue())
  await card.getByRole('button',{name:'Save progress',exact:true}).click();await expect(card.getByRole('button',{name:'Retry action update',exact:true})).toBeEnabled();await expect(card.getByLabel('Progress or resolution notes',{exact:true})).toHaveValue('SYNTHETIC cover isolated; replacement underway');expect((await events(id)).length).toBe(countBefore)
  await contexts.WORKER.unroute(url);await card.getByRole('button',{name:'Retry action update',exact:true}).click();await expect(card.getByRole('status').filter({hasText:'Action update saved.'})).toBeVisible();await worker.reload();await expect(card.locator('.action-progress')).toContainText('replacement underway');expect((await events(id)).length).toBe(countBefore+1)
  const requestIds=[];let lost=false
  await contexts.WORKER.route(url,async route=>{const d=route.request().postDataJSON();if(d.command==='update_action'){requestIds.push(d.payload.requestId);if(!lost){lost=true;expect((await route.fetch()).status()).toBe(200);return route.abort()}}return route.continue()})
  await card.getByLabel('Status after saving',{exact:true}).selectOption('awaiting_verification');await card.getByLabel('Progress or resolution notes',{exact:true}).fill('SYNTHETIC cover replaced; ready for supervisor')
  await card.getByRole('button',{name:'Request verification',exact:true}).evaluate(b=>{b.click();b.click()});await expect(card.getByRole('button',{name:'Retry action update',exact:true})).toBeEnabled();expect(requestIds).toHaveLength(1);await card.getByRole('button',{name:'Retry action update',exact:true}).click();await expect(card.getByRole('status').filter({hasText:'Action update saved.'})).toBeVisible();expect(requestIds).toHaveLength(2);expect(requestIds[0]).toBe(requestIds[1]);await contexts.WORKER.unroute(url);expect((await events(id)).length).toBe(countBefore+2)
  await worker.reload();await expect(card).toContainText('outside the current filter');await expect(card.locator('.action-progress')).toContainText('ready for supervisor');await expect(worker.getByRole('link',{name:'2 Awaiting verification',exact:true})).toBeVisible();await capture(worker,'progress-worker')
  let latest=await current(id)
  const payload={companyId:company,id,revision:latest.revision,requestId:randomUUID(),responsibleId:actors.WORKER.id,controls:latest.controls,targetDate:latest.target_date||'',resolution:latest.resolution,state:'closed'}
  expectDatabaseError(await actors.WORKER.client.rpc('ts_command',{command:'update_action',p:payload}),'TS_denied')
  expectDatabaseError(await actors.WORKER.client.rpc('ts_command',{command:'update_action',p:{...payload,state:'open',responsibleId:actors.OWNER.id}}),'TS_denied')
  expectDatabaseError(await actors.OWNER.client.rpc('ts_command',{command:'update_action',p:{...payload,revision:1}}),'TS_conflict')
  record('real progress/reload; simulated failed save/lost response; one event per retry; denied worker/stale transitions PASS')
  await supervisor.goto(origin+'/actions?company='+company+'&mine=0&status=awaiting_verification&focus='+id);const verify=supervisor.locator('#action-'+id);await expect(verify).toBeFocused();await verify.getByLabel('Status after saving',{exact:true}).selectOption('closed');await verify.getByRole('button',{name:'Verify and close',exact:true}).click();await expect(verify.getByRole('status').filter({hasText:'Action update saved.'})).toBeVisible();await supervisor.reload();await expect(verify).toContainText('Verified by');latest=await current(id);expect(latest.verified_by).toBe(actors.SUPERVISOR.id);expect(latest.verified_at).toBeTruthy()
  await verify.getByLabel('Status after saving',{exact:true}).selectOption('open');await verify.getByRole('button',{name:'Reopen action',exact:true}).click();await expect(verify.getByRole('status').filter({hasText:'Action update saved.'})).toBeVisible();expect((await current(id)).state).toBe('open');await supervisor.reload();await verify.getByText('Action history',{exact:true}).click();await expect(verify.locator('ol')).toContainText('Closed');await capture(supervisor,'verification-supervisor')
  await worker.goto(origin+'/actions?company='+company+'&status=attention&focus='+id);await card.getByRole('link',{name:'Add correction evidence',exact:true}).click();await expect(worker.getByLabel('Reason for correction',{exact:true})).toBeFocused();await worker.getByRole('button',{name:'Create correction draft',exact:true}).click();await worker.waitForURL(u=>u.pathname.startsWith('/report/')&&u.pathname!=='/report/'+reportId);const amendmentId=new URL(worker.url()).pathname.split('/').pop()
  await worker.getByRole('button',{name:'2. Observations',exact:true}).click();await worker.getByLabel('Photo file',{exact:true}).setInputFiles({name:'SYNTHETIC-correction-cone.jpg',mimeType:'image/jpeg',buffer:photo});await worker.getByLabel('Photo caption',{exact:true}).fill('SYNTHETIC correction evidence');await worker.getByRole('button',{name:'Upload photo',exact:true}).click();await expect(worker.getByRole('status').filter({hasText:'Photo saved and retained.'})).toBeVisible();await worker.getByRole('link',{name:'Back to actions',exact:true}).click();await expect(card).toBeFocused();await card.getByText('Amendments to this report (1)',{exact:true}).click();await expect(card.getByRole('link',{name:'Photo: SYNTHETIC correction evidence',exact:true})).toBeVisible()
  expect(expectSuccess(await actors.OWNER.client.from('ts_reports').select('*').eq('id',reportId).single())).toEqual(locked);expect(hash(await(await contexts.WORKER.request.get(base+'/evidence/'+photoId)).body())).toBe(photoHash);expect(hash(await(await contexts.WORKER.request.get(base+'/exports/'+exportId)).body())).toBe(pdfHash)
  expect(expectSuccess(await actors.OWNER.client.from('ts_reports').select('amendment_of').eq('id',amendmentId).single()).amendment_of).toBe(reportId)
  record('supervisor closure/reopen/history and linked private correction evidence; immutable original hashes PASS',{amendmentId})
  await worker.goto(origin+'/actions?company='+other);await worker.waitForURL('**/access-denied');expect(expectSuccess(await actors.WORKER.client.from('ts_actions').select('id').eq('company_id',other))).toEqual([])
  await command('OWNER','member',{userId:actors.WORKER.id,role:'remove'});await worker.goto(origin+'/actions?company='+company);await worker.waitForURL('**/access-denied');expect((await contexts.WORKER.request.get(base+'/evidence/'+photoId)).status()).toBe(404);expect((await contexts.WORKER.request.get(base+'/exports/'+exportId)).status()).toBe(404)
  expectDatabaseError(await actors.WORKER.client.rpc('ts_command',{command:'update_action',p:{...payload,revision:(await current(id)).revision,state:'open'}}),'TS_denied')
  record('cross-company and revoked action/evidence/PDF access denied PASS')
 }finally{for(const context of Object.values(contexts))await context.close()}
}
