import {createReadStream} from 'node:fs'
import {open,mkdtemp,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {createHash} from 'node:crypto'
import {PACKAGE_LIMITS} from './package-zip.mjs'

export const PACKAGE_BUCKET='tradesafe-packages'
// Spool and verify before exposing a response. Memory is bounded by stream chunks,
// not archive size. Only this function's private temporary directory is removed.
export async function checkedPackageFile(storage,row,signal){
 if(!Number.isSafeInteger(row.byte_size)||row.byte_size<1||row.byte_size>PACKAGE_LIMITS.bytes||!/^[a-f0-9]{64}$/.test(row.sha256||''))throw new Error('Package integrity')
 const dir=await mkdtemp(join(tmpdir(),'tradesafe-retained-')),path=join(dir,'package.zip')
 const cleanup=()=>rm(dir,{recursive:true,force:true})
 let file,reader
 try{
  const result=await storage.from(PACKAGE_BUCKET).download(row.object_path,{}, {signal}).asStream()
  if(result.error||!result.data)throw new Error('Package integrity')
  file=await open(path,'wx',0o600);reader=result.data.getReader()
  let size=0;const hash=createHash('sha256')
  while(true){
   if(signal?.aborted)throw new Error('Package interrupted')
   const {done,value}=await reader.read();if(done)break
   size+=value.byteLength;if(size>row.byte_size)throw new Error('Package integrity')
   hash.update(value)
   let offset=0;while(offset<value.byteLength){const r=await file.write(value,offset,value.byteLength-offset);if(!r.bytesWritten)throw new Error('Package write');offset+=r.bytesWritten}
  }
  if(size!==row.byte_size||hash.digest('hex')!==row.sha256)throw new Error('Package integrity')
  await file.close();file=null
  return {path,cleanup}
 }catch(error){try{await reader?.cancel()}catch{}await file?.close();await cleanup();throw error}
 finally{reader?.releaseLock()}
}

export async function retainPackageFile(storage,row,path,signal){
 const input=createReadStream(path)
 const abort=()=>input.destroy(new Error('Package interrupted'))
 signal?.addEventListener('abort',abort,{once:true})
 try{
  if(signal?.aborted)throw new Error('Package interrupted')
  const result=await storage.from(PACKAGE_BUCKET).upload(row.object_path,input,{contentType:'application/zip',cacheControl:'0',upsert:false})
  if(result.error){
   // A successful storage write may have lost its response. Never overwrite it.
   const existing=await checkedPackageFile(storage,row,signal);await existing.cleanup()
  }
 }finally{signal?.removeEventListener('abort',abort);input.destroy()}
}
