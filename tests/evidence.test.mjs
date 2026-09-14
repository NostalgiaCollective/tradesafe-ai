import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { PGlite } from '@electric-sql/pglite'
import sharp from 'sharp'
import { validateImage,readImageBody,MAX_IMAGE_BYTES } from '../lib/evidence/images.mjs'
import { getTemplate } from '../lib/domain/templates.ts'

test('image bytes are decoded, bounded, normalized and stripped of EXIF',async()=>{
 for(const format of ['jpeg','png','webp']){
  const raw=await sharp({create:{width:40,height:30,channels:3,background:'red'}})[format]().withExif({IFD0:{Artist:'Unverified client'}}).toBuffer()
  const image=await validateImage(raw),meta=await sharp(image.bytes).metadata()
  assert.equal(meta.format,'jpeg');assert.equal(meta.exif,undefined);assert.equal(image.byteSize,image.bytes.length)
 }
 const gif=await sharp({create:{width:40,height:30,channels:3,background:'red'}}).gif().toBuffer()
 await assert.rejects(validateImage(gif),{code:'image_invalid'})
 for(const raw of [Buffer.from('<svg/>'),Buffer.from('fake JPEG'),Buffer.alloc(MAX_IMAGE_BYTES+1)])await assert.rejects(validateImage(raw),{code:'image_invalid'})
 const huge=await sharp({create:{width:5000,height:5000,channels:3,background:'white'}}).png().toBuffer()
 await assert.rejects(validateImage(huge),{code:'image_invalid'})
 await assert.rejects(readImageBody(new Request('https://example.test',{method:'POST',body:Buffer.alloc(MAX_IMAGE_BYTES+1)})),{code:'image_invalid'})
 const jpeg=await sharp({create:{width:50,height:50,channels:3,background:'red'}}).jpeg().toBuffer()
 await assert.rejects(validateImage(jpeg.subarray(0,Math.floor(jpeg.length/2))),{code:'image_invalid'})
})

