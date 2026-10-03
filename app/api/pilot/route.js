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
  const reader=request.body?.getReader();if(!reader)throw new AppError('invalid_request');let size=0;const chunks=[]
  try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>16000){await reader.cancel();throw new AppError('invalid_request')}chunks.push(value)}}finally{reader.releaseLock()}
  let body;try{body=JSON.parse(Buffer.concat(chunks).toString('utf8'))}catch{throw new AppError('invalid_request')}
  if(!['submit','status','guidance'].includes(body?.command)||!body.payload||typeof body.payload!=='object')throw new AppError('invalid_request')
  const allowed=body.command==='submit'?['companyId','id','requestId','kind','task','description','expectation','route']:body.command==='status'?['companyId','id','requestId','revision','status']:['companyId','requestId','dismissed']
  const p=Object.fromEntries(allowed.filter(k=>Object.hasOwn(body.payload,k)).map(k=>[k,body.payload[k]]))
  if(body.command==='submit'){
   // Accept only an allowlisted pathname. Never retain query strings, tokens or client-supplied version claims.
   const path=typeof p.route==='string'?p.route.split(/[?#]/)[0]:''
   p.route=/^\/(dashboard|sites|my-work|briefs|concerns|actions|reports|report|settings|device-drafts|help)(\/[a-zA-Z0-9_-]+)?$/.test(path)?path:'/help'
   p.appVersion=process.env.RENDER_GIT_COMMIT||process.env.STAGING_COMMIT||'local-development'
  }
  const {data,error}=await supabase.rpc('ts_pilot_command',{command:body.command,p})
  if(error)throw databaseError(error)
  return Response.json(data,{headers:{'Cache-Control':'no-store'}})
 }catch(e){return errorResponse(e)}
}
