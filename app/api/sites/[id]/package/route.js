import {authenticatedClient} from '@/lib/server/auth'
import {sitePackage} from '@/lib/server/site-package'
import {mutation} from '@/lib/server/evidence'
import {assertExpectedActor} from '@/lib/domain/actor'
import {errorResponse} from '@/lib/domain/errors'
export const runtime='nodejs'
export async function POST(request,{params}){try{
 mutation(request);const {supabase,user}=await authenticatedClient();assertExpectedActor(user.id,request.headers.get('x-expected-actor'))
 return await sitePackage(supabase,(await params).id,new URL(request.url).searchParams,request.signal)
}catch(e){return errorResponse(e)}}
