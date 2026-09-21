import 'server-only'
import {AppError} from '../domain/errors'
import {UUID} from '../domain/validation'
import {databaseError} from './workspace'
export function briefsEnabled(){return process.env.HOSTED_STAGING==='1'||process.env.TRADESAFE_STAGING_ARTIFACT==='1'}
export function requireBriefs(){if(!briefsEnabled())throw new AppError('not_found')}
export async function briefData(supabase,id,version){
 requireBriefs();if(!UUID.test(id))throw new AppError('not_found')
 const b=await supabase.from('ts_briefs').select('*').eq('id',id).maybeSingle()
 if(b.error)throw databaseError(b.error);if(!b.data)throw new AppError('not_found')
 if(version!=null&&(!/^\d{1,9}$/.test(String(version))||Number(version)<1))throw new AppError('not_found')
 const contentResult=await supabase.from('ts_brief_content_catalog').select('*').order('created_at',{ascending:false}).limit(20)
 if(contentResult.error)throw databaseError(contentResult.error)
 const pinned=b.data.document.contentVersion
 if(pinned&&!contentResult.data.some(c=>c.version===pinned)){const r=await supabase.from('ts_brief_content_catalog').select('*').eq('version',pinned).maybeSingle();if(r.error)throw databaseError(r.error);if(r.data)contentResult.data.push(r.data)}
 const chosen=Number(version)||b.data.revision
 const results=await Promise.all([
  supabase.from('ts_members').select('*').eq('company_id',b.data.company_id),
  supabase.from('ts_brief_versions').select('version,recorded_at').eq('brief_id',id).order('version',{ascending:false}).limit(50),
  supabase.from('ts_brief_versions').select('*').eq('brief_id',id).eq('version',chosen).maybeSingle(),
  supabase.from('ts_brief_acknowledgements').select('*').eq('brief_id',id).eq('version',chosen),
  supabase.from('ts_brief_reviews').select('*').eq('brief_id',id).eq('version',chosen),
  supabase.from('ts_actions').select('*').eq('brief_id',id).order('id').limit(400),
 ])
 for(const r of results)if(r.error)throw databaseError(r.error)
 return {contentCatalog:contentResult.data,brief:b.data,members:results[0].data,versions:results[1].data,version:results[2].data,acknowledgements:results[3].data,reviews:results[4].data,actions:results[5].data}
}
