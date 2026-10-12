import test from 'node:test'
import assert from 'node:assert/strict'
import {Readable} from 'node:stream'
import {readFile,access} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {checkedPackageFile,retainPackageFile,PACKAGE_BUCKET} from '../lib/evidence/package-storage.mjs'
import {packageZip} from '../lib/evidence/package-zip.mjs'
const hash=b=>createHash('sha256').update(b).digest('hex')
function storage(bytes,uploadError=false){
 return {from(bucket){
  assert.equal(bucket,PACKAGE_BUCKET)
  return {
   download(){return {asStream:async()=>({data:Readable.toWeb(Readable.from([bytes.subarray(0,3),bytes.subarray(3)]))})}},
   async upload(_path,stream){const chunks=[];for await(const b of stream)chunks.push(b);assert.deepEqual(Buffer.concat(chunks),bytes);return {error:uploadError?new Error('Response lost'):null}}
  }
 }}
}
test('retained package streaming checks bytes before release and recovers a lost upload response',async()=>{
 const zip=await packageZip();let local
 try{await zip.add('index.html','Synthetic retained handover');await zip.finish();const bytes=await readFile(zip.path),row={object_path:'synthetic/generation.zip',byte_size:bytes.length,sha256:hash(bytes)}
  await retainPackageFile(storage(bytes,true),row,zip.path)
  local=await checkedPackageFile(storage(bytes),row);assert.deepEqual(await readFile(local.path),bytes)
  const controller=new AbortController();controller.abort();await assert.rejects(checkedPackageFile(storage(bytes),row,controller.signal),/interrupted/)
  await assert.rejects(checkedPackageFile(storage(bytes),{...row,byte_size:bytes.length-1}),/integrity/)
  await assert.rejects(checkedPackageFile(storage(bytes),{...row,sha256:'0'.repeat(64)}),/integrity/)
  await assert.rejects(checkedPackageFile({from:()=>({download:()=>({asStream:async()=>({error:new Error('Missing')})})})},row),/integrity/)
  await assert.rejects(checkedPackageFile(storage(bytes),{...row,byte_size:67108865}),/integrity/)
 }finally{await zip.cleanup();await local?.cleanup()}
 await assert.rejects(access(local.path))
})
