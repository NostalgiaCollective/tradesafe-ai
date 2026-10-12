import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,writeFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve,relative,isAbsolute} from 'node:path'
import {createHash} from 'node:crypto'
import {verifyRecoverySet,validateRestoreTarget} from '../lib/operations/recovery-set.mjs'
test('restore descriptor refuses active/remote, unapproved or incomplete targets',()=>{
 const valid={url:'postgresql://127.0.0.1/drill',authorized:true,authorizationReference:'synthetic test only',isolated:true,emptyVerified:true,outboundIntegrationsDisabled:true,supabaseCompatible:true}
 assert.equal(validateRestoreTarget(valid).database,'drill')
 for(const change of [{authorized:false},{isolated:false},{emptyVerified:false},{supabaseCompatible:false},{outboundIntegrationsDisabled:false},{url:'postgresql://db.yqkiizimbtlygovkscoh.supabase.co/postgres'},{url:'postgresql://db.flhsdtshwwuddzyguyhf.supabase.co/postgres'}])assert.throws(()=>validateRestoreTarget({...valid,...change}))
})
test('archive checks fail for changed inventories, missing/corrupt objects or paths outside the set',async()=>{
 const root=await mkdtemp(join(tmpdir(),'tradesafe-recovery-validation-')),bytes=Buffer.from('synthetic-only'),sha256=createHash('sha256').update(bytes).digest('hex')
 try{
  await writeFile(join(root,'db.dump'),bytes)
  const manifest={version:1,sourceProject:'yqkiizimbtlygovkscoh',quietCaptureVerified:true,beforeInventory:{sha256},afterInventory:{sha256},schemaCoverage:['auth','public'],grantsAndPoliciesIncluded:true,buckets:['tradesafe-evidence','tradesafe-exports'],artifacts:[{kind:'database',path:'db.dump',bytes:bytes.length,sha256}],readyReferences:[],migrations:Array.from({length:7},(_,i)=>({name:'2026091600010'+i+'_synthetic.sql',sha256}))}
  for(const m of manifest.migrations){await writeFile(join(root,m.name),bytes);manifest.artifacts.push({path:m.name,kind:'migration',bytes:bytes.length,sha256})}
  assert.equal((await verifyRecoverySet(root,manifest)).restoreProven,false)
  assert.equal((await verifyRecoverySet(root,manifest)).storageInventory,'LEGACY_REFERENCE_ONLY')
  const databasePaths=['public.dump','auth.dump','storage-policy.dump','migrations.dump']
  for(const path of databasePaths)await writeFile(join(root,path),bytes)
  const local={...manifest,sourceKind:'synthetic-local',sourceProject:'tradesafe-ci',sourceUrl:'http://127.0.0.1:54321',sourceMigrationVersions:manifest.migrations.map(m=>m.name.slice(0,14)),artifacts:[...manifest.artifacts.filter(a=>a.kind==='migration'),...databasePaths.map(path=>({kind:'database',path,bytes:bytes.length,sha256}))]}
  assert.equal((await verifyRecoverySet(root,local)).status,'ARCHIVE_VALIDATED_ONLY')
  assert.equal((await verifyRecoverySet(root,local)).migrationLedger,'MATCHED_DECLARED_LEDGER')
  // Archive format 2 explicitly includes immutable completion/package bytes;
  // legacy two-bucket archives remain distinguishable, not silently upgraded.
  await writeFile(join(root,'retained-package.bin'),bytes)
  const packageArtifact={kind:'object',bucket:'tradesafe-packages',name:'synthetic/package.zip',path:'retained-package.bin',bytes:bytes.length,sha256}
  const extended={...local,version:2,buckets:[...local.buckets,'tradesafe-packages'],artifacts:[...local.artifacts,packageArtifact],readyReferences:[{artifact:packageArtifact.path,bytes:bytes.length,sha256}]}
  assert.equal((await verifyRecoverySet(root,extended)).readyReferences,1)
  assert.equal((await verifyRecoverySet(root,extended)).storageInventory,'LEGACY_REFERENCE_ONLY')
  // Complete storage coverage includes objects with no retained-ready reference.
  await writeFile(join(root,'unreferenced.bin'),bytes)
  await writeFile(join(root,'duplicate-object.bin'),bytes)
  const unreferenced={kind:'object',bucket:'tradesafe-evidence',name:'synthetic/pending.jpg',path:'unreferenced.bin',bytes:bytes.length,sha256}
  const inventory=[packageArtifact,unreferenced].map(({bucket,name})=>({bucket,name}))
  const complete={...extended,version:3,beforeStorageInventory:inventory,afterStorageInventory:inventory,artifacts:[...extended.artifacts,unreferenced]}
  assert.equal((await verifyRecoverySet(root,complete)).storageInventory,'COMPLETE_DECLARED_INVENTORY')
  assert.equal((await verifyRecoverySet(root,complete)).readyReferences,1)
  for(const change of [
   {beforeStorageInventory:undefined},
   {afterStorageInventory:undefined},
   {afterStorageInventory:inventory.slice(1)},
   {beforeStorageInventory:[...inventory,inventory[0]],afterStorageInventory:[...inventory,inventory[0]]},
   {beforeStorageInventory:inventory.slice(0,1),afterStorageInventory:inventory.slice(0,1)},
   {artifacts:complete.artifacts.filter(a=>a.path!==unreferenced.path)},
   {artifacts:[...complete.artifacts,{...unreferenced,path:'duplicate-object.bin'}]},
   {artifacts:complete.artifacts.map(a=>a.path===unreferenced.path?{...a,name:'synthetic/unlisted.jpg'}:a)},
   {readyReferences:[{artifact:'public.dump',bytes:bytes.length,sha256}]},
  ])await assert.rejects(verifyRecoverySet(root,{...complete,...change}))
  // An empty but explicitly captured storage inventory is valid; omission is not.
  const empty={...complete,beforeStorageInventory:[],afterStorageInventory:[],artifacts:local.artifacts,readyReferences:[]}
  assert.equal((await verifyRecoverySet(root,empty)).storageInventory,'COMPLETE_DECLARED_INVENTORY')
  await assert.rejects(verifyRecoverySet(root,{...extended,buckets:local.buckets}))
  await assert.rejects(verifyRecoverySet(root,{...extended,artifacts:local.artifacts}))
  await assert.rejects(verifyRecoverySet(root,{...extended,artifacts:[...local.artifacts,{...packageArtifact,bucket:'unrelated'}]}))
  for(const change of [
   {migrations:[...local.migrations,local.migrations[0]]},
   {migrations:local.migrations.map((m,i)=>i===0?{...m,sha256:'0'.repeat(64)}:m)},
   {artifacts:local.artifacts.filter(a=>a.path!==local.migrations[0].name)},
   {migrations:local.migrations.slice(1)},
   {sourceMigrationVersions:local.sourceMigrationVersions.slice(1)},
   {sourceMigrationVersions:undefined},
  ])await assert.rejects(verifyRecoverySet(root,{...local,...change}))
  for(const path of databasePaths)await assert.rejects(verifyRecoverySet(root,{...local,artifacts:local.artifacts.filter(a=>a.path!==path)}))
  for(const change of [{sourceProject:'production'},{sourceUrl:'https://example.com'},{sourceKind:'unknown'}])await assert.rejects(verifyRecoverySet(root,{...local,...change}))
  await assert.rejects(verifyRecoverySet(root,{...manifest,afterInventory:{sha256:'0'.repeat(64)}}))
  await assert.rejects(verifyRecoverySet(root,{...manifest,readyReferences:[{artifact:'missing.jpg',sha256,bytes:1}]}))
  await assert.rejects(verifyRecoverySet(root,{...manifest,artifacts:[{...manifest.artifacts[0],path:'../outside'}]}))
  await writeFile(join(root,'db.dump'),'corrupt');await assert.rejects(verifyRecoverySet(root,manifest))
 }finally{const target=resolve(root),rel=relative(resolve(tmpdir()),target);assert.ok(rel&&!rel.startsWith('..')&&!isAbsolute(rel)&&rel.startsWith('tradesafe-recovery-validation-'));await rm(target,{recursive:true,force:true})}
})
