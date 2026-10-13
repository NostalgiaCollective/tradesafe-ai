import {AppError} from './errors.ts'
export const ELECTRICAL_BODY_BYTES=30000
export const ELECTRICAL_BODY_TIMEOUT_MS=5000

// Bound actual streamed bytes and the entire read, not a caller-supplied length.
export async function readElectricalBody(request,timeoutMs=ELECTRICAL_BODY_TIMEOUT_MS){
 if(!request.headers.get('content-type')?.startsWith('application/json')||!request.body)throw new AppError('invalid_request')
 const reader=request.body.getReader(),chunks=[];let size=0,timer,finished=false
 const cancel=()=>{void reader.cancel().catch(()=>{})}
 const deadline=new Promise((_,reject)=>{timer=setTimeout(()=>{reject(new AppError('request_timeout'));cancel()},timeoutMs)})
 try{
  for(;;){
   const {done,value}=await Promise.race([reader.read(),deadline])
   if(done){finished=true;break}
   size+=value.byteLength
   if(size>ELECTRICAL_BODY_BYTES)throw new AppError('invalid_request')
   chunks.push(value)
  }
  try{return JSON.parse(Buffer.concat(chunks).toString('utf8'))}catch{throw new AppError('invalid_request')}
 }catch(error){if(error instanceof AppError)throw error;throw new AppError('invalid_request')}
 finally{clearTimeout(timer);if(!finished)cancel();reader.releaseLock()}
}
