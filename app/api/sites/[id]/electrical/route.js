import {authenticatedClient} from '@/lib/server/auth'
import {requireBriefs} from '@/lib/server/briefs'
import {databaseError} from '@/lib/server/workspace'
import {electricalVersion,electricalCurrent,electricalSecondary,electricalWorkData} from '@/lib/server/electrical-job'
import {loadSite} from '@/lib/server/sites'
import {electricalExport} from '@/lib/domain/electrical-job.mjs'
import {readElectricalBody} from '@/lib/domain/electrical-body.mjs'
import {assertExpectedActor} from '@/lib/domain/actor'
import {UUID} from '@/lib/domain/validation'
import {appOrigin} from '@/lib/server/config'
import {AppError,errorResponse} from '@/lib/domain/errors'
export async function POST(request,{params}){
 try{
  requireBriefs();const {supabase,user}=await authenticatedClient(),{id}=await params
  assertExpectedActor(user.id,request.headers.get('x-expected-actor'))
  if(request.headers.get('origin')!==new URL(appOrigin()).origin)throw new AppError('denied')
  const body=await readElectricalBody(request)
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
   if(view==='current'){
    const requestId=new URL(request.url).searchParams.get('requestId')
    let receipt=null
    if(requestId){
     if(!UUID.test(requestId))throw new AppError('invalid_request')
     const result=await supabase.rpc('ts_electrical_receipt',{site:id,request_id:requestId})
     if(result.error)throw databaseError(result.error)
     receipt=result.data
    }
    return Response.json({job:await electricalCurrent(supabase,site),receipt},{headers:{'Cache-Control':'no-store'}})
   }
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
