// Explicit opt-in, synthetic accounts, isolated hosted Supabase only. No destructive cleanup.
// This is separate from npm test: absence of services is BLOCKED, never a passing mock.
import nextEnv from '@next/env'
import { createClient } from '@supabase/supabase-js'
import { randomUUID,randomBytes } from 'node:crypto'
import assert from 'node:assert/strict'
import { getTemplate } from '../lib/domain/templates.ts'
import { validPublicKey } from '../lib/domain/config.ts'
nextEnv.loadEnvConfig(process.cwd())
const required=['NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_ANON_KEY','STAGING_ISOLATED_PROJECT_REF',...['OWNER','WORKER','SUPERVISOR','OUTSIDER'].flatMap(role=>['STAGING_'+role+'_EMAIL','STAGING_'+role+'_PASSWORD'])]
const missing=required.filter(k=>!process.env[k])
if(process.env.APP_ENV!=='staging'||process.env.STAGING_ALLOW_SYNTHETIC_WRITES!=='yes'||missing.length){
 console.error('BLOCKED: isolated staging configuration and explicit synthetic-write opt-in required. Missing names: '+missing.join(', '));process.exit(2)
}
const origin=new URL(process.env.NEXT_PUBLIC_SUPABASE_URL)
assert.equal(origin.origin,'https://'+process.env.STAGING_ISOLATED_PROJECT_REF+'.supabase.co','Isolated project reference must match exactly')
assert.ok(validPublicKey(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),'Only a public/anon key is allowed')
const clients=[]
try{
 for(const role of ['OWNER','WORKER','SUPERVISOR','OUTSIDER']){
  const client=createClient(origin.origin,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}})
  const auth=await client.auth.signInWithPassword({email:process.env['STAGING_'+role+'_EMAIL'],password:process.env['STAGING_'+role+'_PASSWORD']})
  if(auth.error)throw new Error('Synthetic account sign-in failed: '+role)
  const verified=await client.auth.getUser();assert.ok(!verified.error&&verified.data.user?.email_confirmed_at,'Use verified synthetic accounts')
  clients.push({client,user:verified.data.user})
 }
 const [owner,worker,supervisor,outsider]=clients,companyId=randomUUID(),template=getTemplate('electrical'),reportId=randomUUID()
 assert.equal(new Set(clients.map(c=>c.user.id)).size,4,'Four separately authenticated identities required')
 const rpc=async(who,command,p)=>who.client.rpc('ts_command',{command,p:{companyId,requestId:randomUUID(),...p}})
 const ok=async(result,label)=>{const r=await result;if(r.error)throw new Error('Failed staging check: '+label);return r.data}
 await ok(rpc(owner,'create_company',{id:companyId,name:'SYNTHETIC Phase 2 '+new Date().toISOString()}),'create company')
 for(const [person,role] of [[worker,'worker'],[supervisor,'supervisor']]){
  const token=randomBytes(32).toString('hex')
  await ok(rpc(owner,'invite',{email:person.user.email,role,token}),'create bound invitation')
  assert.ok((await rpc(outsider,'accept_invitation',{token})).error,'Wrong identity cannot accept')
  await ok(rpc(person,'accept_invitation',{token}),'accept intended invitation')
 }
 const first=await ok(rpc(worker,'create_report',{id:reportId,templateId:template.id}),'create report')
 assert.equal((await ok(rpc(worker,'create_report',{id:reportId,templateId:template.id}),'duplicate retry')).id,first.id)
 assert.ok(Object.values(first.document.answers).every(a=>a.state==='unanswered'))
 const invisible=await outsider.client.from('ts_reports').select('*').eq('id',reportId)
 assert.ok(!invisible.error);assert.equal(invisible.data.length,0,'Cross-company SELECT denied by RLS')
 assert.ok((await outsider.client.from('ts_reports').update({lifecycle:'finalized'}).eq('id',reportId)).error,'Direct UPDATE privilege denied')
 assert.ok((await worker.client.from('ts_reports').update({finalized_by:worker.user.id,lifecycle:'finalized'}).eq('id',reportId)).error,'Own-row trusted fields cannot be written directly')
 assert.ok((await rpc(worker,'finalize',{id:reportId,revision:1,acknowledged:true})).error,'Incomplete finalization denied')
 const document={job:{address:'SYNTHETIC test site',client:'Fixture',date:'2026-09-11'},answers:Object.fromEntries(template.items.map(i=>[i.id,{state:'meets',note:'',controls:''}]))}
 document.answers[template.items[0].id]={state:'attention',note:'Synthetic unresolved concern',controls:'Synthetic control'}
 const save={id:reportId,revision:1,document,requestId:randomUUID()}
 const saved=await ok(rpc(worker,'save_report',save),'save draft')
 assert.equal((await ok(rpc(worker,'save_report',save),'retry save')).revision,saved.revision)
 assert.ok((await rpc(worker,'save_report',{...save,requestId:randomUUID()})).error,'Stale revision rejected')
 const reload=await worker.client.from('ts_reports').select('*').eq('id',reportId).single();assert.ok(!reload.error);assert.deepEqual(reload.data.document,document)
 const finalized=await ok(rpc(worker,'finalize',{id:reportId,revision:saved.revision,acknowledged:true}),'finalize with concern')
 assert.equal(finalized.lifecycle,'finalized')
 assert.ok((await rpc(worker,'save_report',{id:reportId,revision:finalized.revision,document})).error,'Finalized snapshot immutable')
 assert.ok((await rpc(worker,'grant_payment',{id:reportId})).error,'Payment cannot change lifecycle')
 const actions=await worker.client.from('ts_actions').select('*').eq('report_id',reportId);assert.ok(!actions.error);assert.equal(actions.data.length,1)
 const a=actions.data[0],update={id:a.id,revision:a.revision,state:'closed',responsibleId:worker.user.id,controls:a.controls,resolution:'Synthetic verification',targetDate:''}
 assert.ok((await rpc(worker,'update_action',update)).error,'Worker cannot verify closure')
 const closed=await ok(rpc(supervisor,'update_action',update),'supervisor verification');assert.equal(closed.verified_by,supervisor.user.id)
 await ok(rpc(supervisor,'update_action',{...update,revision:closed.revision,state:'open'}),'reopen action')
 const history=await supervisor.client.from('ts_events').select('*').eq('entity_id',a.id);assert.ok(!history.error);assert.ok(history.data.some(e=>e.before_value?.verified_by===supervisor.user.id))
 const amendment=await ok(rpc(worker,'amend',{id:randomUUID(),amendmentOf:reportId,reason:'Synthetic correction'}),'amendment');assert.equal(amendment.amendment_of,reportId)
 assert.ok((await rpc(owner,'member',{userId:owner.user.id,role:'remove'})).error,'Last owner retained')
 await ok(rpc(owner,'member',{userId:worker.user.id,role:'remove'}),'remove member')
 const removed=await worker.client.from('ts_reports').select('*').eq('id',reportId);assert.ok(!removed.error);assert.equal(removed.data.length,0)
 assert.ok((await rpc(worker,'create_report',{id:randomUUID(),templateId:template.id})).error,'Removed member cannot write')
 console.log('PASS: real isolated Supabase Auth/RPC/Data API boundaries. Synthetic records retained for review; no production operations.')
}catch{
 console.error('FAIL: isolated staging integration. Review the test assertions and isolated provider logs without sharing credentials.');process.exitCode=1
}finally{for(const entry of clients)await entry.client.auth.signOut({scope:'local'})}
