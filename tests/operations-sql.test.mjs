import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {randomUUID} from 'node:crypto'
import {PGlite} from '@electric-sql/pglite'
test('operations: scheduling authorization, audit, retries, stale edits and RLS history',async()=>{
 const db=new PGlite(),[owner,worker,outside]=Array.from({length:3},randomUUID),company=randomUUID(),site=randomUUID()
 try{
 await db.exec(`CREATE ROLE authenticated;CREATE ROLE anon;CREATE ROLE service_role BYPASSRLS;CREATE SCHEMA auth;CREATE SCHEMA storage;CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,email_confirmed_at timestamptz);CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;GRANT USAGE ON SCHEMA public,auth,storage TO authenticated,anon,service_role;CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);CREATE TABLE storage.objects(id uuid PRIMARY KEY,bucket_id text,name text);ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;`)
 for(const [i,u] of [owner,worker,outside].entries())await db.query('INSERT INTO auth.users VALUES($1,$2,now())',[u,`operations${i}@example.test`])
 for(const f of ['20260911000100_staging_baseline','20260911000200_company_workflow','20260911000300_template_v1','20260913000100_private_evidence_exports','20260916000100_resource_admission','20260921000100_daily_briefs','20260921000200_brief_action_assignment','20260921000300_brief_content','20260922000100_sites','20260923000100_crew_coordination','20260923000200_site_concerns','20260929000100_site_handover','20261002000100_action_planning','20261002000200_site_history','20261002000300_site_evidence_package','20261002000400_action_priority_clear'])await db.exec(await readFile(new URL('../supabase/migrations/'+f+'.sql',import.meta.url),'utf8'))
 const as=async u=>{await db.exec('RESET ROLE;SET ROLE authenticated');await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[u])},rpc=async(fn,command,p)=>(await db.query(`SELECT public.${fn}($1,$2::jsonb) v`,[command,JSON.stringify({companyId:company,requestId:randomUUID(),...p})])).rows[0].v
 await as(owner);await rpc('ts_command','create_company',{id:company,name:'SYNTHETIC operations'});await rpc('ts_site_command','create',{id:site,document:{name:'SYNTHETIC operations site',address:'Test',instructions:''}})
 await rpc('ts_command','invite',{email:'operations1@example.test',role:'worker',token:'2'.repeat(64)});await as(worker);await rpc('ts_command','accept_invitation',{token:'2'.repeat(64)})
 const c=await rpc('ts_concern_command','create',{id:randomUUID(),siteId:site,document:{observation:'SYNTHETIC overdue material',location:'Bay',immediate:'',observedAt:''}});await rpc('ts_concern_command','submit',{id:c.id,revision:c.revision})
 let a=(await db.query('SELECT * FROM public.ts_actions WHERE concern_id=$1',[c.id])).rows[0];assert.equal(a.priority,'unspecified')
 const p={id:a.id,revision:a.revision,requestId:randomUUID(),state:'open',responsibleId:worker,controls:'',resolution:'',targetDate:'2026-10-01',priority:'high'}
 await assert.rejects(rpc('ts_command','update_action',p),/TS_denied/)
 await as(owner);a=await rpc('ts_command','update_action',p);assert.equal(a.priority,'high');assert.equal(a.target_date,'2026-10-01')
 assert.equal((await rpc('ts_command','update_action',p)).revision,a.revision)
 await assert.rejects(rpc('ts_command','update_action',{...p,priority:'low'}),/TS_conflict/)
 await assert.rejects(rpc('ts_command','update_action',{...p,requestId:randomUUID()}),/TS_conflict/)
 a=await rpc('ts_command','update_action',{...p,requestId:randomUUID(),revision:a.revision,state:'closed',resolution:'SYNTHETIC verified'})
 a=await rpc('ts_command','update_action',{...p,requestId:randomUUID(),revision:a.revision,state:'open'})
 assert.equal(a.target_date,'2026-10-01');assert.equal((await rpc('ts_command','update_action',p)).revision,a.revision)
 const events=(await db.query("SELECT * FROM public.ts_events WHERE entity_id=$1 AND kind='action_updated' ORDER BY id",[a.id])).rows
 assert.equal(events.length,3);assert.equal(events[0].before_value.target_date,null);assert.equal(events[0].after_value.priority,'high');assert.equal(events[0].actor_id,owner);assert.ok(events[0].occurred_at)
 assert.equal((await db.query('SELECT priority FROM public.ts_site_actions WHERE id=$1',[a.id])).rows[0].priority,'high')
 assert.equal((await db.query('SELECT priority FROM public.ts_action_ownership WHERE id=$1',[a.id])).rows[0].priority,'high')
 const date=(await db.query("SELECT (now() AT TIME ZONE 'America/Toronto')::date::text d")).rows[0].d
 const search=async(q='',kind='all',cutoff=null,before=null,key='')=>(await db.query('SELECT public.ts_search_site_history($1,$2,$2,$3,$4,coalesce($5::timestamptz,now()),$6,$7) v',[site,date,kind,q,cutoff,before,key])).rows[0].v
 const snapshot=async()=>(await db.query('SELECT public.ts_site_evidence_snapshot($1,$2,$2) v',[site,date])).rows[0].v
 assert.equal((await search('material','concern')).rows.length,1);assert.equal((await search('material','action')).rows.length,3)
 const snap=await snapshot();assert.equal(snap.concerns.length,1);assert.equal(snap.actions[0].priority,'high');assert.equal(snap.history.length,5)
 a=await rpc('ts_command','update_action',{...p,revision:a.revision,requestId:randomUUID(),targetDate:'',priority:'unspecified'});assert.equal(a.target_date,null);assert.equal(a.priority,'unspecified');a=await rpc('ts_command','update_action',{...p,revision:a.revision,requestId:randomUUID()});
 await assert.rejects(db.query("SELECT public.ts_site_evidence_snapshot($1,'2026-01-01','2026-03-01')",[site]),/TS_invalid/)
 // Representative authorized history at a single timestamp: keyset pagination must neither
 // duplicate nor drop rows, including lexically ordered numeric event IDs.
 await db.exec('RESET ROLE');await db.query(`INSERT INTO public.ts_events(company_id,actor_id,kind,entity_id,before_value,after_value) SELECT $1,$2,'action_updated',$3,$4,$4 FROM generate_series(1,1500)`,[company,owner,a.id,JSON.stringify(a)]);await as(owner)
 const began=performance.now(),plan=(await db.query("EXPLAIN (ANALYZE,FORMAT JSON) SELECT * FROM public.ts_site_history WHERE site_id=$1 AND kind='action' ORDER BY occurred_at DESC,event_key DESC LIMIT 31",[site])).rows
 assert.ok(plan.length);assert.ok(performance.now()-began<8000)
 const first=await search('','action'),last=first.rows[29],next=await search('','action',first.cutoff,last.occurred_at,last.event_key)
 assert.equal(first.rows.length,31);assert.equal(next.rows.length,31);assert.equal(new Set([...first.rows.slice(0,30),...next.rows.slice(0,30)].map(r=>r.event_key)).size,60)
 await assert.rejects(snapshot(),/TS_package_limit/)
 await as(outside);assert.equal((await db.query('SELECT * FROM public.ts_actions')).rows.length,0)
 await assert.rejects(search(),/TS_not_found/);await assert.rejects(snapshot(),/TS_not_found/)
 await as(owner);await rpc('ts_command','member',{userId:worker,role:'remove'});await as(worker);assert.equal((await db.query('SELECT * FROM public.ts_actions')).rows.length,0);await assert.rejects(rpc('ts_command','update_action',{...p,revision:a.revision}),/TS_denied/)
 await assert.rejects(search(),/TS_not_found/);await assert.rejects(snapshot(),/TS_not_found/)
 }finally{await db.close()}
})
