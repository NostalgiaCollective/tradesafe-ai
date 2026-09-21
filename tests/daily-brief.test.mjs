import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {randomUUID} from 'node:crypto'
import {PGlite} from '@electric-sql/pglite'
import {briefExport} from '../lib/domain/brief-export.mjs'
import {safeRedirect} from '../lib/domain/validation.ts'

test('daily brief SQL: scoped durable drafts, immutable versions, authenticated acknowledgements and deduplicated Actions',async()=>{
 const db=new PGlite(),[owner,worker,supervisor,outsider]=Array.from({length:4},()=>randomUUID()),companyId=randomUUID(),id=randomUUID()
 try{
  await db.exec(`CREATE ROLE authenticated; CREATE ROLE anon; CREATE SCHEMA auth;
   CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,email_confirmed_at timestamptz);
   CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
   GRANT USAGE ON SCHEMA public,auth TO authenticated,anon;`)
  for(const [i,u] of [owner,worker,supervisor,outsider].entries())await db.query('INSERT INTO auth.users VALUES($1,$2,now())',[u,`brief${i}@example.test`])
  for(const file of ['20260911000100_staging_baseline.sql','20260911000200_company_workflow.sql','20260911000300_template_v1.sql','20260921000100_daily_briefs.sql','20260921000200_brief_action_assignment.sql','20260921000300_brief_content.sql'])await db.exec(await readFile(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'))
  const as=async u=>{await db.exec('RESET ROLE; SET ROLE authenticated');await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[u])}
  const call=async(fn,command,p)=>(await db.query(`SELECT public.${fn}($1,$2::jsonb) AS value`,[command,JSON.stringify({companyId,id,requestId:randomUUID(),...p})])).rows[0].value
  const cmd=(command,p={})=>call('ts_command',command,p),brief=(command,p={})=>call('ts_brief_command',command,p)
  const rows=async table=>(await db.query('SELECT * FROM public.'+table)).rows
  await as(owner);await cmd('create_company',{id:companyId,name:'SYNTHETIC brief crew'})
  for(const [i,u,role] of [[1,worker,'worker'],[2,supervisor,'supervisor']]){await as(owner);const token=String(i).repeat(64);await cmd('invite',{email:`brief${i}@example.test`,role,token});await as(u);await cmd('accept_invitation',{token})}
  await as(worker);let b=await brief('create');assert.equal((await brief('create')).id,id)
  const doc={...b.document,site:'SYNTHETIC <site>',date:'2026-09-21',task:'Synthetic task',contact:'Site contact via local radio',jurisdiction:'CA-ON',workplace:'construction',confirmed:true,crew:[worker,supervisor],attendance:[worker],briefingNote:'Discussed access',steps:[{id:randomUUID(),task:'Move test material',hazard:'SYNTHETIC trip concern',control:'Clear the route',controlState:'proposed',responsible:supervisor,unresolved:true}]}
  await assert.rejects(brief('record',{revision:1}),/TS_incomplete/)
  const save={revision:1,document:doc,requestId:randomUUID()};b=await brief('save',save);assert.equal((await brief('save',save)).revision,2)
  assert.deepEqual((await rows('ts_briefs'))[0].document,doc)
  await assert.rejects(brief('save',{revision:1,document:{...doc,task:'stale'}}),/TS_conflict/)
  const record={revision:2,requestId:randomUUID()};b=await brief('record',record);await brief('record',record)
  const original=(await rows('ts_brief_versions'))[0];assert.equal(original.version,2)
  assert.equal((await rows('ts_actions')).length,1);assert.equal((await rows('ts_actions'))[0].responsible_id,worker);assert.equal((await rows('ts_events')).filter(e=>e.kind==='action_opened').length,1)
  await assert.rejects(brief('save',{revision:2,document:doc}),/TS_immutable/)
  await brief('acknowledge',{version:2});await brief('acknowledge',{version:2})
  assert.equal((await rows('ts_brief_acknowledgements')).length,1)
  assert.equal((await rows('ts_brief_acknowledgements'))[0].user_id,worker)
  assert.ok((await rows('ts_brief_acknowledgements'))[0].acknowledged_at)
  await assert.rejects(brief('review_control',{version:2,itemId:doc.steps[0].id}),/TS_denied/)
  await as(supervisor);await assert.rejects(brief('review_control',{version:2,itemId:doc.steps[0].id}),/TS_incomplete/)
  await as(owner);await assert.rejects(brief('acknowledge',{version:2}),/TS_denied/)
  await as(worker);b=await brief('revise',{revision:2});assert.deepEqual(b.document.attendance,[]);assert.equal(b.document.briefingNote,'')
  await assert.rejects(brief('acknowledge',{version:2}),/TS_conflict/)
  b=await brief('save',{revision:b.revision,document:{...doc,briefingNote:'Revised briefing',steps:[{...doc.steps[0],control:'Route reported clear',controlState:'reported_implemented'}]}})
  const nextVersion=b.revision;b=await brief('record',{revision:nextVersion})
  assert.equal((await rows('ts_brief_acknowledgements')).filter(a=>a.version===nextVersion).length,0)
  assert.equal((await rows('ts_actions')).length,1);assert.equal((await rows('ts_actions'))[0].controls,'Clear the route')
  await as(supervisor);await brief('review_control',{version:nextVersion,itemId:doc.steps[0].id});await brief('review_control',{version:nextVersion,itemId:doc.steps[0].id})
  assert.equal((await rows('ts_brief_reviews')).length,1)
  await as(worker);let action=(await rows('ts_actions'))[0]
  const update={id:action.id,revision:action.revision,state:'closed',responsibleId:worker,controls:action.controls,resolution:'Synthetic resolved',targetDate:''}
  await assert.rejects(cmd('update_action',{...update,state:'in_progress',responsibleId:supervisor}),/TS_denied/)
  await assert.rejects(cmd('update_action',update),/TS_denied/)
  action=await cmd('update_action',{...update,state:'awaiting_verification'})
  await as(supervisor);await cmd('update_action',{...update,revision:action.revision})
  assert.deepEqual((await rows('ts_brief_versions')).find(v=>v.version===2),original)
  await assert.rejects(db.exec("UPDATE public.ts_brief_versions SET briefing_note='changed'"),/permission denied/)
  await db.exec('RESET ROLE');await assert.rejects(db.exec("UPDATE public.ts_brief_versions SET briefing_note='changed'"),/TS_immutable/)
  await as(worker);const reused=await brief('create',{id:randomUUID(),reuseId:id})
  assert.equal(reused.document.site,doc.site);assert.equal(reused.document.contact,doc.contact)
  for(const key of ['crew','steps','attendance'])assert.deepEqual(reused.document[key],[])
  assert.equal(reused.document.date,'');assert.equal(reused.document.confirmed,false)
  await as(outsider);assert.deepEqual(await rows('ts_briefs'),[]);assert.deepEqual(await rows('ts_brief_versions'),[])
  await assert.rejects(brief('save',{revision:nextVersion,document:doc}),/TS_denied/)
  await as(owner);await cmd('member',{userId:worker,role:'remove'});await as(worker)
  for(const table of ['ts_briefs','ts_brief_versions','ts_brief_acknowledgements','ts_brief_reviews','ts_actions'])assert.deepEqual(await rows(table),[])
  await assert.rejects(brief('acknowledge',{version:nextVersion}),/TS_denied/)
  await db.exec('RESET ROLE; SET ROLE anon');await assert.rejects(brief('create'),/permission denied/)
 }finally{await db.close()}
})

test('brief redirects remain internal and exports escape every user field',()=>{
 const id=randomUUID();assert.equal(safeRedirect('/briefs/'+id+'?version=12'),'/briefs/'+id+'?version=12')
 assert.equal(safeRedirect('/briefs?company='+id),'/briefs?company='+id)
 assert.equal(safeRedirect('/briefs/../../api/private'),'/dashboard')
 assert.equal(safeRedirect('/briefs/'+id+'?version=evil&step=3'),'/briefs/'+id+'?step=3')
 const doc={site:'<script>evil()</script>',steps:[],crew:[],date:'2026-09-21',communication:'',task:'Task',contact:'Contact',jurisdiction:'CA-ON',workplace:'construction'}
 const html=briefExport({version:{version:1,snapshot:{document:doc,people:[],sourceVersion:'draft'},attendance:[]},members:[],actions:[],reviews:[],acknowledgements:[]},'2026-09-21')
 assert.ok(!html.includes('<script>'));assert.ok(html.includes('&lt;script&gt;'))
 assert.ok(html.includes('None recorded; saving did not notify anyone'));assert.ok(html.includes('DRAFT SAFETY CONTENT'))
})
