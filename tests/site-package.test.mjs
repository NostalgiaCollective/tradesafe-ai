import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile,access} from 'node:fs/promises'
import {packageZip,crc32,PACKAGE_LIMITS} from '../lib/evidence/package-zip.mjs'
import {publicPackageData,packageIndex} from '../lib/domain/site-package.mjs'
test('bounded private ZIP preserves bytes/hashes and has readable central directory; failure cleanup',async()=>{
 const zip=await packageZip()
 try{assert.equal(crc32(Buffer.from('123456789')),0xcbf43926);const photo=Buffer.from([1,2,3,4,5]);await zip.add('photos/test.jpg',photo);await zip.add('manifest.json','{}');await assert.rejects(zip.add('../secret.json','{}'));await assert.rejects(zip.add('huge.pdf',Buffer.alloc(PACKAGE_LIMITS.fileBytes+1)),/limit/);await zip.finish();const bytes=await readFile(zip.path);assert.equal(bytes.readUInt32LE(),0x04034b50);assert.deepEqual(bytes.subarray(30+'photos/test.jpg'.length,30+'photos/test.jpg'.length+5),photo);assert.equal(bytes.readUInt32LE(bytes.length-22),0x06054b50);assert.equal(bytes.readUInt16LE(bytes.length-14),2)}finally{await zip.cleanup()}
 await assert.rejects(access(zip.path))
})
test('package manifest removes internal paths and request identifiers, HTML escapes user input',()=>{
 assert.deepEqual(publicPackageData({object_path:'private',last_request:'secret',notes:[{request_id:'secret',caption:'Kept'}]}),{notes:[{caption:'Kept'}]})
 const html=packageIndex({site:{id:'test',revision:1,document:{name:'<script>alert(1)</script>',address:'Synthetic'}},firstDay:'2026-10-01',lastDay:'2026-10-02',timezone:'America/Toronto',history:[],actions:[],concerns:[],photos:[],notes:[]},[],'now')
 assert.ok(!html.includes('<script>'));assert.ok(html.includes('not an atomic'));assert.ok(html.includes('Not a compliance'))
})
