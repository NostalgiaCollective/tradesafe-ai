import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { PGlite } from '@electric-sql/pglite'
import { getTemplate } from '../lib/domain/templates.ts'
import { getCandidateTemplate } from '../lib/domain/content-review.ts'

const ids = Array.from({length:5},()=>randomUUID())
const [owner,worker,supervisor,outsider,unverified] = ids
const company = randomUUID(), otherCompany = randomUUID(), report = randomUUID()
const template = getTemplate('electrical')
async function fixture({legacy=false}={}) {
 const db = new PGlite()
 await db.exec(`CREATE ROLE authenticated; CREATE ROLE anon; CREATE SCHEMA auth;
 CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,email_confirmed_at timestamptz);
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 GRANT USAGE ON SCHEMA public,auth TO authenticated,anon;`)
 for(let i=0;i<ids.length;i++) await db.query('INSERT INTO auth.users VALUES($1,$2,$3)',[ids[i],`user${i}@example.test`,i===4?null:new Date().toISOString()])
 for(const name of ['20260911000100_staging_baseline.sql','20260911000200_company_workflow.sql','20260911000300_template_v1.sql']) {
  await db.exec(await readFile(new URL('../supabase/migrations/'+name,import.meta.url),'utf8'))
  if(legacy&&name==='20260911000100_staging_baseline.sql'){
   await db.query("INSERT INTO public.profiles(id,business_name) VALUES($1,'Same business name'),($2,'Same business name')",[owner,worker])
   await db.query("INSERT INTO public.contractor_profiles(user_id,business_name,contact_phone) VALUES($1,'Conflicting settings name','555-0100')",[owner])
   await db.query("INSERT INTO public.reports(user_id,trade,job_address,homeowner_name,status,stripe_session_id) VALUES($1,'electrical','Legacy fixture','Fixture','completed','historic_fixture')",[owner])
  }
 }
 await db.exec(await readFile(new URL('../supabase/phase-2-preflight.sql',import.meta.url),'utf8'))
 await db.exec(await readFile(new URL('../supabase/staging-verification-preflight.sql',import.meta.url),'utf8'))
 await db.exec(await readFile(new URL('../supabase/migrations/20260919000100_onboarding_context.sql',import.meta.url),'utf8'))
 const as = async user => { await db.exec('RESET ROLE; SET ROLE authenticated;'); await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[user]) }
 const cmd = async(command,p={}) => (await db.query('SELECT public.ts_command($1,$2::jsonb) AS value',[command,JSON.stringify({companyId:company,requestId:randomUUID(),...p})])).rows[0].value
 await as(owner); await cmd('create_company',{id:company,name:'Synthetic company A'})
 const invite=async(user,index,role)=>{await as(owner);const token=String(index).repeat(64);await cmd('invite',{email:`user${index}@example.test`,role,token});await as(user);await cmd('accept_invitation',{token})}
 await invite(worker,1,'worker');await invite(supervisor,2,'supervisor')
 await as(outsider);await cmd('create_company',{id:otherCompany,name:'Synthetic company B'})
 await as(worker)
 return {db,as,cmd}
}
const complete = () => ({job:{address:'Synthetic site',client:'Fixture',date:'2026-09-11'},answers:Object.fromEntries(template.items.map(i=>[i.id,{state:'meets',note:'',controls:''}]))})

test('company ownership is atomic and creation retries cannot duplicate or claim another company',async()=>{
 const {db,as,cmd}=await fixture();try{
  await as(owner);const id=randomUUID();await cmd('create_company',{id,name:'Atomic company'});await cmd('create_company',{id,name:'Atomic company'})
  assert.equal((await db.query('SELECT count(*)::int AS n FROM public.ts_companies WHERE id=$1',[id])).rows[0].n,1)
  assert.equal((await db.query('SELECT role FROM public.ts_members WHERE company_id=$1',[id])).rows[0].role,'owner')
  await db.exec("RESET ROLE; CREATE FUNCTION public.synthetic_fail_membership() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic_membership_failure'; END $$; CREATE TRIGGER synthetic_fail_membership BEFORE INSERT ON public.ts_members FOR EACH ROW EXECUTE FUNCTION public.synthetic_fail_membership();")
  await as(owner);const failed=randomUUID();await assert.rejects(cmd('create_company',{id:failed,name:'Must roll back'}),/synthetic_membership_failure/)
  assert.equal((await db.query('SELECT count(*)::int AS n FROM public.ts_companies WHERE id=$1',[failed])).rows[0].n,0)
  await as(outsider);await assert.rejects(cmd('create_company',{id,name:'Not mine'}),/TS_denied/)
 }finally{await db.close()}
})

