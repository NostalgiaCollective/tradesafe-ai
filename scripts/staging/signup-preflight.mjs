// Non-email verification only: every browser Auth request is intercepted.
import {readFileSync,writeFileSync} from 'node:fs'
import {resolve} from 'node:path'
import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import {requireStaging} from './config.mjs'
import {HOSTED_ORIGIN,STAGING_PROJECT} from '../../lib/staging/hosted.mjs'
const config=requireStaging();assert.ok(config)
const local=process.argv.includes('--local'),origin=local?'https://localhost:3000':HOSTED_ORIGIN
if(!local)assert.match(process.env.EXPECTED_COMMIT||'',/^[a-f0-9]{40}$/)
process.env.PLAYWRIGHT_BROWSERS_PATH=resolve('.staging/browsers')
const {chromium,devices,expect}=await import('@playwright/test')
const gate=JSON.parse(readFileSync('.staging/hosted-access.json'))
const browser=await chromium.launch(),context=await browser.newContext({...devices['iPhone 14 Pro Max'],...(!local?{httpCredentials:{username:gate.username,password:gate.password}}:{})})
const result={at:new Date().toISOString(),sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),sourceDirty:Boolean(execFileSync('git',['diff','HEAD','--name-only'],{encoding:'utf8'}).trim()),origin,emailSent:false,checks:[],stage:'identity'}
const pass=name=>{result.checks.push(name);console.log('PASS '+name)}
try{
 if(!local){result.identity=await (await context.request.get(origin+'/api/staging/identity')).json();assert.equal(result.identity.commit,process.env.EXPECTED_COMMIT);assert.equal(result.identity.projectRef,STAGING_PROJECT)}
 const settings=await fetch(config.env.NEXT_PUBLIC_SUPABASE_URL+'/auth/v1/settings',{headers:{apikey:config.env.NEXT_PUBLIC_SUPABASE_ANON_KEY},signal:AbortSignal.timeout(15000)});assert.equal(settings.status,200)
 const auth=await settings.json();result.provider={email:auth.external.email,google:auth.external.google,confirmationRequired:!auth.mailer_autoconfirm,signupEnabled:!auth.disable_signup};assert.equal(result.provider.confirmationRequired,true);pass('provider confirmation remains required (read only)')
 let dispatches=0
 await context.route(config.env.NEXT_PUBLIC_SUPABASE_URL+'/auth/v1/**',async route=>{dispatches++;assert.ok(route.request().url().includes('/signup'));await route.fulfill({status:422,contentType:'application/json',body:JSON.stringify({code:'weak_password',msg:'Synthetic provider detail must not leak'})})})
 const page=await context.newPage();await page.goto(origin+'/auth/login',{waitUntil:'networkidle'});await page.getByRole('button',{name:'Sign up',exact:true}).click()
 result.stage='required-field validation';await page.getByRole('button',{name:'Create Account',exact:true}).click();assert.equal(dispatches,0)
 await page.getByLabel('Email',{exact:true}).fill('synthetic-signup-ui@example.test');await page.getByLabel('Password',{exact:true}).fill('short');await page.getByRole('button',{name:'Create Account',exact:true}).click();assert.equal(dispatches,0);pass('required email/password and minimum password length stop dispatch')
 result.stage='signup rejection feedback';await page.getByLabel('Password',{exact:true}).fill('synthetic-only-password');await page.getByRole('button',{name:'Create Account',exact:true}).click()
 const alert=page.getByRole('alert').filter({hasText:/could not|not confirmed/});await expect(alert).toBeVisible();result.signupError=await alert.innerText();assert.equal(dispatches,1);assert.ok(!result.signupError.includes('Synthetic provider detail'))
 await expect(page.getByLabel('Email',{exact:true})).toHaveValue('synthetic-signup-ui@example.test');await expect(page.getByLabel('Password',{exact:true})).toHaveValue('synthetic-only-password');await expect(page.getByRole('button',{name:'Create Account',exact:true})).toBeEnabled()
 assert.match(result.signupError,/Account creation/);pass('mocked signup rejection names account creation and preserves input')
 result.stage='callback rejection'
 for(const query of ['redirect=https%3A%2F%2Funtrusted.example.test','code=synthetic-invalid-code&redirect=%2Fdashboard']){
  const r=await context.request.get(origin+'/auth/callback?'+query,{maxRedirects:0});assert.equal(r.status(),307);const target=new URL(r.headers().location);assert.equal(target.origin,origin);assert.equal(target.pathname,'/auth/login');assert.equal(target.searchParams.get('error'),'auth_failed');assert.equal(target.searchParams.get('redirect'),'/dashboard');assert.match(r.headers()['cache-control'],/no-store/)
 }
 pass('real callback rejects missing/invalid codes and external redirects without a session')
 result.status='PASS'
}catch(e){result.status='FAIL';result.errorType=e.name;result.lines=[...(e.stack||'').matchAll(/signup-preflight\.mjs:(\d+)/g)].map(m=>Number(m[1]));process.exitCode=1}
finally{await browser.close();writeFileSync('.staging/signup-preflight-'+(local?'local':'hosted')+'.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result))}
