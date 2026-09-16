import test from 'node:test'
import assert from 'node:assert/strict'
import sharp from 'sharp'
import {largePhoto,jpegAtSize} from './fixtures/large-photo.mjs'
import {validateImage,readImageBody,MAX_IMAGE_BYTES,MAX_NORMALIZED_IMAGE_BYTES} from '../lib/evidence/images.mjs'
import {renderExport} from '../lib/evidence/pdf.mjs'
import {getTemplate} from '../lib/domain/templates.ts'

test('5 MiB inclusive input boundary; normalized storage and ten-photo PDF budgets remain unchanged',async()=>{
 assert.equal(MAX_IMAGE_BYTES,5242880);assert.equal(MAX_NORMALIZED_IMAGE_BYTES,3145728)
 const original=await largePhoto();assert.ok(original.length>3*1024*1024&&original.length<MAX_IMAGE_BYTES)
 const exact=jpegAtSize(original,MAX_IMAGE_BYTES)
 for(const bytes of [original,exact]){
  const raw=await readImageBody(new Request('https://example.test',{method:'POST',body:bytes}))
  assert.equal(raw.length,bytes.length)
  const image=await validateImage(raw),metadata=await sharp(image.bytes).metadata()
  assert.ok(image.byteSize<=MAX_NORMALIZED_IMAGE_BYTES);assert.ok(image.width<=2400&&image.height<=2400)
  assert.equal(metadata.format,'jpeg');assert.equal(metadata.exif,undefined)
 }
 const over=jpegAtSize(original,MAX_IMAGE_BYTES+1)
 await assert.rejects(validateImage(over),{code:'image_invalid'})
 await assert.rejects(readImageBody(new Request('https://example.test',{method:'POST',body:over,headers:{'content-length':String(over.length)}})),{code:'image_invalid'})
 // Streaming/no Content-Length must enforce the same limit and cancel excess.
 let cancelled=false
 const stream=new ReadableStream({start(controller){controller.enqueue(over)},cancel(){cancelled=true}})
 await assert.rejects(readImageBody(new Request('https://example.test',{method:'POST',body:stream,duplex:'half'})),{code:'image_invalid'})
 assert.equal(cancelled,true)
 const normalized=await validateImage(exact)
 const maximumStored=jpegAtSize(normalized.bytes,MAX_NORMALIZED_IMAGE_BYTES)
 const photos=Array.from({length:10},(_,i)=>({id:'synthetic-'+i,bytes:maximumStored,caption:'Synthetic budget test',sha256:normalized.sha256}))
 const report={id:'synthetic',snapshot_version:1,template_snapshot:getTemplate('electrical'),business_snapshot:{name:'Synthetic',details:{}},document:{job:{address:'Synthetic',date:'2026-09-15'},answers:{}},evidence_snapshot:photos}
 const pdf=await renderExport({id:'synthetic-export',export_version:1,snapshot:{report,amendments:[]},cutoff_at:'2026-09-15'},photos)
 assert.equal(pdf.subarray(0,5).toString(),'%PDF-');assert.ok(pdf.length<32*1024*1024)
})
