import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from 'node:crypto'

export const RECOVERY_PATH='/auth/recovery'
export const GENERIC_CONFIRMATION='If recovery is available for that address, an email may arrive shortly. Requests are limited; wait before trying again. Delivery is not guaranteed.'
export function normalizeEmail(value){
 if(typeof value!=='string'||value.length>254)return null
 const email=value.trim().toLowerCase()
 return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)?email:null
}
export function allowedRecoveryRequest(request,origin){
 const url=new URL(request.url)
 return url.origin===origin && request.headers.get('origin')===origin && !url.search && request.headers.get('content-type')?.split(';')[0]==='application/json'
}
export function fixedRecoveryUrl(origin){
 const url=new URL(origin)
 if(url.protocol!=='https:'||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw Error('recovery_configuration')
 return url.origin+RECOVERY_PATH
}
export function validPassword(password,minimum=6){
 return typeof password==='string'&&[...password].length>=minimum&&Buffer.byteLength(password,'utf8')<=72&&!password.includes('\0')
}
export function fingerprint(secret,domain,value){return createHmac('sha256',secret).update(domain+'\0'+value).digest('hex')}
function key(secret){if(!secret||secret.length<32)throw Error('recovery_configuration');return createHash('sha256').update('tradesafe-recovery-v1\0'+secret).digest()}
export function seal(secret,value){
 const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key(secret),iv)
 const data=Buffer.concat([cipher.update(JSON.stringify(value),'utf8'),cipher.final()])
 return Buffer.concat([iv,cipher.getAuthTag(),data]).toString('base64url')
}
export function unseal(secret,value){
 const data=Buffer.from(value,'base64url'),cipher=createDecipheriv('aes-256-gcm',key(secret),data.subarray(0,12))
 cipher.setAuthTag(data.subarray(12,28));return JSON.parse(Buffer.concat([cipher.update(data.subarray(28)),cipher.final()]).toString('utf8'))
}
export async function boundedJson(request){
 if(!request.body)throw Error('invalid_request')
 const reader=request.body.getReader();let size=0;const chunks=[]
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>4096){await reader.cancel();throw Error('invalid_request')}chunks.push(value)}}finally{reader.releaseLock()}
 const value=JSON.parse(Buffer.concat(chunks).toString('utf8'))
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('invalid_request')
 return value
}
