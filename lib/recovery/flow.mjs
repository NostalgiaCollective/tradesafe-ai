import { GENERIC_CONFIRMATION } from './security.mjs'

// Provider operations are injectable so ambiguous remote outcomes can be tested.
export async function dispatchRecovery({accepted,permitted,send,onUnconfirmed=()=>{}}){
 if(accepted&&permitted){try{const result=await send();if(result.error)onUnconfirmed()}catch{onUnconfirmed()}}
 return {message:GENERIC_CONFIRMATION}
}
export async function changeRecoveredPassword({grant,password,attempt,digest,provider,save,openSession}){
 const job=await save('begin',{id:grant.id,attempt,digest})
 if(job.state==='complete')return
 const session=openSession(job.encrypted_session)
 const client=provider()
 let established=false
 // An earlier request may have committed the password remotely before its response was lost.
 // Prove that exact requested password for the provider-verified account before finalizing a retry.
 if(job.resumed){
  const signed=await client.auth.signInWithPassword({email:session.email,password})
  if(!signed.error&&signed.data.user?.id===job.user_id)established=true
  else if(signed.error?.code!=='invalid_credentials')throw Error('recovery_unavailable')
 }
 if(!established){
  const loaded=await client.auth.setSession(session)
  if(loaded.error||loaded.data.user?.id!==job.user_id)throw Error('recovery_expired')
  const updated=await client.auth.updateUser({password})
  if(updated.error){
   if(['weak_password','same_password','validation_failed'].includes(updated.error.code)&&!job.resumed){
    await save('reject',{id:grant.id,attempt});throw Error('password_rejected')
   }
   throw Error('recovery_uncertain')
  }
  if(updated.data.user?.id!==job.user_id)throw Error('recovery_uncertain')
 }
 await save('changed',{id:grant.id,attempt})
 const signedOut=await client.auth.signOut({scope:'global'})
 if(signedOut.error)throw Error('recovery_uncertain')
 await save('complete',{id:grant.id,attempt})
}
