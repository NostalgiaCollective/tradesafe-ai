import 'server-only'
import {requireBriefs} from './briefs'
import {databaseError} from './workspace'
import {AppError} from '../domain/errors'
import {UUID} from '../domain/validation'
export async function loadSite(supabase,id,company){
 requireBriefs();if(!UUID.test(id||''))throw new AppError('not_found')
 let q=supabase.from('ts_sites').select('*').eq('id',id);if(company)q=q.eq('company_id',company)
 const r=await q.maybeSingle();if(r.error)throw databaseError(r.error);if(!r.data)throw new AppError('not_found');return r.data
}
export async function siteLink(supabase,id,kind){
 const r=await supabase.from('ts_site_links').select('*,site:ts_sites(*)').eq(kind==='report'?'report_id':'brief_id',id).maybeSingle()
 if(r.error)throw databaseError(r.error);return r.data
}
