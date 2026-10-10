import {test,expect} from '@playwright/test'
import {readFileSync} from 'node:fs'
import {randomUUID} from 'node:crypto'
import {createClient} from '@supabase/supabase-js'
import {APP_ORIGIN} from '../../scripts/ci/local-environment.mjs'
test('WebKit phone demo: fresh entry, saved edits, stale visitors, private sample evidence and restricted access',async({browser})=>{
 const f=JSON.parse(readFileSync('.ci-local/phone-demo.json','utf8')),contexts=[]
 async function visitor(){const c=await browser.newContext({baseURL:APP_ORIGIN,viewport:{width:390,height:844}});contexts.push(c);const p=await c.newPage();await p.goto('/demo');await p.getByLabel('Demo login',{exact:true}).fill(f.login);await p.getByLabel('Demo passphrase',{exact:true}).fill(f.passphrase);await p.getByRole('button',{name:'Open demo job'}).click();await p.waitForURL('**/sites/'+f.site+'/electrical');await expect(p.getByRole('heading',{name:'Electrical job',exact:true})).toBeVisible();return p}
 const raw=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}})
 await raw.auth.signInWithPassword({email:f.email,password:f.password})
 const coordinator=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}})
 await coordinator.auth.signInWithPassword({email:f.coordinator.email,password:f.coordinator.password})
 const otherCompany=randomUUID(),otherSite=randomUUID()
 expect((await coordinator.rpc('ts_command',{command:'create_company',p:{id:otherCompany,name:'SYNTHETIC unrelated company'}})).error).toBeNull()
 expect((await coordinator.rpc('ts_site_command',{command:'create',p:{companyId:otherCompany,id:otherSite,requestId:randomUUID(),document:{name:'SYNTHETIC unrelated site',address:'Fictional elsewhere',instructions:''}}})).error).toBeNull()
 try{
  const first=await visitor(),second=await visitor(),api='/api/sites/'+f.site+'/electrical',headers={origin:APP_ORIGIN,'X-Expected-Actor':f.user}
  await first.getByLabel('Job scope and location within the site',{exact:true}).fill('DEMO first visitor saved scope')
  await second.getByLabel('Job scope and location within the site',{exact:true}).fill('DEMO second visitor unsaved scope')
  await first.getByRole('button',{name:'Save electrical job',exact:true}).click();await expect(first.getByRole('status').filter({hasText:'Saved to server. Revision 2.'})).toBeVisible()
  await second.getByRole('button',{name:'Save electrical job',exact:true}).click();await expect(second.getByRole('status').filter({hasText:'Server changes require review'})).toBeVisible();await expect(second.getByLabel('Job scope and location within the site',{exact:true})).toHaveValue('DEMO second visitor unsaved scope')
  await first.reload();await expect(first.getByLabel('Job scope and location within the site',{exact:true})).toHaveValue('DEMO first visitor saved scope')
  const saved=await raw.from('ts_electrical_jobs').select('document,revision').eq('site_id',f.site).single();expect(saved.data.document.scope).toBe('DEMO first visitor saved scope');expect(saved.data.revision).toBe(2)
  for(const path of ['/settings','/api/auth/recovery/request','/api/checkout'])expect((await first.request.get(path)).status()).toBe(403)
  const denied=await first.request.post('/api/workspace',{headers,data:{command:'create_company',payload:{id:randomUUID(),name:'must not create'}}});expect(denied.status()).toBe(403)
  const ack=await first.request.post('/api/briefs',{headers,data:{command:'acknowledge',payload:{companyId:f.company,id:randomUUID(),version:1}}});expect(ack.status()).toBe(403)
  expect((await first.request.get('/api/sites/'+otherSite+'/electrical')).status()).toBe(404)
  expect((await first.request.post('/api/workspace',{headers,data:{command:'create_report',payload:{companyId:otherCompany,id:randomUUID(),templateId:'electrical:1'}}})).status()).toBe(403)
  await first.goto('/concerns/'+f.concern);await expect(first.getByRole('heading',{name:'Original observation'})).toBeVisible();const image=first.locator('img').first();await expect(image).toBeVisible();expect((await first.request.get(await image.getAttribute('src'))).status()).toBe(200)
  expect(await first.evaluate(()=>document.cookie.includes('ts_phone_demo'))).toBe(false)
  expect((await first.context().cookies()).filter(c=>c.name.startsWith('sb-'))).toHaveLength(0)
  expect(await first.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
  const removed=await coordinator.rpc('ts_command',{command:'member',p:{companyId:f.company,userId:f.user,role:'remove'}});expect(removed.error).toBeNull();expect((await first.request.get(api)).status()).toBe(403)
  await first.getByRole('button',{name:'Sign out',exact:true}).click();await first.waitForURL('**/demo')
 }finally{for(const c of contexts)await c.close()}
})
