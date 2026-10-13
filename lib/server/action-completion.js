import 'server-only'
import {authenticatedClient} from './auth'
import {databaseError} from './workspace'
import {assertExpectedActor} from '../domain/actor'
import {AppError} from '../domain/errors'
import {UUID} from '../domain/validation'
import {COMPLETION_PAGE_SIZE} from '../domain/action-completion.mjs'
export async function actionAccess(id,edit=false,request){
 if(!UUID.test(id||''))throw new AppError('not_found')
 const {supabase,user}=await authenticatedClient();assertExpectedActor(user.id,request?.headers.get('x-expected-actor')??null)
 const result=await supabase.from('ts_actions').select('*').eq('id',id).maybeSingle()
 if(result.error)throw databaseError(result.error);if(!result.data)throw new AppError('not_found')
 const action=result.data,member=await supabase.from('ts_members').select('role').eq('company_id',action.company_id).eq('user_id',user.id).eq('active',true).maybeSingle()
 if(member.error)throw databaseError(member.error)
 if(!member.data||member.data.role==='worker'&&action.responsible_id!==user.id)throw new AppError('denied')
 if(edit&&action.state==='closed')throw new AppError('immutable')
 return {supabase,user,action}
}
export async function actionPhoto(access,id){
 if(!UUID.test(id||''))throw new AppError('not_found')
 const result=await access.supabase.from('ts_action_photos').select('*').eq('action_id',access.action.id).eq('id',id).maybeSingle()
 if(result.error)throw databaseError(result.error);if(!result.data)throw new AppError('not_found');return result.data
}
export async function completionHistory(access,page=0){
 const result=await access.supabase.from('ts_action_updates').select('*').eq('action_id',access.action.id).order('recorded_at',{ascending:false}).order('id',{ascending:false}).range(page*COMPLETION_PAGE_SIZE,(page+1)*COMPLETION_PAGE_SIZE)
 if(result.error)throw databaseError(result.error)
 return {updates:result.data.slice(0,COMPLETION_PAGE_SIZE),hasMore:result.data.length>COMPLETION_PAGE_SIZE,page}
}
