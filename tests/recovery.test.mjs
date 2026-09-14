import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { PGlite } from '@electric-sql/pglite'
import { allowedRecoveryRequest, boundedJson, fingerprint, fixedRecoveryUrl, normalizeEmail, seal, unseal, validPassword } from '../lib/recovery/security.mjs'
import { changeRecoveredPassword, dispatchRecovery } from '../lib/recovery/flow.mjs'

test('request confirmations are identical for absent accounts, suppression, rate limits and provider/network failure',async()=>{
 const success=await dispatchRecovery({accepted:true,permitted:true,send:async()=>({error:null})})
 for(const send of [async()=>({error:{code:'over_email_send_rate_limit'}}),async()=>({error:{code:'email_address_not_authorized'}}),async()=>{throw Error('network') }])assert.deepEqual(await dispatchRecovery({accepted:true,permitted:true,send}),success)
 for(const flags of [{accepted:false,permitted:true},{accepted:true,permitted:false}])assert.deepEqual(await dispatchRecovery({...flags,send:()=>{assert.fail('suppressed email must not be sent')}}),success)
})

test('recovery origin and path contract rejects redirect bypasses and bounds input',async()=>{
 const origin='https://app.example.test'
 assert.equal(fixedRecoveryUrl(origin),origin+'/auth/recovery')
 for(const unsafe of ['https://evil.test','//evil.test','/%2f%2fevil.test','/%5cevil.test','/%252f%252fevil.test','/auth/callback','/api/checkout','/logout']){
  const request=new Request(origin+'/api/auth/recovery/request?next='+encodeURIComponent(unsafe),{method:'POST',headers:{origin,'content-type':'application/json'},body:'{}'})
  assert.equal(allowedRecoveryRequest(request,origin),false)
 }
 for(const external of ['https://evil.test','null',origin+'.evil.test'])assert.equal(allowedRecoveryRequest(new Request(origin+'/api/auth/recovery/request',{headers:{origin:external,'content-type':'application/json'}}),origin),false)
 assert.throws(()=>fixedRecoveryUrl('https://app.example.test/unsafe'))
 assert.throws(()=>fixedRecoveryUrl('https://user@app.example.test'))
 assert.equal(normalizeEmail(' Test@Example.test '),'test@example.test')
 assert.equal(normalizeEmail('bad\n@example.test'),null)
 assert.equal(validPassword('short'),false);assert.equal(validPassword('LongerPassword1!'),true);assert.equal(validPassword('界'.repeat(25)),false)
 await assert.rejects(boundedJson(new Request(origin,{method:'POST',body:'x'.repeat(4097)})))
})

test('recovery session envelopes resist tampering and separate throttle/password identities',()=>{
 const secret='a'.repeat(48),value={access_token:'synthetic-secret',user:'synthetic'}
 const ciphertext=seal(secret,value);assert.ok(!ciphertext.includes(value.access_token));assert.deepEqual(unseal(secret,ciphertext),value)
 const bytes=Buffer.from(ciphertext,'base64url');bytes[30]^=1
 assert.throws(()=>unseal(secret,bytes.toString('base64url')));assert.throws(()=>unseal('b'.repeat(48),ciphertext))
 assert.notEqual(fingerprint(secret,'email','one'),fingerprint(secret,'grant','one'))
})

