import test from 'node:test'
import assert from 'node:assert/strict'
import {randomBytes} from 'node:crypto'
import {demoConfig,demoCredentials,demoDigest,sealDemo,openDemo,demoRpcAllowed,demoLimiter,demoBody} from '../lib/staging/demo.mjs'
import {hostedStagingGate,HOSTED_ORIGIN,accessDigest} from '../lib/staging/hosted.mjs'
const c={enabled:true,user:'11111111-1111-4111-8111-111111111111',company:'22222222-2222-4222-8222-222222222222',site:'33333333-3333-4333-8333-333333333333',key:randomBytes(32).toString('hex'),salt:'synthetic salt',login:'demo',email:'synthetic@example.test',password:'server-only',digest:demoDigest('synthetic passphrase','synthetic salt')}
const env={HOSTED_STAGING:'1',APP_ENV:'staging',NEXT_PUBLIC_APP_URL:HOSTED_ORIGIN,NEXT_PUBLIC_SUPABASE_URL:'https://yqkiizimbtlygovkscoh.supabase.co',STAGING_ACCESS_SHA256:accessDigest('unrelated:private-gate'),PHONE_DEMO_CONFIG:Buffer.from(JSON.stringify(c)).toString('base64')}
test('demo capability is encrypted, expiring, revocable and bound to isolated configuration',()=>{
 assert.ok(demoConfig(env));assert.equal(demoConfig({...env,APP_ENV:'production'}),null);assert.equal(demoConfig({...env,NEXT_PUBLIC_SUPABASE_URL:'https://other.supabase.co'}),null)
 assert.equal(demoCredentials(c,'demo','synthetic passphrase'),true);assert.equal(demoCredentials(c,'other','synthetic passphrase'),false);assert.equal(demoCredentials(c,'demo','wrong'),false)
 const value=sealDemo(c,'private-synthetic-token',Date.now()+60000)
 assert.equal(value.includes('private-synthetic-token'),false);assert.equal(openDemo(c,value).token,'private-synthetic-token');assert.equal(openDemo({...c,key:randomBytes(32).toString('hex')},value),null);assert.equal(openDemo(c,value+'x'),null);assert.equal(openDemo(c,sealDemo(c,'expired',Date.now()-1)),null)
})
test('demo perimeter preserves engineering gate, blocks administration and acknowledgement commands',()=>{
 const req=(path,cookie,method='GET',origin=HOSTED_ORIGIN)=>new Request(HOSTED_ORIGIN+path,{method,headers:{origin,...(cookie?{cookie:'ts_phone_demo='+cookie}:{})}})
 assert.equal(hostedStagingGate(req('/demo'),env),null);assert.equal(hostedStagingGate(req('/sites'),env).status,401)
 const value=sealDemo(c,'private',Date.now()+60000)
 for(const path of ['/settings','/join','/auth/login','/api/auth/recovery/request','/api/checkout','/api/pilot','/api/staging/identity'])assert.equal(hostedStagingGate(req(path,value),env).status,403)
 assert.equal(hostedStagingGate(req('/sites/'+c.site+'/electrical',value),env),null)
 assert.equal(hostedStagingGate(req('/api/demo',null,'POST','https://unrelated.invalid'),env).status,403)
 assert.equal(demoRpcAllowed('ts_command',{command:'create_company',p:{}},c),false)
 assert.equal(demoRpcAllowed('ts_brief_command',{command:'acknowledge',p:{companyId:c.company}},c),false)
 assert.equal(demoRpcAllowed('ts_command',{command:'update_action',p:{companyId:c.company}},c),true)
 assert.equal(demoRpcAllowed('ts_command',{command:'update_action',p:{companyId:'other'}},c),false)
})
test('demo login caps parallel/global attempts and streamed body size',async()=>{
 const take=demoLimiter(),one=take(),two=take();assert.equal(take(),null);one();one();two();for(let i=0;i<17;i++){const r=take();assert.ok(r);r()}assert.equal(take(),null)
 const req=value=>new Request('http://localhost/api/demo',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(value)})
 assert.equal((await demoBody(req({login:'demo'}))).login,'demo');await assert.rejects(()=>demoBody(req({value:'x'.repeat(1025)})));await assert.rejects(()=>demoBody(req([])))
})
