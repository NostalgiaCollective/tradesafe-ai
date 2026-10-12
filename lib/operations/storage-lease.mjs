import {randomUUID} from 'node:crypto'

// The database owns eligibility and authority. This helper owns the heartbeat's
// lifetime, including stopping it and releasing the token after cancellation.
export async function storageLease(call,scope,signal,{heartbeatMs=30000}={}){
 const token=randomUUID(),controller=new AbortController()
 const args={...scope,token}
 await call('begin',args)
 let renewing=null,closed=false
 const combined=signal?AbortSignal.any([signal,controller.signal]):controller.signal
 const timer=setInterval(()=>{
  if(closed||renewing)return
  renewing=call('renew',args).catch(error=>controller.abort(error)).finally(()=>{renewing=null})
 },heartbeatMs)
 timer.unref?.()
 return {
  token,signal:combined,
  check(){combined.throwIfAborted()},
  async close(){
   if(closed)return
   closed=true;clearInterval(timer)
   await renewing
   await call('end',args)
  }
 }
}
