import {reportAccess,privateHeaders} from '@/lib/server/evidence'
import {assertExpectedActor} from '@/lib/domain/actor'
import {UUID} from '@/lib/domain/validation'
import {AppError,errorResponse} from '@/lib/domain/errors'
// Small authoritative receipt used to reconcile an ambiguous mutation; ordinary RLS still applies.
export async function GET(request,{params}){try{
 const {id}=await params;if(!UUID.test(id))throw new AppError('invalid_request')
 const access=await reportAccess(id)
 assertExpectedActor(access.user.id,request.headers.get('x-expected-actor'))
 const {report:r}=access
 return Response.json({id:r.id,lifecycle:r.lifecycle,revision:r.revision},{headers:privateHeaders})
}catch(e){return errorResponse(e)}}
