import 'server-only'
import type {SupabaseClient} from '@supabase/supabase-js'
import {databaseError} from './workspace'
// Exact counts over the authorized company set, independent of the displayed page.
export async function actionCounts(supabase:SupabaseClient,company:string,actor:string,mine:boolean){
 const rows=await Promise.all(['open','in_progress','awaiting_verification','closed'].map(state=>{
  let query=supabase.from('ts_actions').select('id',{count:'exact',head:true}).eq('company_id',company).eq('state',state)
  if(mine)query=query.eq('responsible_id',actor)
  return query
 }))
 for(const row of rows)if(row.error)throw databaseError(row.error)
 const attention=(rows[0].count||0)+(rows[1].count||0),awaiting_verification=rows[2].count||0,closed=rows[3].count||0
 return {attention,awaiting_verification,closed,outstanding:attention+awaiting_verification,all:attention+awaiting_verification+closed}
}
