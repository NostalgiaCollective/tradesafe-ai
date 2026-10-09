import {expect as baseExpect} from '@playwright/test'
import {randomUUID} from 'node:crypto'
import {prepareConcerns} from './concerns.mjs'
import {emptyElectricalJob} from '../../lib/domain/electrical-job.mjs'
import {expectSuccess} from '../../scripts/staging/assertions.mjs'
const expect=baseExpect.configure({timeout:30000})
export async function electricalRecoveryWorkflow({browser,origin,actors,options={},record=()=>{}}){
 const f=await prepareConcerns(actors,'SYNTHETIC electrical save recovery',true),path='/sites/'+f.siteId+'/electrical',api=origin+'/api/sites/'+f.siteId+'/electrical',contexts=[]
 const rows=async t=>expectSuccess(await actors.SUPERVISOR.client.from(t).select('*').eq('site_id',f.siteId))
 const save=async(revision,document)=>expectSuccess(await actors.SUPERVISOR.client.rpc('ts_electrical_command',{command:'save',p:{companyId:f.company,siteId:f.siteId,revision,document,requestId:randomUUID()}}))
 async function login(role){const {localOnly,...settings}=options,c=await browser.newContext({viewport:{width:390,height:844},...settings});contexts.push(c);if(localOnly)await c.route('**/*',r=>[origin,actors[role].apiOrigin].includes(new URL(r.request().url()).origin)?r.continue():r.abort());const p=await c.newPage();p.setDefaultTimeout(30000);p.setDefaultNavigationTimeout(90000);await p.goto(origin+'/auth/login?redirect='+encodeURIComponent(path));await p.getByLabel('Email',{exact:true}).fill(actors[role].email);await p.getByLabel('Password',{exact:true}).fill(actors[role].password);await p.getByRole('button',{name:'Sign In',exact:true}).click();await p.waitForURL('**'+path);return p}
 try{
  const p=await login('SUPERVISOR');await expect(p.getByRole('button',{name:'Save electrical job',exact:true})).toBeEnabled()
  await p.getByLabel('Job scope and location within the site',{exact:true}).fill('SYNTHETIC first editor')
  let lost=false;await p.route(api,async r=>{if(!lost&&r.request().method()==='POST'){lost=true;try{const response=await r.fetch();expect(response.status()).toBe(200);await r.abort()}catch{throw Error('Synthetic request interception failed')}}else await r.continue()})
  await p.getByRole('button',{name:'Save electrical job',exact:true}).click();await expect(p.getByRole('button',{name:'Retry same operation',exact:true})).toBeEnabled()
  const first=(await rows('ts_electrical_jobs'))[0];expect(first.revision).toBe(1)
  await save(1,{...first.document,scope:'SYNTHETIC second editor',equipment:'SYNTHETIC newer equipment'})
  await p.getByRole('button',{name:'Retry same operation',exact:true}).click()
  await expect(p.getByRole('alert').filter({hasText:'Server changes require review'})).toBeVisible()
  await expect(p.getByLabel('Job scope and location within the site',{exact:true})).toHaveValue('SYNTHETIC first editor')
  expect((await rows('ts_electrical_job_versions')).length).toBe(2)
  record('Lost response followed by concurrent edit does not show the replayed older revision as current',f)
  await p.unroute(api)
  await p.getByRole('button',{name:'Compare with latest server entries',exact:true}).click()
  await expect(p.getByRole('heading',{name:'Server revision 2',exact:true})).toBeVisible()
  await expect(p.getByText('Server entry: SYNTHETIC second editor',{exact:true})).toBeVisible()
  await expect(p.getByText('Your entry: SYNTHETIC first editor',{exact:true})).toBeVisible()
  await p.getByRole('button',{name:'Keep my entries for review',exact:true}).click()
  await expect(p.getByLabel('Job scope and location within the site',{exact:true})).toBeEnabled()
  expect((await rows('ts_electrical_jobs'))[0].revision).toBe(2)
  await p.getByLabel('Equipment and circuit identifiers',{exact:true}).fill('SYNTHETIC explicitly reconciled equipment')
  await p.getByRole('button',{name:'Save electrical job',exact:true}).click()
  await expect.poll(async()=>(await rows('ts_electrical_jobs'))[0].revision).toBe(3)
  await expect(p.getByText('Saved to server. Revision 3.',{exact:true}).first()).toBeVisible()
  const retained=await (await p.context().request.get(api+'?revision=2')).text()
  await p.reload();await expect(p.getByLabel('Equipment and circuit identifiers',{exact:true})).toHaveValue('SYNTHETIC explicitly reconciled equipment')
  // Secondary failure stays local to its panel and never removes selected input.
  await p.route(api+'?view=secondary',r=>r.fulfill({status:503,contentType:'application/json',body:JSON.stringify({code:'unavailable'})}))
  await p.getByRole('button',{name:'Inspection records',exact:true}).click()
  await expect(p.getByRole('button',{name:'Retry evidence and history',exact:true}).first()).toBeVisible()
  await expect(p.getByLabel('Job scope and location within the site',{exact:true})).toHaveValue('SYNTHETIC first editor')
  await p.unroute(api+'?view=secondary');await p.getByRole('button',{name:'Retry evidence and history',exact:true}).first().click()
  await expect(p.getByLabel('Certificate of Acceptance photo',{exact:true})).toBeEnabled()
  await p.route(api+'?view=work',r=>r.fulfill({status:503,contentType:'application/json',body:JSON.stringify({code:'unavailable'})}))
  await p.getByRole('button',{name:'Refresh saved work',exact:true}).click()
  await expect(p.getByRole('alert').filter({hasText:'Previous results below have not been refreshed'})).toBeVisible()
  await p.unroute(api+'?view=work');await p.getByRole('button',{name:'Retry saved work',exact:true}).click()
  await expect(p.getByRole('button',{name:'Refresh saved work',exact:true})).toBeEnabled()
  // Authentication failure retains the entered text and original operation id.
  await p.getByRole('button',{name:'Job details',exact:true}).click()
  await p.getByLabel('Job scope and location within the site',{exact:true}).fill('SYNTHETIC session recovery text')
  await p.route(api,r=>r.request().method()==='POST'?r.fulfill({status:401,contentType:'application/json',body:'{}'}):r.continue())
  await p.getByRole('button',{name:'Save electrical job',exact:true}).click()
  await expect(p.getByRole('link',{name:'Sign in in another tab',exact:true})).toBeVisible()
  await expect(p.getByLabel('Job scope and location within the site',{exact:true})).toHaveValue('SYNTHETIC session recovery text')
  expect((await rows('ts_electrical_jobs'))[0].revision).toBe(3)
  await p.unroute(api);await p.getByRole('button',{name:'Retry same operation',exact:true}).click()
  await expect(p.getByText('Saved to server. Revision 4.',{exact:true}).first()).toBeVisible()
  expect((await rows('ts_electrical_job_versions')).length).toBe(4)
  expect(await(await p.context().request.get(api+'?revision=2')).text()).toBe(retained)
  const worker=await login('WORKER'),outsider=await login('OUTSIDER')
  for(const view of ['current','secondary','work']){
   expect((await worker.context().request.get(api+'?view='+view,{headers:{'X-Expected-Actor':actors.WORKER.id}})).status()).toBe(200)
   expect((await outsider.context().request.get(api+'?view='+view,{headers:{'X-Expected-Actor':actors.OUTSIDER.id}})).status()).toBe(404)
  }
  expect((await worker.context().request.post(api,{headers:{origin,'X-Expected-Actor':actors.WORKER.id},data:{command:'save',payload:{companyId:f.company,siteId:f.siteId,revision:4,document:emptyElectricalJob(),requestId:randomUUID()}}})).status()).toBe(403)
  expect((await p.context().request.get(api+'?view=current',{headers:{'X-Expected-Actor':actors.WORKER.id}})).status()).toBe(409)
  expectSuccess(await actors.OWNER.client.rpc('ts_command',{command:'member',p:{companyId:f.company,userId:actors.WORKER.id,role:'remove',requestId:randomUUID()}}))
  for(const view of ['current','secondary','work'])expect((await worker.context().request.get(api+'?view='+view,{headers:{'X-Expected-Actor':actors.WORKER.id}})).status()).toBe(404)
  await p.getByRole('button',{name:'Job details',exact:true}).click();await expect(p.getByLabel('Job scope and location within the site',{exact:true})).toBeFocused()
  expect(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
  record('Explicit conflict comparison/reconciliation, panel and summary retry, simulated expired session, reload, immutable export and role/company/revocation boundaries PASS',f)
 }finally{for(const c of contexts)await c.close()}
}
