import {ERROR_MESSAGES} from '../domain/errors.ts'
export class RequestError extends Error {
 constructor(message,code){super(message);this.name='RequestError';this.code=code}
}
export async function request(url,options={},kind='json'){
 const {timeoutMs=30000,...init}=options,controller=new AbortController()
 const timer=setTimeout(()=>controller.abort(),timeoutMs)
 try{
  const response=await fetch(url,{...init,cache:'no-store',signal:controller.signal})
  if(response.status===401){
   const gate=response.headers.get('www-authenticate')?.includes('Basic')
   throw new RequestError(gate?'Staging access has expired. Reopen staging access in another tab, then retry here.':'Your session has expired. Sign in in another tab, then retry here. Keep this page open to preserve your input.',gate?'gate':'unauthorized')
  }
  let data
  if(!response.ok||kind==='json'){
   try{data=await response.json()}catch{throw new RequestError('The service returned an unreadable response. No save was confirmed. Keep this page open and retry.','unavailable')}
  }
  if(!response.ok){
   const code=Object.hasOwn(ERROR_MESSAGES,data?.code)?data.code:'unavailable'
   throw new RequestError(ERROR_MESSAGES[code],code)
  }
  return kind==='blob'?await response.blob():data
 }catch(error){
  if(error instanceof RequestError)throw error
  throw new RequestError(controller.signal.aborted?'The request took too long. No completion was confirmed. Keep this page open and retry the same operation.':'No completion was confirmed. Check your connection and retry. Keep this page open to preserve your input.',controller.signal.aborted?'timeout':'network')
 }finally{clearTimeout(timer)}
}
