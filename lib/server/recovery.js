import 'server-only'
import { cookies } from 'next/headers'
import { randomBytes, randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { storageServer, privateHeaders } from './evidence'
import { appOrigin } from './config'
import { allowedRecoveryRequest, boundedJson, fingerprint, fixedRecoveryUrl, normalizeEmail, seal, unseal, validPassword } from '../recovery/security.mjs'
import { changeRecoveredPassword, dispatchRecovery } from '../recovery/flow.mjs'

const COOKIE='__Host-ts-recovery'
const messages={
 recovery_expired:'This recovery link or session is invalid, expired, or already used. Request a new email.',
 recovery_busy:'A password update is still being checked. Wait 90 seconds, then retry with the same password.',
 recovery_conflict:'A different password update was already started. Retry with the same password or request a new link.',
 recovery_uncertain:'The password may have changed, but completion could not be confirmed. Wait 90 seconds and retry the same password. You can also try signing in.',
 recovery_unavailable:'Recovery is temporarily unavailable. Wait and try again. No delivery or password-change confirmation is available.',
 recovery_configuration:'Password recovery email delivery is not configured yet. Try again after setup is complete.',
 password_rejected:'The provider rejected this password. Use a different password that meets the requirements.',
 invalid_request:'Check the form and try again.',
 denied:'This recovery request is not allowed.',
}
function response(data,status=200){return Response.json(data,{status,headers:privateHeaders})}
function errorResponse(error){
 const code=Object.hasOwn(messages,error?.message)?error.message:'recovery_unavailable'
 const status=code==='denied'?403:code==='invalid_request'||code==='password_rejected'?400:code==='recovery_expired'?401:code==='recovery_busy'||code==='recovery_conflict'?409:503
 return response({code,error:messages[code]},status)
}
function secret(){const key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!key||key.length<32)throw Error('recovery_configuration');return key}
function provider(){return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false,flowType:'implicit'},global:{fetch:(url,options)=>fetch(url,{...options,signal:AbortSignal.timeout(15000)})}})}
async function save(command,p){
 const r=await storageServer().rpc('ts_recovery_grant',{command,p})
 if(r.error){const known=Object.keys(messages).find(code=>r.error.message===code);throw Error(known||'recovery_unavailable')}
 return r.data
}
async function identity(create=false){
 const jar=await cookies();let nonce=jar.get(COOKIE)?.value
 if(!/^[a-f0-9]{64}$/.test(nonce||'')){
  if(!create)throw Error('recovery_expired')
  nonce=randomBytes(32).toString('hex')
  jar.set(COOKIE,nonce,{httpOnly:true,secure:true,sameSite:'strict',path:'/',maxAge:900})
 }
 return fingerprint(secret(),'grant',nonce)
}
async function limit(kind,subject){
 const result=await storageServer().rpc('ts_recovery_limit',{kind,subject})
 if(result.error)throw Error('recovery_unavailable')
 return result.data===true
}
export async function recoveryStatus(request){
 try{
  if(new URL(request.url).search)throw Error('invalid_request')
  fixedRecoveryUrl(appOrigin());const id=await identity(true)
  let g
  try{g=await save('get',{id})}catch(e){if(e.message!=='recovery_expired')throw e}
  const email=g&&g.state!=='complete'?unseal(secret(),g.encrypted_session).email:undefined
  return response({state:g?.state||'unverified',email,minimumPasswordLength:6})
 }catch(e){return errorResponse(e)}
}
export async function recoveryAction(request,action){
 try{
  const origin=appOrigin();fixedRecoveryUrl(origin)
  if(!allowedRecoveryRequest(request,origin))throw Error('denied')
  const body=await boundedJson(request)
  // Only exact form fields are accepted. Redirects, flags and caller-selected user IDs are never consumed.
  const allowed=action==='start'?[]:action==='request'?['email']:action==='verify'?['tokenHash']:['password']
  if(Object.keys(body).some(k=>!allowed.includes(k)))throw Error('invalid_request')
  if(action==='start'){
   const jar=await cookies();jar.delete(COOKIE);await identity(true)
   return response({state:'unverified'})
  }
  if(action==='request'){
   const email=normalizeEmail(body.email);if(!email)throw Error('invalid_request')
   if(process.env.RECOVERY_EMAIL_ENABLED!=='yes')throw Error('recovery_configuration')
   const accepted=await limit('request',fingerprint(secret(),'email',email))
   const allowlist=(process.env.RECOVERY_ALLOWED_EMAILS||'').split(',').map(normalizeEmail).filter(Boolean)
   // Staging fails closed on recipient dispatch; no arbitrary or customer email sends.
   const permitted=process.env.APP_ENV!=='staging'||allowlist.includes(email)
   // Account-specific throttles, suppression, provider failures and unknown users are indistinguishable.
   return response(await dispatchRecovery({accepted,permitted,
    send:()=>provider().auth.resetPasswordForEmail(email,{redirectTo:fixedRecoveryUrl(origin)}),
    onUnconfirmed:()=>console.error(JSON.stringify({event:'recovery_dispatch',outcome:'provider_unconfirmed'}))
   }),202)
  }
  const id=await identity()
  if(action==='verify'){
   if(typeof body.tokenHash!=='string'||!/^[a-f0-9]{40,128}$/i.test(body.tokenHash))throw Error('recovery_expired')
   if(!await limit('verify',id))throw Error('recovery_unavailable')
   // Re-verification never changes the identity of an already-authorized recovery browser.
   try{await save('get',{id});throw Error('recovery_conflict')}catch(e){if(e.message!=='recovery_expired')throw e}
   const auth=provider()
   const verified=await auth.auth.verifyOtp({token_hash:body.tokenHash,type:'recovery'})
   if(verified.error?.status>=500||verified.error?.status===429)throw Error('recovery_unavailable')
   if(verified.error||!verified.data.session||!verified.data.user)throw Error('recovery_expired')
   const checked=await auth.auth.getUser()
   if(checked.error||checked.data.user?.id!==verified.data.user.id)throw Error('recovery_expired')
   await save('create',{id,userId:checked.data.user.id,session:seal(secret(),{
    access_token:verified.data.session.access_token,refresh_token:verified.data.session.refresh_token,email:checked.data.user.email
   })})
   return response({state:'verified'})
  }
  if(!validPassword(body.password))throw Error('password_rejected')
  await changeRecoveredPassword({grant:{id},password:body.password,attempt:randomUUID(),
   digest:fingerprint(secret(),'password:'+id,body.password),provider,save,openSession:value=>unseal(secret(),value)})
  return response({state:'complete',message:'Password changed. Sign in with your new password. Previous sessions can remain usable until their access tokens expire; their refresh access has been revoked.'})
 }catch(e){return errorResponse(e)}
}
