import 'server-only'
import {databaseError} from './workspace'
export async function firstWorkday(w){
 const c=w.company.id,u=w.user.id,worker=w.membership.role==='worker'
 const q=(table)=>w.supabase.from(table).select('*',{count:'exact',head:true}).eq('company_id',c)
 const results=await Promise.all([
  q('ts_sites').eq('archived',false),q('ts_briefs').eq('author_id',u),
  q('ts_brief_versions').eq('recorded_by',u).neq('snapshot->document->crew','[]'),
  q('ts_brief_participation').eq('user_id',u).eq('latest_recorded',true).eq('member_active',true),
  q('ts_brief_participation').eq('user_id',u).eq('latest_recorded',true).eq('member_active',true).not('acknowledged_at','is',null),
  q('ts_concerns').eq('author_id',u).eq('lifecycle','submitted'),
  q('ts_action_ownership').eq('responsible_id',u).neq('state','closed'),
  w.supabase.from('ts_pilot_preferences').select('dismissed').eq('company_id',c).eq('user_id',u).maybeSingle(),
 ])
 for(const r of results)if(r.error)throw databaseError(r.error)
 const n=results.map(r=>r.count||0),url=p=>p+'?company='+c
 return {dismissed:results[7].data?.dismissed||false,worker,steps:worker?[
  {label:'Find your site',href:url('/sites'),detail:n[0]?'Choose the site where you are working. Site visibility is company access, not an assignment.':'No active sites yet. Ask your supervisor which site to use.',done:false},
  {label:'Read and acknowledge a briefing',href:url('/my-work'),detail:n[3]?`${n[4]} of ${n[3]} current included versions acknowledged by you. A revised version needs a new response.`:'No recorded briefing includes you yet. Ask the responsible supervisor to include your account.',done:n[3]>0&&n[3]===n[4]},
  {label:'Report a concern',href:url('/sites'),detail:n[5]?`${n[5]} concerns submitted by you.`:'Open your site, then Report a concern. Do not invent a concern to complete this guide.',done:n[5]>0},
  {label:'Update assigned work',href:url('/my-work'),detail:n[6]?`${n[6]} outstanding actions assigned to you. Open the action to record progress or request verification.`:'Nothing outstanding is assigned to you. Assignment does not grant supervisor permissions.',done:false},
 ]:[
  {label:'Create or select a site',href:url('/sites'),detail:n[0]?`${n[0]} active sites available.`:'Create your first site to keep daily work together.',done:n[0]>0},
  {label:'Prepare a daily brief',href:url('/briefs'),detail:n[1]?`${n[1]} briefs created by you. Open a site to resume or start today’s brief.`:'Open a site and start today’s brief.',done:n[1]>0},
  {label:'Include crew and record a briefing',href:url('/briefs'),detail:n[2]?`${n[2]} versions recorded by you. Check Crew responses for included participants and their exact-version acknowledgements.`:'In Crew briefing, select active participants, then record the version. Attendance is not a worker acknowledgement.',done:n[2]>0},
  {label:'Review follow-up and handover',href:url('/sites'),detail:'Open your site for outstanding Actions and Daily handover. Viewing a page does not complete work.',done:false},
 ]}
}
