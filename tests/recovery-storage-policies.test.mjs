import test from 'node:test'
import assert from 'node:assert/strict'
import {PGlite} from '@electric-sql/pglite'
import {privateStorageProbeSql,storagePolicyArchiveEntry} from '../scripts/operations/local-rehearsal.mjs'

test('restore selects every storage object policy, excluding unrelated objects and comments',()=>{
 for(const name of ['ts_private_objects','ts_private_packages','future_guard','existing_permissive']){
  assert.equal(storagePolicyArchiveEntry(`4332; 3256 18833 POLICY storage objects ${name} supabase_storage_admin`),true)
 }
 for(const line of ['; 4332; 3256 18833 POLICY storage objects ignored owner','4332; 3256 18833 TABLE storage objects owner','4332; 3256 18833 POLICY public objects ignored owner','4332; 3256 18833 POLICY storage buckets ignored owner'])assert.equal(storagePolicyArchiveEntry(line),false)
})

test('rollback-only restored-policy probe detects an omitted package guard without changing records or policies',async()=>{
 const db=new PGlite()
 try{
  await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE SCHEMA storage;
   CREATE TABLE storage.objects(id integer PRIMARY KEY,bucket_id text);
   ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
   GRANT USAGE ON SCHEMA storage TO anon,authenticated;
   GRANT SELECT ON storage.objects TO anon,authenticated;
   INSERT INTO storage.objects VALUES(1,'tradesafe-evidence'),(2,'tradesafe-exports'),(3,'tradesafe-packages');
   CREATE POLICY ts_private_objects ON storage.objects AS RESTRICTIVE FOR ALL TO anon,authenticated USING(bucket_id NOT IN ('tradesafe-evidence','tradesafe-exports'));
   CREATE POLICY ts_private_packages ON storage.objects AS RESTRICTIVE FOR ALL TO anon,authenticated USING(bucket_id<>'tradesafe-packages');`)
  const records=async()=>(await db.query('SELECT * FROM storage.objects ORDER BY id')).rows
  const policies=async()=>(await db.query("SELECT * FROM pg_policies WHERE schemaname='storage' ORDER BY policyname")).rows
  const originalRecords=await records(),originalPolicies=await policies()
  const probe=async()=> (await db.exec(privateStorageProbeSql())).flatMap(result=>result.rows.map(row=>Object.values(row)[0]))
  assert.deepEqual(await probe(),['authenticated:0','anon:0'])
  assert.deepEqual(await records(),originalRecords);assert.deepEqual(await policies(),originalPolicies)
  // Demonstrates the previously omitted guard, rather than merely inspecting SQL text.
  await db.exec('DROP POLICY ts_private_packages ON storage.objects')
  assert.deepEqual(await probe(),['authenticated:1','anon:1'])
  assert.deepEqual(await records(),originalRecords)
  assert.equal((await policies()).some(p=>p.policyname==='ts_recovery_probe_permissive'),false)
 }finally{await db.close()}
})
