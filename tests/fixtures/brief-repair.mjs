import {expect as baseExpect} from '@playwright/test'
import {randomUUID} from 'node:crypto'
import {prepareConcerns} from './concerns.mjs'
import {expectSuccess,expectDatabaseError} from '../../scripts/staging/assertions.mjs'
const expect=baseExpect.configure({timeout:30000})

export async function briefRepairWorkflow({browser,origin,actors,options={},capture=async()=>{},record=()=>{},baseline=false}){
 const f=await prepareConcerns(actors,'SYNTHETIC brief quality review',true)
 const rpc=(role,fn,command,p={})=>actors[role].client.rpc(fn,{command,p:{companyId:f.company,requestId:randomUUID(),...p}})
 const cmd=async(role,fn,command,p)=>expectSuccess(await rpc(role,fn,command,p))
 let brief=await cmd('SUPERVISOR','ts_site_command','create_brief',{id:randomUUID(),siteId:f.siteId})
 const step=randomUUID(),document={...brief.document,date:'2026-10-07',jurisdiction:'CA-ON',workplace:'construction',confirmed:true,task:'SYNTHETIC unload supplies',contact:'SYNTHETIC supervisor',crew:[actors.WORKER.id,actors.SUPERVISOR.id],attendance:[actors.WORKER.id],briefingNote:'SYNTHETIC route discussion',steps:[{id:step,task:'SYNTHETIC unload',hazard:'SYNTHETIC shared route',control:'',responsible:actors.SUPERVISOR.id,controlState:'proposed',unresolved:false}]}
 brief=await cmd('SUPERVISOR','ts_brief_command','save',{id:brief.id,revision:brief.revision,document})
 await cmd('OWNER','ts_command','member',{userId:actors.WORKER.id,role:'remove'})
 expectDatabaseError(await rpc('SUPERVISOR','ts_brief_command','save',{id:brief.id,revision:brief.revision,document:{...document,task:'SYNTHETIC rejected stale crew'}}),'TS_denied')
 const {localOnly,...settings}=options,context=await browser.newContext({viewport:{width:390,height:844},...settings})
 if(localOnly)await context.route('**/*',r=>[origin,actors.SUPERVISOR.apiOrigin].includes(new URL(r.request().url()).origin)?r.continue():r.abort())
 try{
  const page=await context.newPage();page.setDefaultTimeout(30000);page.setDefaultNavigationTimeout(90000)
  await page.goto(origin+'/auth/login?redirect='+encodeURIComponent('/briefs/'+brief.id+'?step=2'))
  await page.getByLabel('Email',{exact:true}).fill(actors.SUPERVISOR.email);await page.getByLabel('Password',{exact:true}).fill(actors.SUPERVISOR.password);await page.getByRole('button',{name:'Sign In',exact:true}).click();await page.waitForURL('**/briefs/'+brief.id+'?step=2')
  await expect(page.locator('.save-state')).toHaveText('Saved to server')
  const removed=page.getByRole('checkbox',{name:/access removed/});await expect(removed).toBeChecked();await capture(page,'removed-crew-phone')
  if(baseline){
   const disabled=await removed.isDisabled();expect(disabled).toBe(true)
   // Remove the revoked participant using the supported RPC only to isolate the second defect.
   brief=await cmd('SUPERVISOR','ts_brief_command','save',{id:brief.id,revision:brief.revision,document:{...document,crew:[actors.SUPERVISOR.id],attendance:[]}})
   await page.reload();await page.getByRole('button',{name:'4. Crew briefing',exact:true}).click();await page.getByRole('button',{name:'Record briefing version',exact:true}).click();await expect(page.getByRole('alert')).toBeVisible();await capture(page,'record-error-phone')
   const missingControlFieldLink=await page.getByRole('button',{name:'Task step 1: Control or precaution',exact:true}).count()===0;expect(missingControlFieldLink).toBe(true)
   brief=await cmd('SUPERVISOR','ts_brief_command','save',{id:brief.id,revision:brief.revision,document:{...brief.document,steps:[{...document.steps[0],control:'SYNTHETIC agree delivery route'}]}})
   await cmd('SUPERVISOR','ts_brief_command','record',{id:brief.id,revision:brief.revision});await page.goto(origin+'/briefs/'+brief.id)
   await context.route('**/api/briefs',r=>r.request().postDataJSON()?.command==='revise'?r.abort():r.continue());await page.getByRole('button',{name:'Revise brief',exact:true}).click();const retry=page.getByRole('button',{name:'Retry same operation',exact:true});await expect(retry).toBeVisible();const retryBelowViewport=await retry.evaluate(e=>e.getBoundingClientRect().top>=innerHeight);expect(retryBelowViewport).toBe(true);await capture(page,'record-retry-phone')
   record('Baseline defects observed',{...f,briefId:brief.id,removedCrewCannotBeUnchecked:disabled,missingControlFieldLink,retryBelowViewport});return
  }
  await expect(removed).toBeEnabled();await removed.click();await expect(page.locator('.save-state')).toHaveText('Saved to server');await page.reload();await expect(page.getByRole('checkbox',{name:/access removed/})).toHaveCount(0)
  const read=()=>actors.OWNER.client.from('ts_briefs').select('*').eq('id',brief.id).single().then(expectSuccess)
  expect((await read()).document.crew).toEqual([actors.SUPERVISOR.id]);expect((await read()).document.attendance).toEqual([])
  await page.getByRole('button',{name:'4. Crew briefing',exact:true}).click();await page.getByRole('button',{name:'Record briefing version',exact:true}).click()
  const issue=page.getByRole('button',{name:'Task step 1: Control or precaution',exact:true});await expect(issue).toBeVisible();await capture(page,'record-error-phone');await issue.focus();await page.keyboard.press('Enter');await expect(page.getByLabel('Control or precaution',{exact:true})).toBeFocused();await page.getByLabel('Control or precaution',{exact:true}).fill('SYNTHETIC agree delivery route');await expect(page.locator('.save-state')).toHaveText('Saved to server')
  await page.getByRole('button',{name:'Continue',exact:true}).click();await page.getByRole('button',{name:'Record briefing version',exact:true}).click();await expect(page.getByRole('button',{name:'Revise brief',exact:true})).toBeVisible()
  // A failed top-of-page operation must expose recovery in the viewport, not below the entire record.
  await context.route('**/api/briefs',r=>r.request().postDataJSON()?.command==='revise'?r.abort():r.continue())
  await page.getByRole('button',{name:'Revise brief',exact:true}).click();const retry=page.getByRole('button',{name:'Retry same operation',exact:true});await expect(retry).toBeInViewport();await capture(page,'record-retry-phone');await context.unroute('**/api/briefs');await retry.click();await expect(page.getByRole('heading',{name:'Site',exact:true})).toBeVisible()
  const versions=expectSuccess(await actors.OWNER.client.from('ts_brief_versions').select('*').eq('brief_id',brief.id));expect(versions).toHaveLength(1);expect(versions[0].snapshot.document.steps[0].control).toBe('SYNTHETIC agree delivery route');expect(versions[0].snapshot.document.crew).toEqual([actors.SUPERVISOR.id])
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.setViewportSize({width:1280,height:900});await capture(page,'recovered-brief-desktop')
  record('PASS removed-crew recovery, field-directed validation/focus, visible recorded-operation retry and immutable version',{...f,briefId:brief.id})
 }finally{await context.close()}
}

