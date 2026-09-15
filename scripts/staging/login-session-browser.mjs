// Fault-injection tests: provider responses are synthetic and intercepted in-browser.
// No real account sign-in, password change, recovery email or database write.
import assert from 'node:assert/strict'
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs'
import {resolve} from 'node:path'
import {HOSTED_ORIGIN,STAGING_PROJECT} from '../../lib/staging/hosted.mjs'
import {SESSION_MESSAGES} from '../../lib/client/login-session.ts'
const hosted=process.argv.slice(2).includes('--hosted')
if(process.argv.slice(2).some(arg=>arg!=='--hosted'))throw Error('Only --hosted is supported')
const origin=hosted?HOSTED_ORIGIN:'https://localhost:3000'
process.env.PLAYWRIGHT_BROWSERS_PATH=resolve('.staging/browsers')
const {chromium,webkit,devices,expect}=await import('@playwright/test')
const gate=hosted?JSON.parse(readFileSync('.staging/hosted-access.json','utf8')):null
const result={at:new Date().toISOString(),origin,kind:'browser fault injection; no real account authentication or physical-device evidence',checks:[]}
for(const [name,engine] of [['chromium',chromium],['webkit',webkit]]){
 const browser=await engine.launch({headless:true})
 try{
  for(const fault of ['missing_cookie','provider_rejected','session_network_failure','server_confirmed']){
   const context=await browser.newContext({...devices['iPhone 14 Pro Max'],...(gate?{httpCredentials:{username:gate.username,password:gate.password}}:{})})
   let providerRequests=0,confirmationRequests=0,dashboardRequests=0
   await context.route('https://'+STAGING_PROJECT+'.supabase.co/**',async route=>{
    providerRequests++
    assert.equal(new URL(route.request().url()).pathname,'/auth/v1/token','Only the synthetic provider sign-in may be called')
    if(fault==='provider_rejected'){await route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({error_code:'invalid_credentials',msg:'Synthetic rejection'})});return}
    const user={id:'11111111-1111-4111-8111-111111111111',aud:'authenticated',email:'synthetic@example.test',app_metadata:{provider:'email'},user_metadata:{},created_at:new Date().toISOString()}
    const access_token=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')+'.'+Buffer.from(JSON.stringify({sub:user.id,exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')+'.synthetic'
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({access_token,refresh_token:'synthetic-only',token_type:'bearer',expires_in:3600,user})})
   })
   if(fault==='missing_cookie')await context.addInitScript(()=>Object.defineProperty(document,'cookie',{configurable:true,get(){return ''},set(){}}))
   await context.route(origin+'/api/auth/session',async route=>{
    confirmationRequests++
    if(fault==='missing_cookie'){await route.continue();return} // Actual server must reject missing cookies.
    if(fault==='session_network_failure'){await route.abort();return}
    assert.equal(fault,'server_confirmed')
    // WebKit can attach Cookie after request interception; inspect storage here.
    // Real cookie delivery is checked separately against the hosted server.
    assert.ok((await context.cookies(origin)).some(cookie=>cookie.name.startsWith('sb-'+STAGING_PROJECT+'-auth-token')))
    await route.fulfill({status:200,contentType:'application/json',body:'{"authenticated":true}'})
   })
   await context.route(origin+'/dashboard',async route=>{dashboardRequests++;await route.fulfill({status:200,contentType:'text/html',body:'<h1>Synthetic destination</h1>'})})
   const page=await context.newPage(),diagnostics={requests:[],pageErrors:[]}
   page.on('request',r=>diagnostics.requests.push({path:new URL(r.url()).pathname,method:r.method()}))
   page.on('pageerror',e=>diagnostics.pageErrors.push(e.message.replace(/https?:\/\/[^\s]+/g,'[URL]')))
   await page.goto(origin+'/auth/login',{waitUntil:'networkidle'})
   await page.getByLabel('Email',{exact:true}).fill('synthetic@example.test')
   await page.getByLabel('Password',{exact:true}).fill('Synthetic-only-unused-123')
   await page.getByRole('button',{name:'Sign In',exact:true}).click()
   if(fault==='server_confirmed'){
    await expect(page.getByRole('heading',{name:'Synthetic destination'})).toBeVisible()
    assert.equal(dashboardRequests,1)
   }else{
    const message=fault==='missing_cookie'?SESSION_MESSAGES.missing:fault==='session_network_failure'?SESSION_MESSAGES.unavailable:'Sign-in could not be completed. Check your details and connection, then try again.'
    try { await expect(page.getByRole('alert').filter({hasText:message})).toBeVisible({timeout:15000}) }
    catch {
      console.log(JSON.stringify({engine:name,fault,providerRequests,confirmationRequests,dashboardRequests,diagnostics,
        fields:await page.locator('input').evaluateAll(es=>es.map(e=>({id:e.id,length:e.value.length,valid:e.checkValidity()})))}))
      throw Error('Expected login feedback missing; sanitized diagnostic above')
    }
    assert.equal(new URL(page.url()).pathname,'/auth/login')
    assert.equal(dashboardRequests,0,'Failed session confirmation must not navigate')
    await expect(page.getByRole('button',{name:'Sign In',exact:true})).toBeEnabled()
   }
   assert.equal(providerRequests,1,'No automatic credential retry')
   assert.equal(confirmationRequests,fault==='provider_rejected'?0:1)
   result.checks.push({engine:name,fault,status:'PASS'});console.log('PASS: '+name+' '+fault)
   await context.close()
  }
 }finally{await browser.close()}
}
result.status='PASS';mkdirSync('test-results/login-session',{recursive:true});writeFileSync('test-results/login-session/'+(hosted?'hosted':'local')+'.json',JSON.stringify(result,null,2)+'\n')
