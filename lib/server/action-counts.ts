import {filterPlanning,planningFilters} from '../domain/action-planning'
import type {PlanningQuery} from '../domain/action-planning'
import 'server-only'
import type {SupabaseClient} from '@supabase/supabase-js'
import {databaseError} from './workspace'
// Exact counts over the authorized company set, independent of the displayed page.
export async function actionCounts(supabase:SupabaseClient,company:string,actor:string,mine:boolean,site?:string,planning=planningFilters({})){
 const rows=await Promise.all(['open','in_progress','awaiting_verification','closed'].map(state=>{
  let query=supabase.from(site?'ts_site_actions':'ts_actions').select('id',{count:'exact',head:true}).eq('company_id',company).eq('state',state)
  if(site)query=query.eq('site_id',site)
  if(mine)query=query.eq('responsible_id',actor)
  return filterPlanning(query as unknown as PlanningQuery,planning) as unknown as typeof query
 }))
 for(const row of rows)if(row.error)throw databaseError(row.error)
 const attention=(rows[0].count||0)+(rows[1].count||0),awaiting_verification=rows[2].count||0,closed=rows[3].count||0
 return {attention,awaiting_verification,closed,outstanding:attention+awaiting_verification,all:attention+awaiting_verification+closed}
}
export async function deadlineCounts(supabase:SupabaseClient,company:string,site:string){
 const rows=await Promise.all(['overdue','today','unscheduled'].map(deadline=>{
  const q=supabase.from('ts_site_actions').select('id',{count:'exact',head:true}).eq('company_id',company).eq('site_id',site)
  return filterPlanning(q as unknown as PlanningQuery,planningFilters({deadline})) as unknown as typeof q
 }))
 for(const row of rows)if(row.error)throw databaseError(row.error)
 return {overdue:rows[0].count||0,today:rows[1].count||0,unscheduled:rows[2].count||0}
}
