import {AppError} from './errors.ts'
import {UUID} from './validation.ts'
export const COMPLETION_PAGE_SIZE=20
export function completionPayload(value){
 if(!value||typeof value!=='object'||Array.isArray(value)||!UUID.test(value.id||'')||!Number.isSafeInteger(value.revision)||value.revision<1||typeof value.notes!=='string'||!value.notes.trim()||value.notes.length>4000||!['in_progress','awaiting_verification'].includes(value.state)||!Array.isArray(value.evidenceIds)||value.evidenceIds.length>10||value.evidenceIds.some(id=>!UUID.test(id))||new Set(value.evidenceIds).size!==value.evidenceIds.length)throw new AppError('invalid_request')
 return {id:value.id,revision:value.revision,notes:value.notes.trim(),state:value.state,evidenceIds:value.evidenceIds}
}
export async function readCompletionBody(request){
 if(!request.headers.get('content-type')?.startsWith('application/json'))throw new AppError('invalid_request')
 const reader=request.body?.getReader();if(!reader)throw new AppError('invalid_request')
 const chunks=[];let length=0,timer
 try{return await Promise.race([(async()=>{for(;;){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>20000)throw new AppError('invalid_request');chunks.push(value)}try{return completionPayload(JSON.parse(Buffer.concat(chunks).toString()))}catch(e){if(e instanceof AppError)throw e;throw new AppError('invalid_request')}})(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new AppError('request_timeout')),5000)})])}finally{clearTimeout(timer);void reader.cancel().catch(()=>{})}
}
export function completionUploadHeaders(headers){
 let caption;try{caption=decodeURIComponent(headers.get('x-evidence-caption')||'').trim()}catch{throw new AppError('invalid_request')}
 const id=headers.get('x-evidence-id'),updateId=headers.get('x-update-id'),revision=Number(headers.get('x-action-revision'))
 if(!UUID.test(id||'')||!UUID.test(updateId||'')||!Number.isSafeInteger(revision)||revision<1||!caption||caption.length>1000)throw new AppError('invalid_request')
 return {id,updateId,revision,caption}
}
