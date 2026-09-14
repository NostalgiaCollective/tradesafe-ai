import sharp from 'sharp'
import { createHash } from 'node:crypto'
import { AppError } from '../domain/errors.ts'
export const MAX_IMAGE_BYTES = 3 * 1024 * 1024
export const digest = bytes => createHash('sha256').update(bytes).digest('hex')

export async function readImageBody(request) {
 if (Number(request.headers.get('content-length')) > MAX_IMAGE_BYTES) throw new AppError('image_invalid')
 if (!request.body) throw new AppError('image_invalid')
 const reader=request.body.getReader(), chunks=[];let size=0
 try { while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength
  if(size>MAX_IMAGE_BYTES){await reader.cancel();throw new AppError('image_invalid')}chunks.push(value)}
 } finally {reader.releaseLock()}
 return Buffer.concat(chunks)
}
export async function validateImage(input) {
 if(!input.length||input.length>MAX_IMAGE_BYTES)throw new AppError('image_invalid')
 try {
  const image=sharp(input,{failOn:'warning',limitInputPixels:20000000,animated:false})
  const meta=await image.metadata()
  if(!['jpeg','png','webp'].includes(meta.format)||(meta.pages||1)!==1)throw new Error('Unsupported image')
  // Some decoders expose only the first APNG/WebP frame. Reject animation containers explicitly.
  if(meta.format==='png')for(let offset=8;offset+12<=input.length;){const length=input.readUInt32BE(offset),kind=input.toString('ascii',offset+4,offset+8);if(kind==='acTL')throw new Error('Animated PNG');offset+=12+length}
  if(meta.format==='webp')for(let offset=12;offset+8<=input.length;){const kind=input.toString('ascii',offset,offset+4),length=input.readUInt32LE(offset+4);if(kind==='ANIM'||kind==='ANMF')throw new Error('Animated WebP');offset+=8+length+(length%2)}
  // Decode and re-encode actual pixels; orientation is applied, metadata/EXIF is discarded.
  const {data,info}=await image.rotate().resize({width:2400,height:2400,fit:'inside',withoutEnlargement:true}).flatten({background:'#ffffff'}).jpeg({quality:85}).toBuffer({resolveWithObject:true})
  if(data.length>MAX_IMAGE_BYTES)throw new Error('Output too large')
  return {bytes:data,sha256:digest(data),byteSize:data.length,width:info.width,height:info.height}
 }catch {throw new AppError('image_invalid')}
}