test('durable recovery limits and grants enforce shared throttles, expiry, one-use and attempt ownership',async()=>{
 const db=new PGlite(),user=randomUUID(),id='a'.repeat(64),attempt=randomUUID()
 try{
  await db.exec('CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role BYPASSRLS;CREATE SCHEMA auth;CREATE TABLE auth.users(id uuid PRIMARY KEY);GRANT USAGE ON SCHEMA public TO service_role,authenticated,anon;')
  await db.query('INSERT INTO auth.users VALUES($1)',[user])
  await db.exec(await readFile(new URL('../supabase/migrations/20260914000200_password_recovery.sql',import.meta.url),'utf8'))
  const call=async(command,p)=>(await db.query('SELECT ts_recovery_grant($1,$2) AS value',[command,JSON.stringify(p)])).rows[0].value
  const limit=async(kind,subject)=>(await db.query('SELECT ts_recovery_limit($1,$2) AS value',[kind,subject])).rows[0].value
  await db.exec('SET ROLE authenticated')
  await assert.rejects(call('create',{id,userId:user,session:'fake'}),/permission denied/)
  await assert.rejects(limit('request',id),/permission denied/)
  await assert.rejects(db.query('SELECT * FROM ts_recovery_grants'),/permission denied/)
  await db.exec('RESET ROLE;SET ROLE service_role')
  assert.equal(await limit('request',id),true);assert.equal(await limit('request',id),false)
  for(let i=0;i<19;i++)assert.equal(await limit('request',i.toString(16).padStart(64,'0')),true)
  assert.equal(await limit('request','b'.repeat(64)),false)
  for(let i=0;i<6;i++)assert.equal(await limit('verify',id),true)
  assert.equal(await limit('verify',id),false)
  await assert.rejects(call('get',{id}),/recovery_expired/)
  await call('create',{id,userId:user,session:'encrypted'})
  const job=await call('begin',{id,attempt,digest:'c'.repeat(64)});assert.equal(job.state,'updating');assert.equal(job.resumed,false)
  await assert.rejects(call('begin',{id,attempt:randomUUID(),digest:'c'.repeat(64)}),/recovery_busy/)
  await assert.rejects(call('complete',{id,attempt}),/recovery_conflict/)
  await assert.rejects(call('changed',{id,attempt:randomUUID()}),/recovery_conflict/)
  await db.exec("RESET ROLE;UPDATE ts_recovery_grants SET lease_until=now()-interval '1 second';SET ROLE service_role")
  await assert.rejects(call('begin',{id,attempt:randomUUID(),digest:'d'.repeat(64)}),/recovery_conflict/)
  const retry=randomUUID();assert.equal((await call('begin',{id,attempt:retry,digest:'c'.repeat(64)})).resumed,true)
  await assert.rejects(call('changed',{id,attempt}),/recovery_conflict/)
  await call('changed',{id,attempt:retry});await call('complete',{id,attempt:retry})
  assert.equal((await call('get',{id})).encrypted_session,'')
  assert.equal((await call('begin',{id,attempt:randomUUID(),digest:'e'.repeat(64)})).state,'complete')
  await db.exec("RESET ROLE;UPDATE ts_recovery_grants SET expires_at=now()-interval '1 second';SET ROLE service_role")
  await assert.rejects(call('get',{id}),/recovery_expired/)
 }finally{await db.close()}
})

test('interrupted provider password updates reconcile exact password and revoke globally before completion',async()=>{
 const user=randomUUID(),events=[]
 const run=async({resumed=false,failUpdate=false,failSignout=false,wrongUser=false}={})=>{
  const job={state:'updating',user_id:user,encrypted_session:'sealed',resumed}
  return changeRecoveredPassword({grant:{id:'a'},password:'NewPassword1!',attempt:'attempt',digest:'digest',openSession:()=>({email:'synthetic@example.test'}),save:async(cmd)=>{events.push(cmd);return job},provider:()=>({auth:{
   setSession:async()=>({data:{user:{id:user}}}),
   updateUser:async()=>{events.push('update');return failUpdate?{error:{code:'network'}}:{data:{user:{id:user}}}},
   signInWithPassword:async()=>{events.push('prove');return {data:{user:{id:wrongUser?'other':user}}}},
   signOut:async({scope})=>{events.push(scope);return {error:failSignout?{}:null}}
  }})})
 }
 await assert.rejects(run({failUpdate:true}),/recovery_uncertain/);assert.ok(!events.includes('complete'))
 events.length=0;await run({resumed:true});assert.deepEqual(events,['begin','prove','changed','global','complete'])
 events.length=0;await assert.rejects(run({failSignout:true}),/recovery_uncertain/);assert.ok(!events.includes('complete'))
 events.length=0;await assert.rejects(run({resumed:true,wrongUser:true}),/recovery_unavailable/);assert.ok(!events.includes('update'))
})
