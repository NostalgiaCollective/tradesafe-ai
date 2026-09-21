import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {randomUUID} from 'node:crypto'
import {PGlite} from '@electric-sql/pglite'
import {applicablePrompts,contentStateLabel,safeSourceUrl} from '../lib/domain/brief-content.mjs'
import {contentExport} from '../lib/domain/content-export.mjs'
import {safeRedirect} from '../lib/domain/validation.ts'
const pilot=JSON.parse(await readFile(new URL('../lib/domain/content-pilot.json',import.meta.url),'utf8'))
test('pilot source mappings, applicability, draft labels and unknown provenance are explicit',()=>{
 const c={version:pilot.version,payload:pilot,state:'draft'},d={jurisdiction:'CA-ON',workplace:'construction',promptTask:pilot.taskId}
 assert.equal(pilot.prompts.length,4);assert.equal(new Set(pilot.prompts.map(p=>p.id)).size,4)
 for(const p of pilot.prompts){assert.equal(p.reviewStatus,'draft');assert.ok(p.applicability&&p.rationale&&p.limits&&p.reviewQuestions);for(const id of p.sourceIds)assert.ok(pilot.sources.some(s=>s.id===id&&safeSourceUrl(s.url)&&s.section&&s.authority&&s.verification))}
 assert.equal(applicablePrompts(c,d).length,4)
 for(const doc of [{...d,jurisdiction:'other'},{...d,workplace:'other'},{...d,promptTask:''},{}])assert.deepEqual(applicablePrompts(c,doc),[])
 assert.match(contentStateLabel(c),/Draft/);assert.match(contentStateLabel(null),/Unknown/)
 assert.match(contentExport({document:d}),/provenance unknown/)
 const html=contentExport({document:d,content:c});assert.ok(html.includes(pilot.version));assert.ok(html.includes('No qualified review decision'));assert.ok(html.includes(pilot.sources[0].url));assert.ok(html.includes('currency through 2026-09-16'))
 assert.equal(safeSourceUrl('javascript:alert(1)'),null);assert.equal(safeSourceUrl('https://evil.example'),null)
 const poisoned=structuredClone(c);poisoned.payload.prompts[0].wording='<script>alert(1)</script>';assert.ok(!contentExport({document:d,content:poisoned}).includes('<script>'))
 assert.equal(safeRedirect('/brief-content?version='+pilot.version),'/brief-content?version='+pilot.version)
})
test('content SQL denies app-role publication/review; explicit scoped appointments, immutable history and brief provenance',async()=>{
 const db=new PGlite(),owner=randomUUID(),worker=randomUUID(),outsider=randomUUID(),companyId=randomUUID(),id=randomUUID()
 try{
  await db.exec(`CREATE ROLE authenticated; CREATE ROLE anon; CREATE SCHEMA auth;CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,email_confirmed_at timestamptz);CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;GRANT USAGE ON SCHEMA public,auth TO authenticated,anon;`)
  for(const [i,u] of [owner,worker,outsider].entries())await db.query('INSERT INTO auth.users VALUES($1,$2,now())',[u,`content${i}@example.test`])
  for(const f of ['20260911000100_staging_baseline','20260911000200_company_workflow','20260911000300_template_v1','20260921000100_daily_briefs','20260921000200_brief_action_assignment'])await db.exec(await readFile(new URL('../supabase/migrations/'+f+'.sql',import.meta.url),'utf8'))
  const as=async u=>{await db.exec('RESET ROLE;SET ROLE authenticated');await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[u])}
  const rpc=async(fn,command,p)=>(await db.query(`SELECT public.${fn}($1,$2::jsonb) v`,[command,JSON.stringify({id,companyId,requestId:randomUUID(),...p})])).rows[0].v
  const cmd=(n,p={})=>rpc('ts_command',n,p),brief=(n,p={})=>rpc('ts_brief_command',n,p)
  await as(owner);await cmd('create_company',{id:companyId,name:'SYNTHETIC content review'});await cmd('invite',{email:'content1@example.test',role:'worker',token:'a'.repeat(64)});await as(worker);await cmd('accept_invitation',{token:'a'.repeat(64)})
  let b=await brief('create');const oldDraft=structuredClone(b);assert.equal(b.document.contentVersion,undefined)
  const doc={...b.document,site:'SYNTHETIC retained',date:'2026-09-21',task:'Move fittings',contact:'Local contact',jurisdiction:'CA-ON',workplace:'construction',confirmed:true,crew:[worker],briefingNote:'Discussed task',steps:[{id:randomUUID(),task:'Move',hazard:'Trip',control:'Clear path',controlState:'proposed',responsible:worker,unresolved:true}]}
  b=await brief('save',{revision:b.revision,document:doc});await brief('record',{revision:b.revision});await brief('acknowledge',{version:b.revision})
  const before=(await db.query('SELECT * FROM ts_brief_versions')).rows,acks=(await db.query('SELECT * FROM ts_brief_acknowledgements')).rows
  const unknownId=randomUUID();await brief('create',{id:unknownId});await db.exec('RESET ROLE');await db.exec(await readFile(new URL('../supabase/migrations/20260921000300_brief_content.sql',import.meta.url),'utf8'))
  await as(worker);assert.deepEqual((await db.query('SELECT * FROM ts_brief_versions')).rows,before);assert.deepEqual((await db.query('SELECT * FROM ts_brief_acknowledgements')).rows,acks)
  assert.equal((await db.query('SELECT document FROM ts_briefs WHERE id=$1',[unknownId])).rows[0].document.contentVersion,oldDraft.document.contentVersion)
  const catalog=async()=>(await db.query('SELECT * FROM ts_brief_content_catalog WHERE version=$1',[pilot.version])).rows[0]
  assert.deepEqual((await catalog()).payload,pilot);assert.equal((await catalog()).state,'draft')
  const review=async p=>(await db.query('SELECT ts_review_brief_content($1::jsonb) v',[JSON.stringify({version:pilot.version,state:'reviewed',expectedState:'draft',requestId:randomUUID(),decisionRef:'SYNTHETIC decision; not real approval',notes:'SYNTHETIC fixture only',...p})])).rows[0].v
  await assert.rejects(review({}),/TS_denied/);await as(owner);await assert.rejects(review({}),/TS_denied/)
  await assert.rejects(db.query('INSERT INTO ts_brief_content SELECT * FROM ts_brief_content'),/permission denied/)
  await assert.rejects(db.query("UPDATE ts_brief_content SET payload='{}'"),/permission denied/)
  await assert.rejects(db.query('INSERT INTO ts_brief_content_reviewers(user_id,version) VALUES($1,$2)',[owner,pilot.version]),/permission denied/)
  await as(worker);const legacyClient=await brief('create',{id:randomUUID()});assert.equal(legacyClient.document.contentVersion,undefined)
  await assert.rejects(brief('create',{id:randomUUID(),contentVersion:'invented'}),/TS_invalid/)
  const freshId=randomUUID();b=await brief('create',{id:freshId,contentVersion:pilot.version});assert.equal(b.document.contentVersion,pilot.version)
  const freshDoc={...doc,contentVersion:pilot.version,promptTask:pilot.taskId};b=await brief('save',{id:freshId,revision:b.revision,document:freshDoc});await brief('record',{id:freshId,revision:b.revision});await brief('acknowledge',{id:freshId,version:b.revision})
  const first=(await db.query('SELECT * FROM ts_brief_versions WHERE brief_id=$1',[freshId])).rows[0];assert.equal(first.snapshot.content.state,'draft');assert.deepEqual(first.snapshot.content.payload,pilot)
  const originalHtml=contentExport(first.snapshot)
  await assert.rejects(brief('save',{id:unknownId,revision:1,document:{...freshDoc,jurisdiction:'other'}}),/TS_invalid/)
  await db.exec('RESET ROLE');await assert.rejects(db.query("UPDATE ts_brief_content SET created_by='rewrite'"),/TS_immutable/)
  await db.query("INSERT INTO ts_brief_content_reviewers(user_id,version,reviewer_name,qualification_scope,authorization_ref,expires_at) VALUES($1,$2,'SYNTHETIC reviewer','SYNTHETIC scope only','SYNTHETIC appointment',now()+interval '1 hour')",[worker,pilot.version])
  await as(worker);assert.equal((await db.query('SELECT ts_brief_content_review_permission($1) v',[pilot.version])).rows[0].v,true)
  const req=randomUUID(),decision=await review({requestId:req});assert.ok(decision.recorded_at);assert.equal(decision.actor_id,worker);assert.deepEqual(await review({requestId:req}),decision);await assert.rejects(review({requestId:req,notes:'changed'}),/TS_conflict/)
  assert.equal((await catalog()).state,'reviewed');assert.deepEqual((await db.query('SELECT * FROM ts_brief_versions WHERE brief_id=$1',[freshId])).rows[0],first);assert.equal(contentExport(first.snapshot),originalHtml)
  b=await brief('revise',{id:freshId,revision:b.revision});b=await brief('save',{id:freshId,revision:b.revision,document:{...freshDoc,briefingNote:'New briefing'}});await brief('record',{id:freshId,revision:b.revision})
  const revised=(await db.query('SELECT * FROM ts_brief_versions WHERE brief_id=$1 ORDER BY version DESC',[freshId])).rows[0];assert.equal(revised.snapshot.content.state,'reviewed');assert.equal(revised.snapshot.content.decision.actor_id,worker)
  assert.equal((await db.query('SELECT * FROM ts_brief_acknowledgements WHERE brief_id=$1',[freshId])).rows.length,1)
  await review({expectedState:'reviewed',state:'superseded'});assert.equal((await catalog()).state,'superseded');await assert.rejects(review({expectedState:'superseded'}),/TS_conflict/)
  await db.exec('RESET ROLE');await db.query('UPDATE ts_brief_content_reviewers SET revoked_at=now() WHERE user_id=$1',[worker]);await as(worker);await assert.rejects(review({}),/TS_denied/)
  await db.exec('RESET ROLE');await db.query("UPDATE ts_brief_content_reviewers SET revoked_at=NULL,expires_at=now()-interval '1 second' WHERE user_id=$1",[worker]);await as(worker);await assert.rejects(review({}),/TS_denied/)
  await as(owner);await cmd('member',{userId:worker,role:'remove'});await as(worker);assert.deepEqual((await db.query('SELECT * FROM ts_brief_content_catalog')).rows,[]);await assert.rejects(review({}),/TS_denied/)
  await as(outsider);assert.deepEqual((await db.query('SELECT * FROM ts_brief_content_catalog')).rows,[]);await db.exec('RESET ROLE;SET ROLE anon');await assert.rejects(review({}),/permission denied/)
 }finally{await db.close()}
})
