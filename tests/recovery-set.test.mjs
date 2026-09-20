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
  assert.equal((await verifyRecoverySet(root,manifest)).restoreProven,false)
  const databasePaths=['public.dump','auth.dump','storage-policy.dump','migrations.dump']
  for(const path of databasePaths)await writeFile(join(root,path),bytes)
  const local={...manifest,sourceKind:'synthetic-local',sourceProject:'tradesafe-ci',sourceUrl:'http://127.0.0.1:54321',artifacts:databasePaths.map(path=>({kind:'database',path,bytes:bytes.length,sha256}))}
  assert.equal((await verifyRecoverySet(root,local)).status,'ARCHIVE_VALIDATED_ONLY')
  for(const path of databasePaths)await assert.rejects(verifyRecoverySet(root,{...local,artifacts:local.artifacts.filter(a=>a.path!==path)}))
  for(const change of [{sourceProject:'production'},{sourceUrl:'https://example.com'},{sourceKind:'unknown'}])await assert.rejects(verifyRecoverySet(root,{...local,...change}))
  await assert.rejects(verifyRecoverySet(root,{...manifest,afterInventory:{sha256:'0'.repeat(64)}}))
  await assert.rejects(verifyRecoverySet(root,{...manifest,readyReferences:[{artifact:'missing.jpg',sha256,bytes:1}]}))
  await assert.rejects(verifyRecoverySet(root,{...manifest,artifacts:[{...manifest.artifacts[0],path:'../outside'}]}))
  await writeFile(join(root,'db.dump'),'corrupt');await assert.rejects(verifyRecoverySet(root,manifest))
 }finally{const target=resolve(root),rel=relative(resolve(tmpdir()),target);assert.ok(rel&&!rel.startsWith('..')&&!isAbsolute(rel)&&rel.startsWith('tradesafe-recovery-validation-'));await rm(target,{recursive:true,force:true})}
})