test('read-only invitation context explains lifecycle without leaking another recipient or granting access',async()=>{
 const {db,as,cmd}=await fixture();try{
  const context=async token=>(await db.query('SELECT public.ts_invitation_context($1) AS value',[token??null])).rows[0].value
  await as(owner);const token='d'.repeat(64),inv=await cmd('invite',{email:'user3@example.test',role:'worker',token})
  assert.deepEqual(await context(token),{status:'wrong_account'});assert.deepEqual(await context(),[])
  await as(outsider);assert.equal((await context()).length,1);assert.equal((await context(token)).status,'pending')
  assert.equal((await db.query('SELECT id FROM public.ts_companies WHERE id=$1',[company])).rows.length,0)
  const serialized=JSON.stringify(await context());assert.ok(!serialized.includes('token'));assert.ok(!serialized.includes('email'))
  await cmd('accept_invitation',{token});assert.deepEqual(await context(token),{status:'accepted',company_id:company});assert.deepEqual(await context(),[])
  await cmd('accept_invitation',{token});assert.equal((await db.query("SELECT count(*)::int AS n FROM public.ts_events WHERE kind='invitation_accepted' AND actor_id=$1",[outsider])).rows[0].n,1)
  await as(owner);await cmd('member',{userId:outsider,role:'remove'});await as(outsider);assert.deepEqual(await context(token),{status:'access_removed'});await assert.rejects(cmd('accept_invitation',{token}),/TS_invitation/)
  await as(owner);const rev=await cmd('invite',{email:'user3@example.test',role:'worker',token:'e'.repeat(64)});await cmd('revoke_invitation',{id:rev.id})
  await as(outsider);assert.deepEqual(await context('e'.repeat(64)),{status:'revoked'})
  await db.exec('RESET ROLE');await db.query('UPDATE public.ts_invitations SET accepted_by=NULL,expires_at=now()-interval \'1 day\' WHERE id=$1',[inv.id]);await as(outsider)
  assert.deepEqual(await context(token),{status:'expired'});await assert.rejects(cmd('accept_invitation',{token}),/TS_invitation/)
  await as(unverified);assert.deepEqual(await context(),[]);assert.deepEqual(await context(token),{status:'wrong_account'})
  await db.exec('RESET ROLE; SET ROLE anon');await assert.rejects(context(token),/permission denied/)
 }finally{await db.close()}
})

test('SQL templates match the published module; creation retries and optimistic saves preserve drafts',async()=>{
 const {db,cmd}=await fixture();try{
 for(const trade of ['electrical','plumbing','roofing']) {
  const candidate=getCandidateTemplate(trade)
  assert.equal((await db.query('SELECT id FROM public.ts_templates WHERE id=$1',[candidate.id])).rows.length,0)
  await assert.rejects(cmd('create_report',{id:randomUUID(),templateId:candidate.id}),/TS_invalid/)
 }
 assert.deepEqual((await db.query('SELECT snapshot FROM public.ts_templates WHERE id=$1',[template.id])).rows[0].snapshot,template)
 const first=await cmd('create_report',{id:report,templateId:template.id})
 assert.ok(Object.values(first.document.answers).every(a=>a.state==='unanswered'))
 assert.equal((await cmd('create_report',{id:report,templateId:template.id})).id,first.id)
 const requestId=randomUUID(); const saved=await cmd('save_report',{id:report,revision:1,requestId,document:complete()})
 assert.equal(saved.revision,2)
 assert.equal((await cmd('save_report',{id:report,revision:1,requestId,document:complete()})).revision,2)
 const reopened=(await db.query('SELECT * FROM public.ts_reports WHERE id=$1',[report])).rows[0]
 assert.deepEqual(reopened.document,complete())
 await assert.rejects(cmd('save_report',{id:report,revision:1,document:complete()}),/TS_conflict/)
 }finally{await db.close()}
})

