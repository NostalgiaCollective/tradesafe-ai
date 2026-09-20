import {readFileSync,writeFileSync,mkdirSync} from 'node:fs'
import {resolve} from 'node:path'
import {execFileSync} from 'node:child_process'
import {randomUUID} from 'node:crypto'
import assert from 'node:assert/strict'
import {createClient} from '@supabase/supabase-js'
import {requireStaging} from './config.mjs'
import {HOSTED_ORIGIN} from '../../lib/staging/hosted.mjs'
const {env}=requireStaging(),hosted=process.argv.includes('--hosted'),origin=hosted?HOSTED_ORIGIN:'https://localhost:3000',run=(hosted?'hosted':'local')+'-'+randomUUID().slice(0,8),file='.staging/follow-up-'+run+'.json',out='test-results/follow-up-'+run
const result={status:'RUNNING',origin,commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),dirty:!!execFileSync('git',['diff','HEAD','--name-only'],{encoding:'utf8'}).trim(),checks:[],startedAt:new Date().toISOString()},save=()=>writeFileSync(file,JSON.stringify(result,null,2)+'\n');mkdirSync(out,{recursive:true});save()
process.env.PLAYWRIGHT_BROWSERS_PATH=resolve('.staging/browsers')
const {chromium}=await import('@playwright/test'),{followUpWorkflow}=await import('../../tests/fixtures/follow-up.mjs'),browser=await chromium.launch(),gate=JSON.parse(readFileSync('.staging/hosted-access.json')),options=hosted?{httpCredentials:{username:gate.username,password:gate.password}}:{},actors={}
try{
 if(hosted){assert.match(process.env.EXPECTED_COMMIT||'',/^[a-f0-9]{40}$/);const c=await browser.newContext(options);try{result.identity=await(await c.request.get(origin+'/api/staging/identity',{timeout:90000})).json();assert.equal(result.identity.commit,process.env.EXPECTED_COMMIT)}finally{await c.close()};save()}
 for(const role of ['OWNER','WORKER','SUPERVISOR']){const email=env['STAGING_'+role+'_EMAIL'],password=env['STAGING_'+role+'_PASSWORD'],client=createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}}),auth=await client.auth.signInWithPassword({email,password});assert.equal(auth.error,null);actors[role]={email,password,id:auth.data.user.id,client,apiOrigin:env.NEXT_PUBLIC_SUPABASE_URL}}
 await followUpWorkflow({browser,origin,actors,options,record:(name,data={})=>{result.checks.push(name);Object.assign(result,data);save();console.log(name)},capture:async(page,name)=>{for(const [width,label] of [[390,'phone'],[1366,'desktop']]){await page.setViewportSize({width,height:width===390?844:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:out+'/'+name+'-'+label+'.png',fullPage:true})}await page.setViewportSize({width:390,height:844})}})
 result.status='PASS'
}catch(e){result.status='FAIL';result.failure={name:e.name,assertion:e.matcherResult?.name||null,lines:[...(e.stack||'').matchAll(/follow-up\.mjs:(\d+)/g)].map(m=>+m[1])};process.exitCode=1}
finally{await browser.close();result.finishedAt=new Date().toISOString();save();console.log(JSON.stringify({file,status:result.status,checks:result.checks,failure:result.failure}))}
