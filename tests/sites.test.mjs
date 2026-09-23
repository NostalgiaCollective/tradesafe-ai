import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {randomUUID} from 'node:crypto'
import {PGlite} from '@electric-sql/pglite'
import {briefExport} from '../lib/domain/brief-export.mjs'
import {safeRedirect} from '../lib/domain/validation.ts'
import {reportFilters,reportListUrl,listReturn} from '../lib/domain/report-list.ts'
import {actionFilters,actionListUrl} from '../lib/domain/action-list.ts'

test('site SQL: company isolation, explicit links, revisions, retries, fresh days, snapshots and archive boundaries',async()=>{
 const db=new PGlite(),[owner,worker,supervisor,outsider]=Array.from({length:4},randomUUID),company=randomUUID(),other=randomUUID(),site=randomUUID(),otherSite=randomUUID()
 try{
  await db.exec(`CREATE ROLE authenticated;CREATE ROLE anon;CREATE SCHEMA auth;CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,email_confirmed_at timestamptz);CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;GRANT USAGE ON SCHEMA public,auth TO authenticated,anon;`)
  for(const [i,u] of [owner,worker,supervisor,outsider].entries())await db.query('INSERT INTO auth.users VALUES($1,$2,now())',[u,`site${i}@example.test`])
  for(const f of ['20260911000100_staging_baseline','20260911000200_company_workflow','20260911000300_template_v1','20260921000100_daily_briefs','20260921000200_brief_action_assignment','20260921000300_brief_content','20260922000100_sites'])await db.exec(await readFile(new URL('../supabase/migrations/'+f+'.sql',import.meta.url),'utf8'))
  const as=async u=>{await db.exec('RESET ROLE;SET ROLE authenticated');await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[u])}
  const rpc=async(fn,command,p)=>(await db.query(`SELECT public.${fn}($1,$2::jsonb) v`,[command,JSON.stringify({companyId:company,requestId:randomUUID(),...p})])).rows[0].v
  const cmd=(n,p={})=>rpc('ts_command',n,p),brief=(n,p={})=>rpc('ts_brief_command',n,p),sites=(n,p={})=>rpc('ts_site_command',n,{id:site,...p})
  const rows=async table=>(await db.query('SELECT to_jsonb(t) v FROM public.'+table+' t')).rows.map(r=>r.v)
  await as(owner);await cmd('create_company',{id:company,name:'SYNTHETIC site crew'})
  for(const [i,u,role] of [[1,worker,'worker'],[2,supervisor,'supervisor']]){await as(owner);await cmd('invite',{email:`site${i}@example.test`,role,token:String(i).repeat(64)});await as(u);await cmd('accept_invitation',{token:String(i).repeat(64)})}
  await as(outsider);await cmd('create_company',{id:other,name:'SYNTHETIC other site crew'})
  const doc={name:'SYNTHETIC same name',address:'SYNTHETIC loading bay',instructions:'SYNTHETIC call contact at gate'}
  await sites('create',{companyId:other,id:otherSite,document:doc})
  await as(worker);const create={document:doc,requestId:randomUUID()};let s=await sites('create',create);assert.deepEqual(await sites('create',create),s)
  assert.equal((await rows('ts_sites')).length,1);assert.equal((await rows('ts_events')).filter(e=>e.kind==='site_create').length,1)
  await assert.rejects(sites('create',{...create,document:{...doc,name:'changed retry'}}),/TS_conflict/)
  await assert.rejects(sites('create_report',{id:randomUUID(),siteId:otherSite,templateId:'electrical:1.0.0'}),/TS_not_found/)
  const save={document:{...doc,name:'SYNTHETIC revised'},revision:1,requestId:randomUUID()};s=await sites('save',save);assert.equal(s.revision,2);assert.deepEqual(await sites('save',save),s)
  await assert.rejects(sites('save',{document:doc,revision:1}),/TS_conflict/)
  await as(owner);const owned=await sites('create',{id:randomUUID(),document:doc});await as(worker);await assert.rejects(sites('save',{id:owned.id,document:doc,revision:1}),/TS_denied/)
  let b=await sites('create_brief',{id:randomUUID(),siteId:site});assert.ok(b.document.site.includes(s.document.name));assert.deepEqual(b.document.steps,[])
  const d={...b.document,date:'2026-09-22',task:'SYNTHETIC move fittings',contact:'Test contact',jurisdiction:'CA-ON',workplace:'construction',confirmed:true,crew:[worker],attendance:[worker],briefingNote:'SYNTHETIC discussion',steps:[{id:randomUUID(),task:'Move',hazard:'Trip',control:'Clear route',controlState:'reported_implemented',responsible:worker,unresolved:true}]}
  b=await brief('save',{id:b.id,revision:b.revision,document:d});await brief('record',{id:b.id,revision:b.revision});await brief('acknowledge',{id:b.id,version:b.revision})
  await as(supervisor);await brief('review_control',{id:b.id,version:b.revision,itemId:d.steps[0].id});await as(worker)
  const original=(await rows('ts_brief_versions'))[0],acks=await rows('ts_brief_acknowledgements'),reviews=await rows('ts_brief_reviews')
  assert.equal(original.snapshot.site.name,s.document.name)
  const exportArgs={version:original,members:[],acknowledgements:acks,reviews,actions:await rows('ts_actions')},html=briefExport(exportArgs,'fixed cutoff')
  assert.ok(html.includes(doc.instructions));assert.equal((await rows('ts_site_actions')).length,1)
  const next=await sites('create_brief',{id:randomUUID(),siteId:site,reuseId:b.id});assert.equal(next.document.task,d.task)
  for(const key of ['crew','steps','attendance'])assert.deepEqual(next.document[key],[])
  for(const key of ['date','contact','briefingNote','communication','jurisdiction','workplace'])assert.equal(next.document[key],'')
  assert.equal(next.document.confirmed,false);assert.equal(next.document.paused,false)
  assert.deepEqual(await rows('ts_brief_acknowledgements'),acks);assert.deepEqual(await rows('ts_brief_reviews'),reviews)
  const template=(await rows('ts_templates'))[0]
  let r=await sites('create_report',{id:randomUUID(),siteId:site,templateId:template.id});assert.equal(r.document.job.address,doc.address);assert.equal(r.site_snapshot.instructions,doc.instructions)
  const answers=Object.fromEntries(r.template_snapshot.items.map(i=>[i.id,{state:'meets',note:'',controls:''}]))
  r=await cmd('save_report',{id:r.id,revision:r.revision,document:{job:{...r.document.job,date:'2026-09-22'},answers}})
  r=await cmd('finalize',{id:r.id,revision:r.revision,acknowledged:true});const originalReport=structuredClone(r)
  const amendment=await cmd('amend',{id:randomUUID(),amendmentOf:r.id,reason:'SYNTHETIC correction'})
  assert.deepEqual(amendment.site_snapshot,r.site_snapshot);assert.ok((await rows('ts_site_links')).some(l=>l.report_id===amendment.id&&l.site_id===site))
  const legacy=await cmd('create_report',{id:randomUUID(),templateId:template.id});assert.equal((await rows('ts_site_links')).some(l=>l.report_id===legacy.id),false)
  await sites('link_report',{id:legacy.id,siteId:site});assert.deepEqual((await rows('ts_reports')).find(x=>x.id===legacy.id),legacy)
  await assert.rejects(sites('link_report',{id:legacy.id,siteId:owned.id}),/TS_conflict/)
  await as(outsider);const foreign=await cmd('create_report',{companyId:other,id:randomUUID(),templateId:template.id});await as(worker)
  await assert.rejects(sites('link_report',{id:foreign.id,siteId:site}),/TS_not_found/)
  await assert.rejects(sites('create_brief',{id:randomUUID(),siteId:owned.id,reuseId:b.id}),/TS_denied/)
  s=await sites('save',{revision:s.revision,document:{...doc,name:'SYNTHETIC today rename',address:'New location',instructions:'New instructions'}})
  assert.deepEqual((await rows('ts_brief_versions'))[0],original);assert.equal(briefExport(exportArgs,'fixed cutoff'),html)
  assert.deepEqual((await rows('ts_reports')).find(x=>x.id===r.id),originalReport)
  await assert.rejects(sites('archive',{revision:s.revision}),/TS_denied/)
  await as(supervisor);const archive={revision:s.revision,requestId:randomUUID()};s=await sites('archive',archive);assert.equal(s.archived,true);assert.deepEqual(await sites('archive',archive),s)
  await assert.rejects(sites('create_brief',{id:randomUUID(),siteId:site}),/TS_site_archived/)
  await assert.rejects(sites('create_report',{id:randomUUID(),siteId:site,templateId:template.id}),/TS_site_archived/)
  await assert.rejects(sites('link_brief',{id:randomUUID(),siteId:site}),/TS_site_archived/)
  await as(worker);await brief('save',{id:next.id,revision:next.revision,document:{...next.document,task:'Existing draft still editable'}})
  await assert.rejects(db.exec("UPDATE public.ts_sites SET archived=false"),/permission denied/)
  await assert.rejects(db.exec("SELECT * FROM public.ts_site_requests"),/permission denied/)
  await as(owner);await cmd('member',{userId:worker,role:'remove'});await as(worker)
  for(const table of ['ts_sites','ts_site_links','ts_site_actions'])assert.deepEqual(await rows(table),[])
  await assert.rejects(sites('save',{revision:s.revision,document:doc}),/TS_denied/)
  await as(outsider);assert.equal((await rows('ts_sites')).length,1);assert.deepEqual(await rows('ts_site_actions'),[])
  await db.exec('RESET ROLE;SET ROLE anon');await assert.rejects(sites('create',{document:doc}),/permission denied/)
 }finally{await db.close()}
})

test('site navigation preserves only valid identifiers and scoped report/action filters',()=>{
 const company=randomUUID(),site=randomUUID()
 for(const url of ['/sites?company='+company,'/sites/'+site,'/report/new?company='+company+'&site='+site])assert.equal(safeRedirect(url),url)
 const reports=reportListUrl(company,reportFilters({site,q:'North',status:'draft',page:2})),actions=actionListUrl(company,actionFilters({site,mine:'0',status:'awaiting_verification'}))
 assert.equal(safeRedirect(reports),reports);assert.equal(listReturn(reports,company),reports);assert.equal(safeRedirect(actions),actions);assert.equal(listReturn(actions,company),actions)
 assert.equal(listReturn('/sites/'+site,company),'/sites/'+site);assert.equal(reportFilters({site:'invalid'}).site,undefined)
 assert.equal(safeRedirect('/sites/../../api/sites'),'/dashboard')
})