test('finalization rejects missing/invalid answers, preserves unresolved concerns and creates immutable amendments',async()=>{
 const {db,cmd}=await fixture();try{
 await cmd('create_report',{id:report,templateId:template.id})
 await assert.rejects(cmd('finalize',{id:report,revision:1,acknowledged:true}),/TS_incomplete/)
 const invalid=complete();invalid.answers[template.items[0].id].state='pass'
 await assert.rejects(cmd('save_report',{id:report,revision:1,document:invalid}),/TS_invalid/)
 const relativeDate=complete();relativeDate.job.date='today'
 await assert.rejects(cmd('save_report',{id:report,revision:1,document:relativeDate}),/TS_invalid/)
 const d=complete();delete d.answers[template.items[0].id]
 let r=await cmd('save_report',{id:report,revision:1,document:d})
 await assert.rejects(cmd('finalize',{id:report,revision:r.revision,acknowledged:true}),/TS_incomplete/)
 d.answers[template.items[0].id]={state:'attention',note:'Observed concern',controls:'Area isolated'}
 r=await cmd('save_report',{id:report,revision:r.revision,document:d})
 await assert.rejects(cmd('finalize',{id:report,revision:r.revision,acknowledged:false}),/TS_incomplete/)
 r=await cmd('finalize',{id:report,revision:r.revision,acknowledged:true})
 assert.equal(r.lifecycle,'finalized');assert.equal(r.finalized_by,worker);assert.equal(r.snapshot_version,1)
 assert.equal((await db.query('SELECT * FROM public.ts_actions')).rows[0].state,'open')
 await assert.rejects(cmd('save_report',{id:report,revision:r.revision,document:complete()}),/TS_immutable/)
 await assert.rejects(db.exec("UPDATE public.ts_reports SET lifecycle='draft'"),/permission denied/)
 await assert.rejects(db.exec("UPDATE public.reports SET status='completed'"),/permission denied/)
 await assert.rejects(cmd('grant_payment',{id:report}),/TS_invalid/)
 const amendment=await cmd('amend',{id:randomUUID(),amendmentOf:report,reason:'Correct an observation'})
 assert.equal(amendment.amendment_of,report);assert.equal(amendment.lifecycle,'draft');assert.deepEqual(amendment.template_snapshot,r.template_snapshot)
 assert.equal((await db.query('SELECT lifecycle FROM public.ts_reports WHERE id=$1',[report])).rows[0].lifecycle,'finalized')
 }finally{await db.close()}
})

test('company boundaries, direct writes, invitation identity and removed membership fail closed',async()=>{
 const {db,as,cmd}=await fixture();try{
 await cmd('create_report',{id:report,templateId:template.id})
 await as(outsider)
 assert.equal((await db.query('SELECT * FROM public.ts_reports')).rows.length,0)
 await assert.rejects(cmd('save_report',{id:report,revision:1,document:complete()}),/TS_denied/)
 await assert.rejects(db.exec("UPDATE public.ts_members SET role='owner'"),/permission denied/)
 await assert.rejects(db.query('INSERT INTO public.ts_reports(id,company_id) VALUES($1,$2)',[randomUUID(),company]),/permission denied/)
 await as(owner)
 await assert.rejects(cmd('member',{userId:owner,role:'remove'}),/TS_last_owner/)
 const token='a'.repeat(64);await cmd('invite',{email:'user4@example.test',role:'worker',token})
 await as(unverified);await assert.rejects(cmd('accept_invitation',{token}),/TS_invitation/)
 await as(outsider);await assert.rejects(cmd('accept_invitation',{token}),/TS_invitation/)
 await as(owner);const inv=await cmd('invite',{email:'user3@example.test',role:'worker',token:'b'.repeat(64)})
 await cmd('revoke_invitation',{id:inv.id});await as(outsider);await assert.rejects(cmd('accept_invitation',{token:'b'.repeat(64)}),/TS_invitation/)
 await as(owner);const expired=await cmd('invite',{email:'user3@example.test',role:'worker',token:'c'.repeat(64)})
 await db.exec('RESET ROLE');await db.query("UPDATE public.ts_invitations SET expires_at=now()-interval '1 day' WHERE id=$1",[expired.id])
 await as(outsider);await assert.rejects(cmd('accept_invitation',{token:'c'.repeat(64)}),/TS_invitation/)
 await as(owner);await cmd('member',{userId:worker,role:'remove'})
 await as(worker);assert.equal((await db.query('SELECT * FROM public.ts_reports')).rows.length,0)
 await assert.rejects(cmd('create_report',{id:randomUUID(),templateId:template.id}),/TS_denied/)
 await assert.rejects(cmd('accept_invitation',{token:'1'.repeat(64)}),/TS_invitation/)
 await db.exec('RESET ROLE; SET ROLE anon;');await assert.rejects(db.query('SELECT * FROM public.ts_reports'),/permission denied/)
 }finally{await db.close()}
})

