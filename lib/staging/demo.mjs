// Server-only configuration/session primitives. Never import into a client component.
import {createCipheriv,createDecipheriv,randomBytes,scryptSync,timingSafeEqual} from 'node:crypto'
export const DEMO_COOKIE='ts_phone_demo'
export function demoConfig(env=process.env){
 try{
  const hosted=env.APP_ENV==='staging'&&env.HOSTED_STAGING==='1'&&env.NEXT_PUBLIC_SUPABASE_URL==='https://yqkiizimbtlygovkscoh.supabase.co'
  const local=env.APP_ENV==='local'&&env.TRADESAFE_STAGING_ARTIFACT==='1'&&env.NEXT_PUBLIC_SUPABASE_URL==='http://127.0.0.1:54321'
  if(!hosted&&!local)return null
  const c=JSON.parse(Buffer.from(env.PHONE_DEMO_CONFIG||'','base64').toString())
  if(c.enabled!==true||!['user','company','site'].every(k=>/^[a-f0-9-]{36}$/.test(c[k]))||!/^[a-f0-9]{64}$/.test(c.key)||!/^[a-f0-9]{64}$/.test(c.digest)||typeof c.salt!=='string'||!c.login||!c.email||!c.password)return null
  return c
 }catch{return null}
}
export function demoDigest(passphrase,salt){return scryptSync(passphrase,salt,32).toString('hex')}
export function demoCredentials(c,login,passphrase){
 return typeof login==='string'&&typeof passphrase==='string'&&passphrase.length<=160&&login.trim().toLowerCase()===c.login&&timingSafeEqual(Buffer.from(demoDigest(passphrase,c.salt),'hex'),Buffer.from(c.digest,'hex'))
}
export function sealDemo(c,token,expiresAt){
 const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',Buffer.from(c.key,'hex'),iv)
 const body=Buffer.concat([cipher.update(JSON.stringify({token,user:c.user,expiresAt:Math.min(expiresAt,Date.now()+3600000)})),cipher.final()])
 return Buffer.concat([iv,cipher.getAuthTag(),body]).toString('base64url')
}
export function openDemo(c,value){
 try{
  if(!c||typeof value!=='string'||value.length>6000)return null
  const bytes=Buffer.from(value,'base64url');if(bytes.toString('base64url')!==value)return null
  const cipher=createDecipheriv('aes-256-gcm',Buffer.from(c.key,'hex'),bytes.subarray(0,12));cipher.setAuthTag(bytes.subarray(12,28))
  const d=JSON.parse(Buffer.concat([cipher.update(bytes.subarray(28)),cipher.final()]).toString())
  return d.user===c.user&&typeof d.token==='string'&&d.expiresAt>Date.now()&&d.expiresAt<=Date.now()+3600000?d:null
 }catch{return null}
}
export function demoCookieValue(header=''){return header.split(';').map(v=>v.trim()).find(v=>v.startsWith(DEMO_COOKIE+'='))?.slice(DEMO_COOKIE.length+1)}
export function demoPublicPath(path,method){return ['GET','HEAD'].includes(method)&&(path==='/demo'||path.startsWith('/_next/static/')||path==='/favicon.ico')||path==='/api/demo'&&['POST','DELETE'].includes(method)}
export function demoPath(path,method){
 if(demoPublicPath(path,method))return true
 if(['GET','HEAD'].includes(method)&&/^\/(dashboard|sites|reports|report|actions|my-work|concerns|briefs|device-drafts|access-denied)(\/|$)/.test(path))return true
 return /^\/api\/(sites|reports|concerns|briefs)(\/|$)/.test(path)||path==='/api/workspace'||path==='/api/auth/session'||path==='/api/device-drafts'
}
const commands={ts_command:['create_report','save_report','finalize','amend','update_action'],ts_site_command:['create_brief','create_report','link_brief','link_report'],ts_electrical_command:['save'],ts_concern_command:['create','save','submit','note'],ts_concern_photo:['reserve','remove'],ts_evidence_command:['reserve','remove'],ts_brief_command:['create','save','record','revise']}
export function demoRpcAllowed(name,args,c){
 // Read-only domain queries still execute with ordinary RLS; no service role is used here.
 if(['ts_site_package_admit','ts_site_evidence_snapshot','ts_site_handover','ts_search_site_history'].includes(name))return true
 if(name==='ts_invitation_context')return false
 return Boolean(commands[name]?.includes(args?.command))&&(!args.p?.companyId||args.p.companyId===c.company)
}
// Single-instance staging admission. Fixed global buckets resist spoofed IPs and bound memory.
export function demoLimiter(){let minute=0,count=0,inflight=0;return ()=>{const now=Math.floor(Date.now()/60000);if(now!==minute){minute=now;count=0}if(++count>20||inflight>=2)return null;inflight++;let released=false;return()=>{if(!released){released=true;inflight--}}}}
export async function demoBody(request){
 const reader=request.body?.getReader();if(!reader||!request.headers.get('content-type')?.startsWith('application/json'))throw Error('invalid')
 let timer,size=0;const chunks=[]
 try{return await Promise.race([(async()=>{for(;;){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>1024)throw Error('size');chunks.push(value)}const value=JSON.parse(Buffer.concat(chunks).toString());if(!value||Array.isArray(value)||typeof value!=='object')throw Error('invalid');return value})(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('timeout')),5000)})])}
 finally{clearTimeout(timer);void reader.cancel().catch(()=>{})}
}
