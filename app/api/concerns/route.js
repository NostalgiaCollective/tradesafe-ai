import {authenticatedClient} from '@/lib/server/auth'
import {requireBriefs} from '@/lib/server/briefs'
import {databaseError} from '@/lib/server/workspace'
import {assertExpectedActor} from '@/lib/domain/actor'
import {appOrigin} from '@/lib/server/config'
import {AppError,errorResponse} from '@/lib/domain/errors'
export async function POST(request){
 try{
  requireBriefs();const {supabase,user}=await authenticatedClient()
  assertExpectedActor(user.id,request.headers.get('x-expected-actor'))
  if(request.headers.get('origin')!==new URL(appOrigin()).origin)throw new AppError('denied')
  if(!request.headers.get('content-type')?.startsWith('application/json'))throw new AppError('invalid_request')
  const reader=request.body?.getReader();if(!reader)throw new AppError('invalid_request')
  let size=0;const chunks=[]
  try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>16000){await reader.cancel();throw new AppError('invalid_request')}chunks.push(value)}}finally{reader.releaseLock()}
  let body;try{body=JSON.parse(Buffer.concat(chunks).toString('utf8'))}catch{throw new AppError('invalid_request')}
  if(!['create','save','submit','note'].includes(body?.command)||!body.payload||typeof body.payload!=='object')throw new AppError('invalid_request')
  const {data,error}=await supabase.rpc('ts_concern_command',{command:body.command,p:body.payload})
  if(error)throw databaseError(error)
  return Response.json(data,{headers:{'Cache-Control':'no-store'}})
 }catch(e){return errorResponse(e)}
}
