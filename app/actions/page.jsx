import { workspace,databaseError } from '@/lib/server/workspace'
import WorkspaceShell from '@/app/components/WorkspaceShell'
import CreateCompany from '@/app/components/CreateCompany'
import CompanyChoice from '@/app/components/CompanyChoice'
import ActionList from './ActionList'
export default async function ActionsPage({searchParams}) {
 const params=await searchParams;const w=await workspace('/actions?'+new URLSearchParams(Object.entries(params).filter(([,v])=>typeof v==='string')),params.company)
 if(!params.company&&w.companies.length>1)return <WorkspaceShell {...w} company={null}><CompanyChoice companies={w.companies} destination="/actions"/></WorkspaceShell>
 if(!w.company)return <WorkspaceShell {...w}><CreateCompany actor={w.user.id}/></WorkspaceShell>
 const [actions,members,events]=await Promise.all([
  w.supabase.from('ts_actions').select('*,report:ts_reports(id,document,author_id,amendment_of)',{count:'exact'}).eq('company_id',w.company.id).order('target_date',{nullsFirst:false}).order('id').limit(200),
  w.supabase.from('ts_members').select('*').eq('company_id',w.company.id),
  w.supabase.from('ts_events').select('*').eq('company_id',w.company.id).in('kind',['action_opened','action_updated']).order('id',{ascending:false}).limit(500),
 ])
 for(const r of [actions,members,events])if(r.error)throw databaseError(r.error)
 const amendments=actions.data.length?await w.supabase.from('ts_reports').select('id,amendment_of,amendment_reason,lifecycle,photos:ts_evidence(id,caption,state)').eq('company_id',w.company.id).in('amendment_of',[...new Set(actions.data.map(a=>a.report_id))]).order('created_at',{ascending:false}).limit(200):{data:[],error:null}
 if(amendments.error)throw databaseError(amendments.error)
 return <WorkspaceShell {...w}><h1>Corrective actions</h1><p>Follow up here. Updates do not change the finalized report or its PDF.</p>{actions.count>200&&<p role="status">Showing the first 200 of {actions.count} company actions by due date. Filters apply to this loaded set.</p>}{amendments.data.length===200&&<p role="status">Showing the 200 most recent report amendments. Open the original report for its full amendment history.</p>}<ActionList amendments={amendments.data} initial={actions.data} members={members.data} events={events.data} actor={w.user.id} role={w.membership.role} companyId={w.company.id} initialMine={params.mine!=='0'} initialClosed={params.closed==='1'}/></WorkspaceShell>
}
