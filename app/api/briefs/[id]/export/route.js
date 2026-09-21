import {authenticatedClient} from '@/lib/server/auth'
import {briefData} from '@/lib/server/briefs'
import {briefExport} from '@/lib/domain/brief-export.mjs'
import {AppError,errorResponse} from '@/lib/domain/errors'
export async function GET(request,{params}){
 try{
  const {supabase}=await authenticatedClient(),{id}=await params
  const data=await briefData(supabase,id,new URL(request.url).searchParams.get('version'))
  if(!data.version)throw new AppError('not_found')
  return new Response(briefExport(data,new Date().toISOString()),{headers:{'Content-Type':'text/html; charset=utf-8','Content-Disposition':`attachment; filename="daily-brief-${id}-v${data.version.version}.html"`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; sandbox"}})
 }catch(e){return errorResponse(e)}
}
