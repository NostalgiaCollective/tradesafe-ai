import test from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from 'node:http'
import {once} from 'node:events'
import {createHash} from 'node:crypto'
import {mkdtemp,writeFile,readFile,readdir,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {createClient} from '@supabase/supabase-js'
import {checkedPackageFile,retainPackageFile} from '../lib/evidence/package-storage.mjs'
const hash=bytes=>createHash('sha256').update(bytes).digest('hex')
function barrier(){let resolve;return {promise:new Promise(r=>{resolve=r}),resolve:value=>resolve(value)}}
async function deadline(p){let timer;try{return await Promise.race([p,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Transport barrier timeout')),5000)})])}finally{clearTimeout(timer)}}
async function fixture(signal){
 const dir=await mkdtemp(join(tmpdir(),'tradesafe-http-test-')),temporary=join(dir,'temporary')
 const {mkdir}=await import('node:fs/promises');await mkdir(temporary)
 const saved={TMPDIR:process.env.TMPDIR,TEMP:process.env.TEMP,TMP:process.env.TMP};for(const key of Object.keys(saved))process.env[key]=temporary
 const bytes=Buffer.alloc(8*1024*1024,0x5b),path=join(dir,'archive.zip');await writeFile(path,bytes)
 const row={object_path:'synthetic/generation.zip',byte_size:bytes.length,sha256:hash(bytes)},objects=new Map(),reads=[],bodies=[]
 let mode='',uploadCount=0,received=0,partial=barrier(),closed=barrier()
 const server=createServer((req,res)=>{
  req.on('error',()=>{});res.on('error',()=>{})
  if(req.method==='POST'){
   uploadCount++;let size=0;const chunks=[]
   req.on('data',b=>{size+=b.length;received=size;chunks.push(b);if(mode==='cancel-upload'){req.pause();partial.resolve(size);req.once('close',()=>closed.resolve())}if(mode==='drop-upload'){mode='';partial.resolve(size);req.destroy()}})
   req.on('end',()=>{const value=Buffer.concat(chunks);objects.set(row.object_path,value);if(mode==='lost-upload-response'){mode='';res.destroy();return}res.setHeader('Content-Type','application/json');res.end(JSON.stringify({Key:'tradesafe-packages/'+row.object_path}))})
  }else if(req.method==='GET'){
   const value=objects.get(row.object_path);if(!value){res.writeHead(404,{'Content-Type':'application/json'}).end(JSON.stringify({message:'Missing',statusCode:'404',error:'Not Found'}));return}
   reads.push(value.length);res.writeHead(200,{'Content-Type':'application/zip','Content-Length':String(value.length)})
   if(mode==='slow-download'){res.once('close',()=>closed.resolve());res.write(value.subarray(0,4096));partial.resolve(4096);return}
   res.end(value)
  }else res.writeHead(405).end()
 })
 server.listen(0,'127.0.0.1');await once(server,'listening')
 const client=createClient('http://127.0.0.1:'+server.address().port,'synthetic-test-key',{auth:{persistSession:false},global:{fetch:(url,options)=>{if(options?.method==='POST')bodies.push(options.body);return fetch(url,{...options,signal:AbortSignal.any([signal,options?.signal].filter(Boolean))})}}})
 return {bytes,path,row,objects,reads,bodies,storage:client.storage,get uploadCount(){return uploadCount},get received(){return received},temporary,
  arm(value){mode=value;partial=barrier();closed=barrier()},partial:()=>deadline(partial.promise),closed:()=>deadline(closed.promise),
  async cleanup(){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));for(const [key,value] of Object.entries(saved)){if(value===undefined)delete process.env[key];else process.env[key]=value}await rm(dir,{recursive:true,force:true})}}
}
test('real HTTP upload interruption destroys the source stream and retry preserves the same object identity',async()=>{
 const f=await fixture();try{
  f.arm('drop-upload');const failed=retainPackageFile(f.storage,f.row,f.path);const observed=await f.partial();assert.ok(observed>0&&observed<f.bytes.length)
  await assert.rejects(deadline(failed));assert.equal(f.objects.size,0);assert.equal(f.bodies[0].destroyed,true)
  await retainPackageFile(f.storage,f.row,f.path);assert.equal(f.uploadCount,2);assert.equal(f.objects.size,1);assert.equal(hash(f.objects.get(f.row.object_path)),f.row.sha256)
  assert.deepEqual(await readdir(f.temporary),[])
 }finally{await f.cleanup()}
})
test('real HTTP object commit with lost response is reconciled by unchanged bytes rather than another upload',async()=>{
 const f=await fixture();try{
  f.arm('lost-upload-response');await retainPackageFile(f.storage,f.row,f.path);assert.equal(f.uploadCount,1);assert.equal(f.objects.size,1);assert.deepEqual(f.reads,[f.bytes.length]);assert.equal(hash(f.objects.get(f.row.object_path)),f.row.sha256);assert.deepEqual(await readdir(f.temporary),[])
 }finally{await f.cleanup()}
})
test('real HTTP retained retrieval cancelled after first bytes closes the socket and removes its partial spool',async()=>{
 const f=await fixture();try{
  f.objects.set(f.row.object_path,f.bytes);f.arm('slow-download');const controller=new AbortController(),pending=checkedPackageFile(f.storage,f.row,controller.signal)
  const observed=await f.partial();assert.ok(observed>0&&observed<f.bytes.length);controller.abort();await assert.rejects(deadline(pending));await f.closed();assert.deepEqual(await readdir(f.temporary),[])
  f.arm('');const verified=await checkedPackageFile(f.storage,f.row);assert.equal(hash(await readFile(verified.path)),f.row.sha256);await verified.cleanup();assert.deepEqual(await readdir(f.temporary),[])
 }finally{await f.cleanup()}
})
import {packageFileResponse} from '../lib/evidence/package-response.mjs'
import {acquireSlot} from '../lib/evidence/resource-slots.mjs'

test('real outgoing HTTP download cancellation removes verified spool and releases admission',async()=>{
 const f=await fixture();let server
 try{
  f.objects.set(f.row.object_path,f.bytes)
  const verified=await checkedPackageFile(f.storage,f.row),controller=new AbortController(),cleaned=barrier(),sent=barrier()
  const release=acquireSlot('pdf')
  server=createServer(async(req,res)=>{
   const response=packageFileResponse(verified,f.row,controller.signal,()=>{release();cleaned.resolve()})
   const reader=response.body.getReader();res.once('close',()=>controller.abort())
   try{const first=await reader.read();res.write(first.value);sent.resolve();await cleaned.promise}catch{}finally{try{await reader.cancel()}catch{}}
  })
  server.listen(0,'127.0.0.1');await once(server,'listening')
  const client=new AbortController(),response=await fetch('http://127.0.0.1:'+server.address().port,{signal:client.signal})
  await deadline(sent.promise);const first=await response.body.getReader().read();assert.ok(first.value.length>0&&first.value.length<f.bytes.length)
  assert.throws(()=>acquireSlot('pdf'));client.abort();await deadline(cleaned.promise)
  assert.deepEqual(await readdir(f.temporary),[]);acquireSlot('pdf')()
  assert.equal(hash(f.objects.get(f.row.object_path)),f.row.sha256)
 }finally{server?.closeAllConnections();if(server)await new Promise(r=>server.close(r));await f.cleanup()}
})

test('real HTTP upload aborted after bytes begin cancels scoped storage fetch and destroys file stream',async()=>{
 const controller=new AbortController(),f=await fixture(controller.signal)
 try{
  f.arm('cancel-upload');const operation=retainPackageFile(f.storage,f.row,f.path,controller.signal);operation.catch(()=>{})
  assert.ok(await f.partial()>0);controller.abort();await assert.rejects(deadline(operation));assert.equal(f.bodies[0].destroyed,true);assert.equal(f.objects.size,0);assert.deepEqual(await readdir(f.temporary),[])
 }finally{await f.cleanup()}
})
