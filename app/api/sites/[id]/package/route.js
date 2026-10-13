import {authenticatedClient} from '@/lib/server/auth'
import {sitePackage,packagePreparation,retainedSitePackage,packageStatus} from '@/lib/server/site-package'
import {mutation,privateHeaders} from '@/lib/server/evidence'
import {assertExpectedActor} from '@/lib/domain/actor'
import {errorResponse} from '@/lib/domain/errors'
export const runtime='nodejs'
export async function POST(request,{params}){try{
 mutation(request);const {supabase,user}=await authenticatedClient();assertExpectedActor(user.id,request.headers.get('x-expected-actor'))
 return await sitePackage(supabase,(await params).id,new URL(request.url).searchParams,request.signal,user.id)
}catch(e){return errorResponse(e)}}
export async function GET(request,{params}){try{
 const {supabase,user}=await authenticatedClient(),id=(await params).id,p=new URL(request.url).searchParams
 assertExpectedActor(user.id,request.headers.get('x-expected-actor'))
 if(p.has('generation')&&p.get('status')==='1')return Response.json(await packageStatus(supabase,id,p.get('generation'),user.id),{headers:privateHeaders})
 if(p.has('generation'))return await retainedSitePackage(supabase,id,p.get('generation'),request.signal)
 return Response.json(await packagePreparation(supabase,id,p,user.id),{headers:privateHeaders})
}catch(e){return errorResponse(e)}}
