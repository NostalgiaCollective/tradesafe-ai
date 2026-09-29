import {authenticatedClient} from '@/lib/server/auth'
import {loadHandover} from '@/lib/server/handover'
import {handoverExport} from '@/lib/domain/handover.mjs'
import {errorResponse} from '@/lib/domain/errors'
import {assertExpectedActor} from '@/lib/domain/actor'
export async function GET(request,{params}){
 try{
  const {supabase,user}=await authenticatedClient();assertExpectedActor(user.id,request.headers.get('x-expected-actor'))
  const {id}=await params,url=new URL(request.url),s=await loadHandover(supabase,id,url.searchParams.get('date'),url.searchParams.get('timezone'))
  if(url.searchParams.get('download')==='1')return new Response(handoverExport(s,url.origin),{headers:{'Content-Type':'text/html; charset=utf-8','Content-Disposition':`attachment; filename="site-handover-${id}-${s.date}.html"`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; sandbox"}})
  return Response.json(s,{headers:{'Cache-Control':'private, no-store'}})
 }catch(e){return errorResponse(e)}
}
