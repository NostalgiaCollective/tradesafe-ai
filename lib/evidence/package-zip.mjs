import {open,mkdtemp,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {createHash} from 'node:crypto'
export const PACKAGE_LIMITS={days:31,events:200,files:100,bytes:64*1024*1024,fileBytes:16*1024*1024}
export function crc32(bytes){let crc=0xffffffff;for(const b of bytes){crc^=b;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0)}return (crc^0xffffffff)>>>0}
// Stored ZIP: sequential disk spool, one bounded file in memory, small central directory.
// Nothing is downloadable until every attachment and final access recheck succeeds.
export async function packageZip(){
 const dir=await mkdtemp(join(tmpdir(),'tradesafe-package-')),path=join(dir,'evidence.zip'),file=await open(path,'wx',0o600),entries=[];let offset=0,closed=false
 const cleanup=async()=>{if(!closed){await file.close();closed=true}await rm(dir,{recursive:true,force:true})}
 return {path,entries,cleanup,async add(name,bytes){
  if(!/^[a-zA-Z0-9/_-]+\.(json|html|jpg|pdf)$/.test(name)||name.includes('..')||entries.some(e=>e.name===name))throw new Error('Invalid archive path')
  bytes=Buffer.from(bytes);const n=Buffer.from(name),size=bytes.length
  if(entries.length>=PACKAGE_LIMITS.files||size>PACKAGE_LIMITS.fileBytes||offset+size+1024>PACKAGE_LIMITS.bytes)throw new Error('Package limit')
  const crc=crc32(bytes),h=Buffer.alloc(30);h.writeUInt32LE(0x04034b50);h.writeUInt16LE(20,4);h.writeUInt16LE(0x800,6);h.writeUInt32LE(crc,14);h.writeUInt32LE(size,18);h.writeUInt32LE(size,22);h.writeUInt16LE(n.length,26)
  await file.write(h);await file.write(n);await file.write(bytes);entries.push({name,bytes:size,sha256:createHash('sha256').update(bytes).digest('hex'),crc,offset});offset+=h.length+n.length+size
 },async finish(){const start=offset;for(const e of entries){const n=Buffer.from(e.name),h=Buffer.alloc(46);h.writeUInt32LE(0x02014b50);h.writeUInt16LE(20,4);h.writeUInt16LE(20,6);h.writeUInt16LE(0x800,8);h.writeUInt32LE(e.crc,16);h.writeUInt32LE(e.bytes,20);h.writeUInt32LE(e.bytes,24);h.writeUInt16LE(n.length,28);h.writeUInt32LE(e.offset,42);await file.write(h);await file.write(n);offset+=h.length+n.length}const end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(entries.length,8);end.writeUInt16LE(entries.length,10);end.writeUInt32LE(offset-start,12);end.writeUInt32LE(start,16);await file.write(end);await file.close();closed=true;return offset+22}}
}
