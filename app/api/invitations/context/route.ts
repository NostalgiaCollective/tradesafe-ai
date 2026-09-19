import {authenticatedClient} from '@/lib/server/auth'
import {appOrigin} from '@/lib/server/config'
import {databaseError} from '@/lib/server/workspace'
import {readObject} from '@/lib/domain/validation'
import {AppError,errorResponse} from '@/lib/domain/errors'

export async function POST(request:Request){
 try{
  const {supabase,user}=await authenticatedClient()
  if(request.headers.get('origin')!==new URL(appOrigin()).origin)throw new AppError('denied')
  if(!request.headers.get('content-type')?.startsWith('application/json'))throw new AppError('invalid_request')
  const {token}=await readObject(request)
  if(typeof token!=='string'||!/^[a-f0-9]{64}$/.test(token))throw new AppError('invalid_request')
  const {data,error}=await supabase.rpc('ts_invitation_context',{token})
  if(error)throw databaseError(error)
  return Response.json({...data,signedInAs:user.email},{headers:{'Cache-Control':'private, no-store'}})
 }catch(error){return errorResponse(error)}
}
