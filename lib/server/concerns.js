import 'server-only'
import {authenticatedClient} from './auth'
import {requireBriefs} from './briefs'
import {databaseError} from './workspace'
import {assertExpectedActor} from '../domain/actor'
import {AppError} from '../domain/errors'
import {UUID} from '../domain/validation'
export async function concernAccess(id,edit=false,request){
 requireBriefs();if(!UUID.test(id||''))throw new AppError('not_found')
 const {supabase,user}=await authenticatedClient();assertExpectedActor(user.id,request?.headers.get('x-expected-actor')??null)
 const r=await supabase.from('ts_concerns').select('*').eq('id',id).maybeSingle()
 if(r.error)throw databaseError(r.error);if(!r.data)throw new AppError('not_found')
 if(edit&&(r.data.author_id!==user.id||r.data.lifecycle!=='draft'))throw new AppError('denied')
 return {supabase,user,concern:r.data}
}
export async function concernPhoto(access,id){
 if(!UUID.test(id||''))throw new AppError('not_found')
 const r=await access.supabase.from('ts_concern_photos').select('*').eq('concern_id',access.concern.id).eq('id',id).maybeSingle()
 if(r.error)throw databaseError(r.error);if(!r.data)throw new AppError('not_found');return r.data
}