test('corrective actions require verification authority and preserve resolution history on reopening',async()=>{
 const {db,as,cmd}=await fixture();try{
 let r=await cmd('create_report',{id:report,templateId:template.id});const d=complete()
 d.answers[template.items[0].id]={state:'attention',note:'Concern observed',controls:'Kept clear'}
 r=await cmd('save_report',{id:report,revision:r.revision,document:d})
 await cmd('finalize',{id:report,revision:r.revision,acknowledged:true})
 let a=(await db.query('SELECT * FROM public.ts_actions')).rows[0]
 const update=(state)=>({id:a.id,revision:a.revision,responsibleId:worker,state,controls:'Area protected',resolution:'Repair checked',targetDate:'2026-09-12'})
 await assert.rejects(cmd('update_action',update('closed')),/TS_denied/)
 a=await cmd('update_action',update('awaiting_verification'))
 await as(supervisor);a=await cmd('update_action',update('closed'));assert.equal(a.verified_by,supervisor)
 a=await cmd('update_action',update('open'));assert.equal(a.verified_by,null)
 const history=(await db.query('SELECT * FROM public.ts_events WHERE entity_id=$1 ORDER BY id',[a.id])).rows
 assert.ok(history.some(e=>e.after_value?.verified_by===supervisor))
 assert.ok(history.some(e=>e.before_value?.verified_by===supervisor && e.after_value.state==='open'))
 assert.deepEqual((await db.query('SELECT document FROM public.ts_reports WHERE id=$1',[report])).rows[0].document,d)
 }finally{await db.close()}
})

test('legacy backfill keeps users separate, retains conflicting values and preserves payment information',async()=>{
 const {db,as,cmd}=await fixture({legacy:true});try{
 await as(owner)
 const imported=(await db.query('SELECT * FROM public.ts_companies WHERE legacy_owner_id=$1',[owner])).rows[0]
 assert.equal(imported.name,'Conflicting settings name')
 assert.equal(imported.legacy_profiles.profile.business_name,'Same business name')
 assert.equal(imported.legacy_profiles.contractor_profile.business_name,'Conflicting settings name')
 const old=(await db.query('SELECT * FROM public.reports')).rows[0]
 assert.equal(old.status,'completed');assert.equal(old.stripe_session_id,'historic_fixture')
 await assert.rejects(db.exec("UPDATE public.reports SET status='draft'"),/permission denied/)
 const updated=await cmd('save_company',{companyId:imported.id,revision:imported.revision,name:'Confirmed business',business:{contact_phone:'555-0101'}})
 await assert.rejects(cmd('save_company',{companyId:imported.id,revision:updated.revision,name:'Malformed profile',business:{contact_phone:{unexpected:true}}}),/TS_invalid/)
 await assert.rejects(cmd('save_company',{companyId:imported.id,revision:imported.revision,name:'Stale',business:{}}),/TS_conflict/)
 const draft=await cmd('create_report',{companyId:imported.id,id:randomUUID(),templateId:template.id})
 assert.equal(draft.business_snapshot.name,'Confirmed business');assert.equal(draft.business_snapshot.details.contact_phone,'555-0101')
 await cmd('save_company',{companyId:imported.id,revision:updated.revision,name:'Later name',business:{}})
 assert.equal((await db.query('SELECT business_snapshot FROM public.ts_reports WHERE id=$1',[draft.id])).rows[0].business_snapshot.name,'Confirmed business')
 await as(worker)
 const second=(await db.query('SELECT * FROM public.ts_companies WHERE legacy_owner_id=$1',[worker])).rows[0]
 assert.notEqual(second.id,imported.id);assert.equal((await db.query('SELECT * FROM public.reports')).rows.length,0)
 }finally{await db.close()}
})
