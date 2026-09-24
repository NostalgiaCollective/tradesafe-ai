import {loadSite} from '@/lib/server/sites'
import { workspace,databaseError } from '@/lib/server/workspace'
import WorkspaceShell from '@/app/components/WorkspaceShell'
import CreateCompany from '@/app/components/CreateCompany'
import CompanyChoice from '@/app/components/CompanyChoice'
import {actionFilters,applyActionFilters} from '@/lib/domain/action-list'
import {actionCounts} from '@/lib/server/action-counts'
import {briefsEnabled} from '@/lib/server/briefs'
import ActionList from './ActionList'
export default async function ActionsPage({searchParams}) {
 const params=await searchParams;const w=await workspace('/actions?'+new URLSearchParams(Object.entries(params).filter(([,v])=>typeof v==='string')),params.company)
 if(!params.company&&w.companies.length>1)return <WorkspaceShell {...w} company={null}><CompanyChoice companies={w.companies} destination="/actions"/></WorkspaceShell>
 if(!w.company)return <WorkspaceShell {...w}><CreateCompany actor={w.user.id}/></WorkspaceShell>
 const filters=actionFilters(params),company=w.company.id
 const crewReturn=filters.from&&new URL(filters.from,'https://internal.invalid').searchParams.get('company')===company?filters.from:null
 const site=filters.site?await loadSite(w.supabase,filters.site,company):null
 const select='*,report:ts_reports(id,document,author_id,amendment_of)'+(briefsEnabled()?',brief:ts_briefs!ts_actions_brief_id_fkey(id,document),concern:ts_concerns(id,site_snapshot)':'')
 const [actions,members,counts]=await Promise.all([
  applyActionFilters(w.supabase.from(site?'ts_site_actions':'ts_actions').select(select).eq('company_id',company),filters,w.user.id).order('target_date',{nullsFirst:false}).order('id').range(filters.page*25,filters.page*25+24),
  w.supabase.from('ts_members').select('*').eq('company_id',company),
  actionCounts(w.supabase,company,w.user.id,filters.mine,filters.site),
 ])
 for(const r of [actions,members])if(r.error)throw databaseError(r.error)
 // A selected action may have moved after an update; keep it reachable without changing list counts.
 if(filters.focus&&!actions.data.some(a=>a.id===filters.focus)){
  let selectedQuery=w.supabase.from(site?'ts_site_actions':'ts_actions').select(select).eq('company_id',company).eq('id',filters.focus)
  if(site)selectedQuery=selectedQuery.eq('site_id',site.id)
  const selected=await selectedQuery.maybeSingle()
  if(selected.error)throw databaseError(selected.error)
  if(selected.data)actions.data.unshift(selected.data)
 }
 const ids=actions.data.map(a=>a.id)
 const [events,amendments]=ids.length?await Promise.all([
  w.supabase.from('ts_events').select('*').eq('company_id',company).in('entity_id',ids).in('kind',['action_opened','action_updated']).order('id',{ascending:false}).limit(500),
  w.supabase.from('ts_reports').select('id,amendment_of,amendment_reason,lifecycle,photos:ts_evidence(id,caption,state)').eq('company_id',company).in('amendment_of',[...new Set(actions.data.map(a=>a.report_id).filter(Boolean))]).order('created_at',{ascending:false}).limit(200),
 ]):[{data:[],error:null},{data:[],error:null}]
 for(const result of [events,amendments])if(result.error)throw databaseError(result.error)
 return <WorkspaceShell {...w}>{crewReturn&&<p><a href={crewReturn}>Back to My work</a></p>}{site&&<p><a href={'/sites/'+site.id}>Back to site: {site.document.name}</a></p>}<h1>Corrective actions</h1><p>Record progress, then request verification. Original findings and retained evidence stay unchanged.</p>{amendments.data.length===200&&<p role="status">Showing the 200 most recent amendments for these reports. Open the original report for its full amendment history.</p>}<ActionList key={company+w.user.id+w.membership.role+JSON.stringify(filters)} amendments={amendments.data} initial={actions.data} members={members.data} events={events.data} actor={w.user.id} role={w.membership.role} companyId={company} filters={filters} initialCounts={counts}/></WorkspaceShell>
}
