import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {randomUUID,createHash} from 'node:crypto'
import {PGlite} from '@electric-sql/pglite'
import {acquireSlot} from '../lib/evidence/resource-slots.mjs'
import {request} from '../lib/client/request.mjs'
import {readImageBody} from '../lib/evidence/images.mjs'

test('a stalled upload is cancelled and fails instead of holding a processing slot forever',async()=>{
 let cancelled=false
 const body=new ReadableStream({cancel(){cancelled=true}})
 await assert.rejects(readImageBody(new Request('https://example.test',{method:'POST',body,duplex:'half'}),5),{code:'request_timeout'})
 assert.equal(cancelled,true)
})

test('requests bound waits, distinguish gate/session, sanitize errors and never turn failures into success',async()=>{
 const original=globalThis.fetch
 try{
  for(const [response,code] of [[new Response('',{status:401}),'unauthorized'],[new Response('',{status:401,headers:{'WWW-Authenticate':'Basic realm="staging"'}}),'gate'],[Response.json({code:'resource_limited',error:'secret'},{status:429}),'resource_limited'],[new Response('secret',{status:502}),'unavailable']]){
   globalThis.fetch=async()=>response;await assert.rejects(request('/test'),e=>e.code===code&&!e.message.includes('secret'))
  }
  globalThis.fetch=(_url,{signal})=>new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(Error('secret'))))
  await assert.rejects(request('/test',{timeoutMs:5}),{code:'timeout'})
  globalThis.fetch=async()=>{throw Error('secret')};await assert.rejects(request('/test'),{code:'network'})
  globalThis.fetch=async()=>Response.json({state:'ready'});assert.equal((await request('/test')).state,'ready')
 }finally{globalThis.fetch=original}
})
test('processing slots reject excess work and release only once',()=>{
 const a=acquireSlot('upload'),b=acquireSlot('upload'),pdf=acquireSlot('pdf')
 try{assert.throws(()=>acquireSlot('upload'),{code:'resource_busy'});assert.throws(()=>acquireSlot('pdf'),{code:'resource_busy'});a();a();const c=acquireSlot('upload');assert.throws(()=>acquireSlot('upload'),{code:'resource_busy'});c()}finally{a();b();pdf()}
 acquireSlot('pdf')()
})
test('durable resource budgets enforce authorization, bounded slots, limits and window reset',async()=>{
 const db=new PGlite(),owner=randomUUID(),other=randomUUID(),unverified=randomUUID(),company=randomUUID(),draft=randomUUID(),final=randomUUID()
 try{
  await db.exec(`CREATE ROLE authenticated;CREATE ROLE anon;CREATE ROLE service_role BYPASSRLS;CREATE SCHEMA auth;
   CREATE TABLE auth.users(id uuid PRIMARY KEY,email_confirmed_at timestamptz);
   CREATE TABLE public.ts_reports(id uuid PRIMARY KEY,company_id uuid,lifecycle text,author_id uuid);
   CREATE TABLE public.ts_members(company_id uuid,user_id uuid,active boolean,role text);
   GRANT USAGE ON SCHEMA public TO authenticated,anon,service_role;`)
  await db.query('INSERT INTO auth.users VALUES($1,now()),($2,now()),($3,null)',[owner,other,unverified])
  await db.query("INSERT INTO public.ts_reports VALUES($1,$3,'draft',$4),($2,$3,'finalized',$4)",[draft,final,company,owner])
  await db.query("INSERT INTO public.ts_members VALUES($1,$2,true,'owner'),($1,$3,true,'worker')",[company,owner,unverified])
  await db.exec(await readFile(new URL('../supabase/migrations/20260916000100_resource_admission.sql',import.meta.url),'utf8'))
  const call=async(kind,id=draft,actor=owner)=>(await db.query('SELECT public.ts_resource_admit($1,$2,$3) AS value',[kind,id,actor])).rows[0].value
  await db.exec('SET ROLE authenticated');await assert.rejects(call('upload'),/permission denied/)
  await db.exec('RESET ROLE;SET ROLE service_role');await assert.rejects(db.query('SELECT * FROM public.ts_resource_limits'),/permission denied/)
  await assert.rejects(call('upload',draft,other),/TS_denied/);await assert.rejects(call('upload',draft,unverified),/TS_denied/);await assert.rejects(call('upload',final),/TS_denied/);await assert.rejects(call('pdf',draft),/TS_incomplete/)
  for(let i=0;i<20;i++)assert.equal(await call('upload'),true)
  assert.equal(await call('upload'),false)
  for(let i=0;i<5;i++)assert.equal(await call('pdf',final),true)
  assert.equal(await call('pdf',final),false)
  await db.exec('RESET ROLE');assert.equal((await db.query('SELECT count(*)::int AS n FROM public.ts_resource_limits')).rows[0].n,6)
  await db.exec("UPDATE public.ts_resource_limits SET window_start=now()-interval '11 minutes';SET ROLE service_role")
  assert.equal(await call('upload'),true)
  // Distinct fixed slots make the company/global boundary deterministic.
  await db.exec('RESET ROLE')
  const used=new Set([owner,company].map(v=>createHash('md5').update(v).digest('hex').slice(-3)))
  const fresh=()=>{let id,slot;do{id=randomUUID();slot=createHash('md5').update(id).digest('hex').slice(-3)}while(used.has(slot));used.add(slot);return id}
  const second=fresh(),company2=fresh(),a=fresh(),b=fresh(),company3=fresh(),third=fresh(),draft2=randomUUID(),draft3=randomUUID()
  for(const id of [second,a,b,third])await db.query('INSERT INTO auth.users VALUES($1,now())',[id])
  for(const [co,id] of [[company,second],[company2,a],[company2,b],[company3,third]])await db.query("INSERT INTO public.ts_members VALUES($1,$2,true,'owner')",[co,id])
  for(const [id,co,actor] of [[draft2,company2,a],[draft3,company3,third]])await db.query("INSERT INTO public.ts_reports VALUES($1,$2,'draft',$3)",[id,co,actor])
  await db.exec('SET ROLE service_role')
  for(let i=0;i<19;i++)assert.equal(await call('upload'),true)
  for(let i=0;i<10;i++)assert.equal(await call('upload',draft,second),true)
  assert.equal(await call('upload',draft,second),false,'company budget')
  for(let i=0;i<20;i++)assert.equal(await call('upload',draft2,a),true)
  for(let i=0;i<10;i++)assert.equal(await call('upload',draft2,b),true)
  assert.equal(await call('upload',draft3,third),false,'global budget')
 }finally{await db.close()}
})
