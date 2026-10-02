import {authenticatedClient} from '@/lib/server/auth'
import {siteHistory} from '@/lib/server/site-history'
import {assertExpectedActor} from '@/lib/domain/actor'
import {errorResponse} from '@/lib/domain/errors'
export async function GET(request,{params}){try{
 const {supabase,user}=await authenticatedClient();assertExpectedActor(user.id,request.headers.get('x-expected-actor'))
 return Response.json(await siteHistory(supabase,(await params).id,new URL(request.url).searchParams),{headers:{'Cache-Control':'private, no-store'}})
}catch(e){return errorResponse(e)}}
