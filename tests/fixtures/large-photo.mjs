import sharp from 'sharp'

// Deterministic synthetic pixels: no customer photograph or retained metadata.
export async function largePhoto(){
 let seed=1234567
 const bytes=Buffer.alloc(2600*1800*3)
 for(let i=0;i<bytes.length;i++){seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;bytes[i]=seed&255}
 return sharp(bytes,{raw:{width:2600,height:1800,channels:3}}).jpeg({quality:90}).withExif({IFD0:{Artist:'Synthetic boundary fixture'}}).toBuffer()
}

// Valid JPEG COM segments exercise exact byte limits without relying on invalid
// trailing bytes. Each segment has a bounded 16-bit length and no private data.
export function jpegAtSize(jpeg,size){
 let remaining=size-jpeg.length
 if(remaining<4)throw Error('Fixture needs space for a JPEG comment')
 const chunks=[jpeg.subarray(0,2)]
 while(remaining){let length=Math.min(remaining,65537);if(remaining-length>0&&remaining-length<4)length-=4
  const chunk=Buffer.alloc(length);chunk[0]=255;chunk[1]=254;chunk.writeUInt16BE(length-2,2);chunks.push(chunk);remaining-=length}
 chunks.push(jpeg.subarray(2));return Buffer.concat(chunks)
}
