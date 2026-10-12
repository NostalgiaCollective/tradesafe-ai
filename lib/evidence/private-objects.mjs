import {AppError} from '../domain/errors.ts'
import {digest} from './images.mjs'

export async function objectBytes(server,bucket,path,hash,size){
 const result=await server.storage.from(bucket).download(path)
 if(result.error||!result.data)throw new AppError('evidence_missing')
 const bytes=Buffer.from(await result.data.arrayBuffer())
 if(bytes.length!==size||digest(bytes)!==hash)throw new AppError('evidence_missing')
 return bytes
}
export async function retainObject(server,bucket,path,bytes,hash,type){
 const saved=await server.storage.from(bucket).upload(path,bytes,{contentType:type,cacheControl:'0',upsert:false})
 // A failed response can follow a committed upload. Read and verify the exact immutable object.
 if(saved.error){await objectBytes(server,bucket,path,hash,bytes.length)}
}