test('evidence transaction boundaries, immutable snapshots, export leases and direct denial',async()=>{
 const db=new PGlite(),owner=randomUUID(),worker=randomUUID(),outsider=randomUUID(),company=randomUUID(),other=randomUUID(),id=randomUUID(),template=getTemplate('electrical')
 try{
  await db.exec(`CREATE ROLE authenticated;CREATE ROLE anon;CREATE ROLE service_role BYPASSRLS;CREATE SCHEMA auth;CREATE SCHEMA storage;
   CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,email_confirmed_at timestamptz);
   CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
   GRANT USAGE ON SCHEMA public,auth,storage TO authenticated,anon,service_role;
   CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
   CREATE TABLE storage.objects(id uuid PRIMARY KEY,bucket_id text,name text);ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
   GRANT ALL ON storage.objects TO authenticated,anon;`)
  for(const [i,user] of [owner,worker,outsider].entries())await db.query('INSERT INTO auth.users VALUES($1,$2,now())',[user,'fixture'+i+'@example.test'])
  for(const name of ['20260911000100_staging_baseline.sql','20260911000200_company_workflow.sql','20260911000300_template_v1.sql','20260913000100_private_evidence_exports.sql','20260914000100_evidence_cleanup_guard.sql'])await db.exec(await readFile(new URL('../supabase/migrations/'+name,import.meta.url),'utf8'))
  const as=async(user,role='authenticated')=>{await db.exec('RESET ROLE;SET ROLE '+role);await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[user])}
  const call=async(name,args)=>{const vals=Object.values(args);return (await db.query('SELECT public.'+name+'('+vals.map((_,i)=>'$'+(i+1)).join(',')+') AS value',vals.map(v=>typeof v==='object'?JSON.stringify(v):v))).rows[0].value}
  const command=(command,p)=>call('ts_command',{command,p:{companyId:company,requestId:randomUUID(),...p}})
  await as(owner);await command('create_company',{id:company,name:'Synthetic A'})
  await command('invite',{email:'fixture1@example.test',role:'worker',token:'a'.repeat(64)})
  await as(worker);await command('accept_invitation',{token:'a'.repeat(64)})
  let r=await command('create_report',{id,templateId:template.id})
  const photo={reportId:id,id:randomUUID(),caption:'Synthetic photo',sha256:'a'.repeat(64),byteSize:100,width:40,height:30}
  const reserve=p=>call('ts_evidence_command',{command:'reserve',p:p||photo})
  const e=await reserve();assert.equal(e.state,'pending');assert.equal((await reserve()).id,e.id)
  await assert.rejects(reserve({...photo,caption:'Replacement'}),/TS_conflict/)
  await assert.rejects(call('ts_complete_evidence',{id:e.id,actor:worker}),/permission denied/)
  await assert.rejects(db.exec("UPDATE public.ts_evidence SET state='ready'"),/permission denied/)
  await assert.rejects(db.query('INSERT INTO storage.objects VALUES($1,$2,$3)',[randomUUID(),'tradesafe-evidence',e.object_path]),/row-level security/)
  const document={job:{address:'Synthetic site',client:'',date:'2026-09-14'},answers:Object.fromEntries(template.items.map(i=>[i.id,{state:'meets',note:'',controls:''}]))}
  r=await command('save_report',{id,revision:r.revision,document})
  await assert.rejects(command('finalize',{id,revision:r.revision,acknowledged:true}),/TS_evidence_pending/)
  await as(outsider);await command('create_company',{id:other,name:'Synthetic B'})
  assert.equal((await db.query('SELECT * FROM public.ts_evidence')).rows.length,0)
  await assert.rejects(reserve(),/TS_denied/)
  await as(worker,'service_role');await call('ts_complete_evidence',{id:e.id,actor:worker})
  await as(worker);r=await command('finalize',{id,revision:r.revision,acknowledged:true})
  assert.equal(r.evidence_snapshot.length,1);assert.equal(r.evidence_snapshot[0].uploader_id,worker);assert.ok(r.evidence_snapshot[0].uploaded_at)
  await assert.rejects(call('ts_evidence_command',{command:'remove',p:photo}),/TS_immutable/)
  await assert.rejects(reserve({...photo,id:randomUUID()}),/TS_immutable/)
  const amendment=await command('amend',{id:randomUUID(),amendmentOf:id,reason:'Correction'})
  assert.equal(amendment.evidence_snapshot,null)
  const pending=await reserve({...photo,reportId:amendment.id,id:randomUUID()})
  await call('ts_evidence_command',{command:'remove',p:{reportId:amendment.id,id:pending.id}})
  await assert.rejects(call('ts_evidence_cleanup_candidate',{id:pending.id}),/permission denied/)
  await as(worker,'service_role');await assert.rejects(call('ts_complete_evidence',{id:pending.id,actor:worker}),/TS_immutable/)
  assert.equal((await call('ts_evidence_cleanup_candidate',{id:pending.id})).id,pending.id)
  await assert.rejects(call('ts_evidence_cleanup_candidate',{id:e.id}),/TS_immutable/)
  const attempt=randomUUID(),job=await call('ts_export_job',{command:'begin',p:{reportId:id,attempt},actor:worker})
  await assert.rejects(call('ts_export_job',{command:'begin',p:{reportId:id,attempt:randomUUID()},actor:worker}),/TS_export_busy/)
  await call('ts_export_job',{command:'fail',p:{reportId:id,attempt,code:'evidence_missing'},actor:worker})
  const retry=randomUUID(),retried=await call('ts_export_job',{command:'begin',p:{reportId:id,attempt:retry},actor:worker})
  assert.deepEqual(retried.snapshot,job.snapshot);assert.equal(retried.cutoff_at,job.cutoff_at)
  await assert.rejects(call('ts_export_job',{command:'complete',p:{reportId:id,attempt,sha256:'b'.repeat(64),byteSize:123},actor:worker}),/TS_conflict/)
  await call('ts_export_job',{command:'complete',p:{reportId:id,attempt:retry,sha256:'b'.repeat(64),byteSize:123},actor:worker})
  await assert.rejects(db.exec("UPDATE public.ts_exports SET sha256=repeat('c',64)"),/TS_immutable/)
  await as(outsider);assert.equal((await db.query('SELECT * FROM public.ts_exports')).rows.length,0)
  await assert.rejects(call('ts_export_job',{command:'begin',p:{reportId:id,attempt:randomUUID()},actor:outsider}),/permission denied/)
  await as(owner);await command('member',{userId:worker,role:'remove'})
  await as(worker);assert.equal((await db.query('SELECT * FROM public.ts_evidence')).rows.length,0);assert.equal((await db.query('SELECT * FROM public.ts_exports')).rows.length,0)
 }finally{await db.close()}
})
