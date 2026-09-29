import 'server-only'
import {requireBriefs} from './briefs'
import {databaseError} from './workspace'
import {AppError} from '../domain/errors'
import {UUID} from '../domain/validation'
import {HANDOVER_ZONES,validHandoverDate} from '../domain/handover.mjs'
export async function loadHandover(supabase,id,day,zone){
 requireBriefs()
 if(!UUID.test(id||''))throw new AppError('not_found')
 if(!validHandoverDate(day)||!HANDOVER_ZONES.includes(zone))throw new AppError('invalid_request')
 const r=await supabase.rpc('ts_site_handover',{site:id,day,zone})
 if(r.error){if(r.error.message==='TS_summary_limit')throw new AppError('summary_limit');throw databaseError(r.error)}
 if(!r.data)throw new AppError('query_failed')
 return r.data
}
