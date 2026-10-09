import {authenticatedClient} from '@/lib/server/auth'
import {requireBriefs} from '@/lib/server/briefs'
import {databaseError} from '@/lib/server/workspace'
import {electricalVersion,electricalCurrent,electricalSecondary,electricalWorkData} from '@/lib/server/electrical-job'
import {loadSite} from '@/lib/server/sites'
import {electricalExport} from '@/lib/domain/electrical-job.mjs'
import {assertExpectedActor} from '@/lib/domain/actor'
import {appOrigin} from '@/lib/server/config'
import {AppError,errorResponse} from '@/lib/domain/errors'
export async function POST(request,{params}){
 try{
  requireBriefs();const {supabase,user}=await authenticatedClient(),{id}=await params
  assertExpectedActor(user.id,request.headers.get('x-expected-actor'))
  if(request.headers.get('origin')!==new URL(appOrigin()).origin)throw new AppError('denied')
  if(!request.headers.get('content-type')?.startsWith('application/json'))throw new AppError('invalid_request')
  const reader=request.body?.getReader();if(!reader)throw new AppError('invalid_request')
  let size=0;const chunks=[]
  try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>30000){await reader.cancel();throw new AppError('invalid_request')}chunks.push(value)}}finally{reader.releaseLock()}
  let body;try{body=JSON.parse(Buffer.concat(chunks).toString('utf8'))}catch{throw new AppError('invalid_request')}
  if(!body?.payload||body.payload.siteId!==id)throw new AppError('invalid_request')
  const {data,error}=await supabase.rpc('ts_electrical_command',{command:body.command,p:body.payload})
  if(error)throw databaseError(error)
  return Response.json(data,{headers:{'Cache-Control':'no-store'}})
 }catch(e){return errorResponse(e)}
}
export async function GET(request,{params}){
 try{
  requireBriefs();const {supabase,user}=await authenticatedClient(),{id}=await params
  const view=new URL(request.url).searchParams.get('view')
  if(view){
   assertExpectedActor(user.id,request.headers.get('x-expected-actor'))
   const site=await loadSite(supabase,id)
   if(view==='current')return Response.json({job:await electricalCurrent(supabase,site)},{headers:{'Cache-Control':'no-store'}})
   if(view==='secondary')return Response.json(await electricalSecondary(supabase,site),{headers:{'Cache-Control':'no-store'}})
   if(view==='work'){
    const member=await supabase.from('ts_members').select('role').eq('company_id',site.company_id).eq('user_id',user.id).eq('active',true).single()
    if(member.error)throw databaseError(member.error)
    return Response.json(await electricalWorkData(supabase,site,user.id,member.data.role),{headers:{'Cache-Control':'no-store'}})
   }
   throw new AppError('invalid_request')
  }
  const v=await electricalVersion(supabase,id,new URL(request.url).searchParams.get('revision'))
  return new Response(electricalExport(v),{headers:{'Content-Type':'text/html; charset=utf-8','Content-Disposition':`attachment; filename="electrical-job-r${v.revision}.html"`,'Cache-Control':'no-store','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; sandbox"}})
 }catch(e){return errorResponse(e)}
}
