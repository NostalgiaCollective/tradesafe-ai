import {realpath,stat} from 'node:fs/promises'
import {createReadStream} from 'node:fs'
import {resolve,relative,isAbsolute} from 'node:path'
import {createHash} from 'node:crypto'
import assert from 'node:assert/strict'
export function validateRestoreTarget(target){
 assert.equal(target.authorized,true,'Isolated target authorization is required')
 assert.ok(target.authorizationReference?.trim(),'Record the authorization reference')
 const url=new URL(target.url)
 assert.ok(['postgres:','postgresql:'].includes(url.protocol),'Use a PostgreSQL target')
 assert.ok(['localhost','127.0.0.1','[::1]'].includes(url.hostname),'Only an explicitly authorized loopback target is supported')
 assert.ok(!url.username&&!url.password,'Keep credentials in a protected PG service/passfile')
 assert.equal(target.isolated,true);assert.equal(target.emptyVerified,true)
 assert.equal(target.outboundIntegrationsDisabled,true)
 assert.equal(target.supabaseCompatible,true,'Plain PostgreSQL is insufficient for full Auth/Storage/application restore')
 return {host:url.hostname,database:url.pathname.slice(1),authorizationReference:target.authorizationReference}
}
export async function verifyRecoverySet(root,manifest){
 assert.equal(manifest.version,1);assert.equal(manifest.sourceProject,'yqkiizimbtlygovkscoh')
 assert.equal(manifest.quietCaptureVerified,true,'A consistent database/object capture is required')
 assert.deepEqual(manifest.beforeInventory,manifest.afterInventory,'Capture inventories changed')
 assert.ok(manifest.beforeInventory?.sha256?.match(/^[a-f0-9]{64}$/))
 assert.ok(manifest.schemaCoverage?.includes('public')&&manifest.schemaCoverage.includes('auth'))
 assert.equal(manifest.grantsAndPoliciesIncluded,true)
 assert.ok(manifest.artifacts?.some(a=>a.kind==='database'))
 const base=await realpath(root),paths=new Set()
 for(const a of manifest.artifacts){
  assert.ok(a.path&&!isAbsolute(a.path)&&!a.path.includes('..'),'Unsafe artifact path')
  const path=await realpath(resolve(base,a.path)),rel=relative(base,path)
  assert.ok(rel&&!rel.startsWith('..')&&!isAbsolute(rel),'Artifact escapes recovery directory')
  assert.ok(!paths.has(a.path),'Duplicate artifact');paths.add(a.path)
  assert.equal((await stat(path)).size,a.bytes,'Artifact length mismatch')
  const hash=createHash('sha256');for await(const chunk of createReadStream(path))hash.update(chunk)
  assert.equal(hash.digest('hex'),a.sha256,'Artifact hash mismatch')
 }
 for(const reference of manifest.readyReferences||[]){
  const a=manifest.artifacts.find(a=>a.path===reference.artifact)
  assert.ok(a,'Required retained bytes missing');assert.equal(a.sha256,reference.sha256);assert.equal(a.bytes,reference.bytes)
 }
 assert.ok(Array.isArray(manifest.readyReferences),'Record all ready photo/PDF references')
 assert.deepEqual([...manifest.buckets].sort(),['tradesafe-evidence','tradesafe-exports'])
 assert.ok(manifest.migrations?.length>=7&&manifest.migrations.every(m=>/^\d{14}_.+\.sql$/.test(m.name)&&/^[a-f0-9]{64}$/.test(m.sha256)))
 return {status:'ARCHIVE_VALIDATED_ONLY',artifacts:paths.size,readyReferences:manifest.readyReferences.length,restoreProven:false}
}
