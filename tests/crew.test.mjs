import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {randomUUID} from 'node:crypto'
import {PGlite} from '@electric-sql/pglite'
import {participation} from '../lib/domain/crew.mjs'
import {safeRedirect} from '../lib/domain/validation.ts'
import {actionFilters,actionListUrl} from '../lib/domain/action-list.ts'

test('crew projections preserve company access, exact-version responses and assignment history',async()=>{
 const db=new PGlite(),[owner,worker,supervisor,outsider]=Array.from({length:4},randomUUID),company=randomUUID(),id=randomUUID()
 try{
  await db.exec(`CREATE ROLE authenticated;CREATE ROLE anon;CREATE SCHEMA auth;CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,email_confirmed_at timestamptz);CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;GRANT USAGE ON SCHEMA public,auth TO authenticated,anon;`)
  for(const [i,u] of [owner,worker,supervisor,outsider].entries())await db.query('INSERT INTO auth.users VALUES($1,$2,now())',[u,`crew${i}@example.test`])
  for(const f of ['20260911000100_staging_baseline','20260911000200_company_workflow','20260911000300_template_v1','20260921000100_daily_briefs','20260921000200_brief_action_assignment','20260921000300_brief_content','20260922000100_sites','20260923000100_crew_coordination'])await db.exec(await readFile(new URL('../supabase/migrations/'+f+'.sql',import.meta.url),'utf8'))
  const as=async u=>{await db.exec('RESET ROLE;SET ROLE authenticated');await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[u])}
  const rpc=async(fn,n,p={})=>(await db.query(`SELECT public.${fn}($1,$2::jsonb) v`,[n,JSON.stringify({companyId:company,id,requestId:randomUUID(),...p})])).rows[0].v
  const cmd=(n,p)=>rpc('ts_command',n,p),brief=(n,p)=>rpc('ts_brief_command',n,p),rows=async t=>(await db.query('SELECT to_jsonb(t) v FROM public.'+t+' t')).rows.map(r=>r.v)
  await as(owner);await cmd('create_company',{id:company,name:'SYNTHETIC coordination'})
  for(const [i,u,role] of [[1,worker,'worker'],[2,supervisor,'supervisor']]){await as(owner);await cmd('invite',{email:`crew${i}@example.test`,role,token:String(i).repeat(64)});await as(u);await cmd('accept_invitation',{token:String(i).repeat(64)})}
  await as(supervisor);let b=await brief('create'),d={...b.document,site:'SYNTHETIC bay',date:'2026-09-23',task:'SYNTHETIC task',contact:'Synthetic contact',jurisdiction:'CA-ON',workplace:'construction',confirmed:true,crew:[worker],attendance:[worker],briefingNote:'Synthetic discussion',steps:[{id:randomUUID(),task:'Move',hazard:'Trip',control:'Clear route',controlState:'proposed',responsible:worker,unresolved:true}]}
  b=await brief('save',{revision:b.revision,document:d});await brief('record',{revision:b.revision});const old=b.revision,original=(await rows('ts_brief_versions'))[0]
  let summary=(await rows('ts_brief_response_summary'))[0];assert.equal(summary.pending,1);assert.equal(summary.acknowledged,0)
  await assert.rejects(brief('acknowledge',{version:old,userId:worker}),/TS_denied/)
  await as(worker);await brief('acknowledge',{version:old});await brief('acknowledge',{version:old});assert.equal((await rows('ts_brief_acknowledgements')).length,1)
  summary=(await rows('ts_brief_response_summary'))[0];assert.equal(summary.pending,0);assert.equal(summary.acknowledged,1)
  await as(supervisor);b=await brief('revise',{revision:old});assert.equal((await rows('ts_brief_response_summary'))[0].can_acknowledge,false)
  b=await brief('save',{revision:b.revision,document:{...b.document,briefingNote:'Revised discussion',steps:[{...d.steps[0],control:'Revised proposal'}]}});await brief('record',{revision:b.revision})
  summary=(await rows('ts_brief_response_summary'))[0];assert.equal(summary.version,b.revision);assert.equal(summary.pending,1);assert.equal(summary.acknowledged,0)
  await as(worker);await assert.rejects(brief('acknowledge',{version:old}),/TS_conflict/);assert.equal((await rows('ts_brief_acknowledgements')).length,1)
  await brief('acknowledge',{version:b.revision});assert.equal((await rows('ts_brief_acknowledgements')).length,2)
  assert.deepEqual((await rows('ts_brief_versions')).find(v=>v.version===old),original)
  let a=(await rows('ts_actions'))[0],update={id:a.id,revision:a.revision,requestId:randomUUID(),state:'open',responsibleId:supervisor,controls:a.controls,resolution:'',targetDate:''}
  await assert.rejects(cmd('update_action',update),/TS_denied/)
  await as(supervisor);a=await cmd('update_action',update);assert.deepEqual(await cmd('update_action',update),a)
  assert.equal((await rows('ts_events')).filter(e=>e.kind==='action_updated').length,1)
  await assert.rejects(cmd('update_action',{...update,requestId:randomUUID()}),/TS_conflict/)
  await assert.rejects(cmd('update_action',{...update,revision:a.revision,requestId:randomUUID(),responsibleId:outsider}),/TS_invalid/)
  a=await cmd('update_action',{...update,revision:a.revision,requestId:randomUUID(),responsibleId:worker})
  await as(owner);await cmd('member',{userId:worker,role:'remove'})
  assert.equal((await rows('ts_action_ownership'))[0].needs_reassignment,true);assert.equal((await rows('ts_brief_response_summary'))[0].removed_participants,1)
  await as(worker);for(const t of ['ts_brief_participation','ts_brief_response_summary','ts_action_ownership'])assert.deepEqual(await rows(t),[])
  await assert.rejects(brief('acknowledge',{version:b.revision}),/TS_denied/)
  await as(outsider);for(const t of ['ts_brief_participation','ts_brief_response_summary','ts_action_ownership'])assert.deepEqual(await rows(t),[])
  await as(supervisor);await cmd('update_action',{...update,revision:a.revision,requestId:randomUUID(),responsibleId:supervisor});assert.equal((await rows('ts_action_ownership'))[0].needs_reassignment,false)
  const history=(await rows('ts_events')).filter(e=>e.kind==='action_updated');assert.equal(history.length,3);assert.equal(history[0].before_value.responsible_id,worker)
  assert.equal((await db.query("SELECT has_table_privilege('authenticated','public.ts_brief_participation','DELETE') allowed")).rows[0].allowed,false);await assert.rejects(db.exec('DELETE FROM public.ts_brief_participation'),/permission denied|cannot delete from view/)
  await db.exec('RESET ROLE;SET ROLE anon');await assert.rejects(rows('ts_brief_participation'),/permission denied/)
 }finally{await db.close()}
})

test('crew display uses only matching acknowledgements and validated company return links',()=>{
 const company=randomUUID(),worker=randomUUID(),v={version:4,snapshot:{document:{crew:[worker]},people:[{id:worker,name:'Recorded name'}]}}
 const result=participation(v,[{user_id:worker,active:false,display_name:'Later name'}],[{user_id:worker,version:3,acknowledged_at:'old'}]);assert.equal(result[0].name,'Recorded name');assert.equal(result[0].acknowledgedAt,null);assert.equal(result[0].active,false)
 const from='/my-work?company='+company+'&view=crew&page=2';assert.equal(safeRedirect(from),from)
 const u=actionListUrl(company,actionFilters({from}));assert.equal(new URL(u,'https://example.test').searchParams.get('from'),from)
 assert.equal(new URL(actionListUrl(randomUUID(),actionFilters({from})),'https://example.test').searchParams.has('from'),false)
 assert.equal(safeRedirect('https://evil.example/my-work'),'/dashboard')
})
