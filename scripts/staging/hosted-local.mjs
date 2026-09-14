// Production-build preflight on loopback only. Never publishes or sends email.
import {spawn} from 'node:child_process'
import {once} from 'node:events'
import {readFileSync,writeFileSync,readdirSync,mkdirSync} from 'node:fs'
import {parseEnv} from 'node:util'
import {setTimeout as delay} from 'node:timers/promises'
import assert from 'node:assert/strict'
import {request as httpRequest} from 'node:http'
import {createServer as createPortProbe} from 'node:net'
import {gitIdentity} from './evidence.mjs'
import {HOSTED_ORIGIN,HOSTED_BRANCH,STAGING_PROJECT} from '../../lib/staging/hosted.mjs'
const privateEnv=parseEnv(readFileSync('.staging/hosted.env','utf8')),access=JSON.parse(readFileSync('.staging/hosted-access.json','utf8'))
const provenance=gitIdentity(),env={...process.env,...privateEnv,NODE_ENV:'production',NODE_USE_SYSTEM_CA:'1',RENDER_EXTERNAL_URL:HOSTED_ORIGIN,RENDER_GIT_BRANCH:HOSTED_BRANCH,RENDER_GIT_COMMIT:provenance.commit,NEXT_TELEMETRY_DISABLED:'1'}
const result={...provenance,at:new Date().toISOString(),kind:'loopback production preflight; no public deployment or email',checks:[]}
const output='test-results/hosted-staging/'+result.at.replaceAll(':','-');mkdirSync(output,{recursive:true})
let server,current='production build'
const check=(name)=>{current=name}
const pass=()=>result.checks.push({name:current,status:'PASS'})
try{
 const build=spawn(process.execPath,['scripts/staging/hosted.mjs','build'],{env,stdio:'inherit',windowsHide:true})
 assert.equal((await once(build,'exit'))[0],0);pass()
 check('client bundles exclude server credentials and staging access password')
 function audit(path){for(const entry of readdirSync(path,{withFileTypes:true})){const p=path+'/'+entry.name;if(entry.isDirectory())audit(p);else{const data=readFileSync(p);for(const secret of [privateEnv.SUPABASE_SERVICE_ROLE_KEY,privateEnv.STAGING_ACCESS_SHA256,access.password,access.phonePassword])assert.equal(data.includes(Buffer.from(secret)),false)}}}
 audit('.next-hosted/static');pass()
 await new Promise((resolve,reject)=>{const probe=createPortProbe();probe.once('error',reject);probe.listen(3108,'127.0.0.1',()=>probe.close(resolve))})
 // Explicit loopback bind: never use the hosted 0.0.0.0 launcher locally before approval.
 server=spawn(process.execPath,['scripts/staging/hosted-server.mjs','--loopback-preflight'],{env:{...env,PORT:'3108'},stdio:['ignore','pipe','pipe'],windowsHide:true});server.stdout.resume();server.stderr.resume()
 const origin='http://127.0.0.1:3108',host=new URL(HOSTED_ORIGIN).host
 const headers={host,'x-forwarded-host':host,'x-forwarded-proto':'https'}
 const authorization='Basic '+Buffer.from(access.username+':'+access.password).toString('base64')
 const request=(path,extra={})=>new Promise((resolve,reject)=>{
  const r=httpRequest(origin+path,{method:extra.method||'GET',headers:{...headers,...extra.headers},timeout:5000},response=>{
   const chunks=[];response.on('data',c=>chunks.push(c));response.on('end',()=>resolve(new Response(Buffer.concat(chunks),{status:response.statusCode,headers:response.headers})))
  });r.on('error',reject);r.on('timeout',()=>r.destroy(Error('Local preflight timeout')));r.end(extra.body)
 })
 check('minimal liveness without data or authentication')
 let ready=false
 for(let i=0;i<40;i++){try{const r=await request('/api/staging/health');if(r.status===200){assert.equal(await r.text(),'ok');ready=true;break}}catch{/* startup only */}await delay(250)}
 assert.ok(ready);pass()
 check('production proxy challenges pages, APIs and static assets')
 for(const path of ['/auth/recovery','/api/staging/identity','/_next/static/test.js','/test.png'])assert.equal((await request(path)).status,401,path)
 pass()
 check('approved proxy origin and exact built staging identity')
 const identity=await request('/api/staging/identity',{headers:{authorization}});assert.equal(identity.status,200)
 const data=await identity.json();assert.equal(data.commit,provenance.commit);assert.equal(data.projectRef,STAGING_PROJECT);assert.equal(data.origin,HOSTED_ORIGIN);assert.match(identity.headers.get('cache-control'),/no-store/);pass()
 check('access password does not authorize recovery or private evidence')
 const recovery=await request('/api/auth/recovery/password',{method:'POST',headers:{authorization,origin:HOSTED_ORIGIN,'content-type':'application/json'},body:JSON.stringify({password:'synthetic-no-grant'})});assert.equal(recovery.status,401)
 const photo=await request('/api/reports/11111111-1111-4111-8111-111111111111/evidence/22222222-2222-4222-8222-222222222222',{headers:{authorization}});assert.equal(photo.status,401);pass()
 check('origin spoofing and checkout remain blocked')
 assert.equal((await request('/api/staging/identity',{headers:{authorization,origin:'https://evil.test'}})).status,403)
 assert.equal((await request('/api/staging/identity',{headers:{authorization,host:'evil.test','x-forwarded-host':'evil.test'}})).status,421)
 const checkout=await request('/api/checkout',{method:'POST',headers:{authorization,origin:HOSTED_ORIGIN,'content-type':'application/json'},body:'{}'});assert.equal(checkout.status,401);assert.equal((await checkout.json()).code,'unauthorized');pass()
 result.status='PASS';console.log('PASS: '+result.checks.length+' loopback production preflight groups; no email or publication.')
}catch(error){result.status='FAIL';result.checks.push({name:current,status:'FAIL',reason:error.code||error.name,actual:error.actual,expected:error.expected});console.error('FAIL: '+current+'; '+(error.code||error.name)+'; actual '+error.actual+' expected '+error.expected);process.exitCode=1}
// A local check owns its result only; preserve operator authorization and the actual next action.
finally{server?.kill();writeFileSync(output+'/preflight.json',JSON.stringify(result,null,2));const p='.staging/physical-phone-checkpoint.json',s=JSON.parse(readFileSync(p));s.localPreflight=result;writeFileSync(p,JSON.stringify(s,null,2))}
