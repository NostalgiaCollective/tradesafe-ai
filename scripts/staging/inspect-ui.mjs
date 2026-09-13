import { resolve } from 'node:path'
process.env.PLAYWRIGHT_BROWSERS_PATH = resolve('.staging/browsers')
const { chromium, expect } = await import('@playwright/test')
import { createClient } from '@supabase/supabase-js'
import { requireStaging } from './config.mjs'
import { gitIdentity } from './evidence.mjs'
import { mkdirSync,writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
const configuration=requireStaging()
if(!configuration||configuration.env.STAGING_ISOLATED_PROJECT_REF==='flhsdtshwwuddzyguyhf')process.exit(2)
const {env}=configuration
const evidence={...gitIdentity(),timestamp:new Date().toISOString(),projectFingerprint:createHash('sha256').update(env.STAGING_ISOLATED_PROJECT_REF).digest('hex'),checks:[],status:'running'}
const save=()=>{
 mkdirSync('test-results/staging-runs',{recursive:true})
 const serialized=JSON.stringify(evidence,null,2)
 writeFileSync('.staging/ui-inspection-evidence.json',serialized)
 writeFileSync('test-results/staging-runs/ui-'+evidence.timestamp.replaceAll(':','-')+'.json',serialized)
}
const check=name=>{evidence.checks.push(name);save();console.log('PASS: '+name)}
const client=createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}})
let browser
try{
 const auth=await client.auth.signInWithPassword({email:env.STAGING_OWNER_EMAIL,password:env.STAGING_OWNER_PASSWORD})
 if(auth.error)throw Error('Owner authentication')
 const result=await client.from('ts_reports').select('*').eq('lifecycle','finalized').order('created_at',{ascending:false}).limit(10)
 if(result.error)throw Error('Inventory')
 const report=result.data.find(r=>r.document.job.address==='SYNTHETIC unresolved site')
 if(!report)throw Error('No preserved report')
 evidence.reportId=report.id;evidence.companyId=report.company_id
 const members=await client.from('ts_members').select('*').eq('company_id',report.company_id)
 if(members.error)throw Error('Membership inventory')
 const names=id=>members.data.find(m=>m.user_id===id)?.display_name||id
 browser=await chromium.launch({headless:true})
 mkdirSync('test-results/staging-evidence',{recursive:true})
 for(const [viewportName,viewport] of [['desktop',{width:1440,height:1000}],['phone',{width:390,height:844}]]){
  const context=await browser.newContext({baseURL:env.NEXT_PUBLIC_APP_URL,viewport,isMobile:viewportName==='phone',hasTouch:viewportName==='phone'})
  try{
   const page=await context.newPage()
   await page.goto('/auth/login')
   await page.getByLabel('Email',{exact:true}).fill(env.STAGING_OWNER_EMAIL)
   await page.getByLabel('Password',{exact:true}).fill(env.STAGING_OWNER_PASSWORD)
   await page.getByRole('button',{name:'Sign In',exact:true}).click()
   await page.waitForURL('**/dashboard')
   await page.goto('/report/'+report.id)
   const article=page.locator('.inspection-print')
   await expect(article).toContainText('SYNTHETIC damaged enclosure')
   await expect(article).toContainText(names(report.author_id))
   await expect(article).toContainText(names(report.finalized_by))
   await expect(article).toContainText(report.template_snapshot.version)
   await expect(article).toContainText(report.business_snapshot.name)
   await expect(article).toContainText('Linked amendments')
   await expect(article).toContainText('does not certify compliance')
   if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Horizontal overflow')
   check(viewportName+': finalized snapshot, original concern, actor, template, amendment linkage and no horizontal overflow')
   await page.screenshot({path:'test-results/staging-evidence/'+viewportName+'-finalized.png',fullPage:true})
   await page.emulateMedia({media:'print'})
   evidence.printStyles=await page.evaluate(()=>{
    const item=getComputedStyle(document.querySelector('.inspection-print .review-list>li'))
    const summary=getComputedStyle(document.querySelector('.observation-summary'))
    return {itemDisplay:item.display,itemBreak:item.breakInside,summaryBreak:summary.breakInside}
   })
   await page.pdf({path:'test-results/staging-evidence/'+viewportName+'-finalized.pdf',format:'A4',printBackground:true,margin:{top:'12mm',right:'12mm',bottom:'12mm',left:'12mm'}})
   await page.emulateMedia({media:'screen'})
   check(viewportName+': actual Chromium print-to-PDF generated for visual inspection')
   // Deliberate logout transport failure, followed by the real successful flow.
   await page.route('**/auth/v1/logout**',route=>route.abort('failed'))
   await page.getByRole('button',{name:'Sign out',exact:true}).click()
   await expect(page.locator('main').getByRole('alert').or(page.locator('header').getByRole('alert'))).toContainText(/sign.out|try again/i)
   check(viewportName+': logout transport failure visibly reported')
   await page.unrouteAll({behavior:'wait'})
   await page.getByRole('button',{name:'Sign out',exact:true}).click()
   await page.waitForURL('/')
   await page.goto('/dashboard');await page.waitForURL('**/auth/login?**')
   check(viewportName+': successful logout revokes protected browser access')
  }finally{await context.close()}
 }
 evidence.status='PASS'
}catch(error){evidence.status='FAIL';evidence.failureLines=[...(error.stack||'').matchAll(/inspect-ui\.mjs:(\d+)/g)].map(m=>Number(m[1]));console.error('FAIL: supplemental UI verification; sanitized source lines saved.');process.exitCode=1}
finally{save();await browser?.close();await client.auth.signOut({scope:'local'}).catch(()=>{})}
