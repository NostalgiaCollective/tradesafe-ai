import 'server-only'
import {loadSite} from './sites'
import {databaseError} from './workspace'
import {validHandoverDate} from '../domain/handover.mjs'
import {AppError} from '../domain/errors'
export async function siteHistory(supabase,id,p){
 await loadSite(supabase,id)
 if(!validHandoverDate(p.get('start'))||!validHandoverDate(p.get('end')))throw new AppError('invalid_request')
 const args={site:id,first_day:p.get('start'),last_day:p.get('end'),kind_filter:p.get('kind')||'all',query_text:p.get('q')||''}
 if(p.has('cutoff'))args.cutoff=p.get('cutoff')
 if(p.has('before')){args.before_at=p.get('before');args.before_key=p.get('key')||''}
 const r=await supabase.rpc('ts_search_site_history',args)
 if(r.error)throw databaseError(r.error)
 const rows=r.data.rows,more=rows.length>30
 return {...r.data,rows:rows.slice(0,30),more}
}
