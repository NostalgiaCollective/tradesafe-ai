// Real PostgreSQL lock interleavings on the existing disposable CI database only.
import assert from 'node:assert/strict'
import {spawn,execFileSync} from 'node:child_process'
import {randomBytes,randomUUID,createHash} from 'node:crypto'
import {writeFileSync} from 'node:fs'
import {setTimeout as delay} from 'node:timers/promises'
import {createClient} from '@supabase/supabase-js'
import sharp from 'sharp'
import {identity,assertIdentity} from '../operations/local-rehearsal.mjs'
import {localEnvironment,API_ORIGIN} from './local-environment.mjs'
const literal=value=>"'"+String(value).replaceAll("'","''")+"'"
const ok=r=>{assert.equal(r.error,null,'Synthetic local operation failed');return r.data}
export async function completionConcurrency(env){
 localEnvironment({API_URL:env.NEXT_PUBLIC_SUPABASE_URL,ANON_KEY:env.NEXT_PUBLIC_SUPABASE_ANON_KEY,SERVICE_ROLE_KEY:env.SUPABASE_SERVICE_ROLE_KEY})
 const target=identity('tradesafe-ci');assertIdentity(target)
 const client=key=>createClient(API_ORIGIN,key,{auth:{persistSession:false,autoRefreshToken:false}}),admin=client(env.SUPABASE_SERVICE_ROLE_KEY)
 const actors=[]
 for(let i=0;i<3;i++){const credentials={email:'completion-race-'+randomUUID()+'@example.test',password:randomBytes(24).toString('base64url')};ok(await admin.auth.admin.createUser({...credentials,email_confirm:true}));const c=client(env.NEXT_PUBLIC_SUPABASE_ANON_KEY),a=ok(await c.auth.signInWithPassword(credentials));actors.push({client:c,id:a.user.id,email:credentials.email})}
 const [owner,worker,other]=actors,company=randomUUID(),site=randomUUID()
 const command=(a,fn,name,p)=>a.client.rpc(fn,{command:name,p:{companyId:company,requestId:randomUUID(),...p}}).then(ok)
 await command(owner,'ts_command','create_company',{id:company,name:'SYNTHETIC completion concurrency'})
 for(const a of [worker,other]){const token=randomBytes(32).toString('hex');await command(owner,'ts_command','invite',{email:a.email,role:'worker',token});await command(a,'ts_command','accept_invitation',{token})}
 await command(owner,'ts_site_command','create',{id:site,document:{name:'SYNTHETIC concurrency site',address:'Fictional Ontario kitchen',instructions:''}})
 async function action(){const id=randomUUID();let c=await command(owner,'ts_concern_command','create',{id,siteId:site,document:{observation:'SYNTHETIC label discrepancy',location:'Training panel',immediate:'No real work performed',observedAt:''}});await command(owner,'ts_concern_command','submit',{id,revision:c.revision});const a=ok(await owner.client.from('ts_actions').select('*').eq('concern_id',id).single());return command(owner,'ts_command','update_action',{id:a.id,revision:a.revision,responsibleId:worker.id,controls:a.controls,resolution:'',state:a.state,targetDate:'',priority:a.priority})}
 const sql=statement=>execFileSync('docker',['exec','-i',target.container,'psql','-X','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-Atc',statement],{stdio:'pipe',timeout:15000}).toString().trim()
 async function blocker(){
  assertIdentity(target)
  const child=spawn('docker',['exec','-i',target.container,'psql','-X','-q','-A','-t','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1'],{stdio:'pipe'});let output='',errors=''
  child.stdout.on('data',b=>{output+=b});child.stderr.on('data',b=>{errors+=b})
  const finished=new Promise((resolve,reject)=>{child.once('error',()=>reject(Error('Local transaction process failed')));child.once('exit',code=>code===0?resolve():reject(Error('Local transaction failed')))})
  // Prevent a rejected process promise becoming unhandled while polling readiness.
  finished.catch(()=>{})
  child.stdin.write(`BEGIN; SET LOCAL statement_timeout='20s'; SELECT id FROM public.ts_companies WHERE id=${literal(company)} FOR UPDATE; SELECT 'LOCK_READY';\n`)
  for(let i=0;i<100&&!output.includes('LOCK_READY');i++){if(errors||child.exitCode!==null)throw Error('Local lock could not be acquired');await delay(50)}
  assert.ok(output.includes('LOCK_READY'),'Actual transaction must hold company lock')
  return {async release(statement=''){child.stdin.end(statement+'; COMMIT;\n\\q\n');await finished},abort(){if(child.exitCode===null)child.stdin.end('ROLLBACK;\n\\q\n')}}
 }
 async function waiting(count){for(let i=0;i<100;i++){const n=Number(sql("SELECT count(*) FROM pg_stat_activity WHERE datname='postgres' AND wait_event_type='Lock' AND (query LIKE '%ts_action_completion%' OR query LIKE '%ts_complete_action_photo%')"));if(n>=count)return;await delay(50)}throw Error('Expected concurrent PostgreSQL lock wait was not observed')}
 const payload=(a,id=randomUUID())=>({id,actionId:a.id,revision:a.revision,notes:'SYNTHETIC completion progress',state:'in_progress',evidenceIds:[]})
 const receipts=[]
 // Both RPCs demonstrably wait on the same held PostgreSQL row lock.
 for(const sameId of [true,false]){
  const a=await action(),p=payload(a),second=sameId?p:payload(a),hold=await blocker()
  try{const one=worker.client.rpc('ts_action_completion',{p}).then(r=>r),two=worker.client.rpc('ts_action_completion',{p:second}).then(r=>r);await waiting(2);await hold.release();const results=await Promise.all([one,two]);assert.equal(results.filter(r=>!r.error).length,sameId?2:1);if(sameId)assert.equal(results[0].data.update.id,results[1].data.update.id);else assert.equal(results.find(r=>r.error).error.message,'TS_conflict');assert.equal(ok(await owner.client.from('ts_action_updates').select('id').eq('action_id',a.id)).length,1);receipts.push({case:sameId?'concurrent identical retry':'concurrent stale revisions',blockedTransactions:2,retainedUpdates:1})}finally{hold.abort()}
 }
 const bytes=await sharp({create:{width:24,height:24,channels:3,background:'#dd8822'}}).jpeg().toBuffer()
 for(const revoke of [false,true]){
  const a=await action(),updateId=randomUUID(),id=randomUUID(),photo=await command(worker,'ts_action_photo','reserve',{id,updateId,actionId:a.id,revision:a.revision,caption:'SYNTHETIC completion evidence',sha256:createHash('sha256').update(bytes).digest('hex'),byteSize:bytes.length,width:24,height:24})
  ok(await admin.storage.from('tradesafe-evidence').upload(photo.object_path,bytes,{contentType:'image/jpeg',upsert:false}))
  const hold=await blocker()
  try{const completion=admin.rpc('ts_complete_action_photo',{evidence_id:id,actor_id:worker.id}).then(r=>r);await waiting(1)
   const p=revoke?{companyId:company,userId:worker.id,role:'remove',requestId:randomUUID()}:{companyId:company,id:a.id,revision:a.revision,requestId:randomUUID(),responsibleId:other.id,controls:a.controls,resolution:a.resolution,state:a.state,targetDate:'',priority:a.priority}
   const mutation=`SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claim.sub',${literal(owner.id)},true); SELECT public.ts_command(${literal(revoke?'member':'update_action')},${literal(JSON.stringify(p))}::jsonb)`
   await hold.release(mutation);const result=await completion;assert.equal(result.error?.message,'TS_denied');assert.equal(ok(await admin.from('ts_action_photos').select('state').eq('id',id).single()).state,'pending');assert.equal(ok(await admin.from('ts_action_updates').select('id').eq('id',updateId)).length,0);receipts.push({case:revoke?'membership removed while upload completion blocked':'reassigned while upload completion blocked',blockedTransactions:1,publishedUpdates:0,photoState:'pending'})
  }finally{hold.abort()}
 }
 const receipt={status:'PASSED',commit:env.GITHUB_SHA||null,at:new Date().toISOString(),runtime:'Actual disposable PostgreSQL; independent psql and authenticated PostgREST transactions',cases:receipts,limitations:['Synthetic local database only; no hosted or physical-device result','No worker credentials, tokens or report content in this receipt']}
 writeFileSync('test-results/action-completion-concurrency.json',JSON.stringify(receipt,null,2));return receipt
}
