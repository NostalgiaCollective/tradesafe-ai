import { workspace,databaseError } from '@/lib/server/workspace'
import WorkspaceShell from '@/app/components/WorkspaceShell'
import CreateCompany from '@/app/components/CreateCompany'
import ActionList from './ActionList'
export default async function ActionsPage({searchParams}) {
 const params=await searchParams;const w=await workspace('/actions',params.company)
 if(!w.company)return <WorkspaceShell {...w}><CreateCompany /></WorkspaceShell>
 const [actions,members,events]=await Promise.all([
  w.supabase.from('ts_actions').select('*,report:ts_reports(id,document,amendment_of)',{count:'exact'}).eq('company_id',w.company.id).order('target_date',{nullsFirst:false}).order('id').limit(200),
  w.supabase.from('ts_members').select('*').eq('company_id',w.company.id),
  w.supabase.from('ts_events').select('*').eq('company_id',w.company.id).in('kind',['action_opened','action_updated']).order('id',{ascending:false}).limit(500),
 ])
 for(const r of [actions,members,events])if(r.error)throw databaseError(r.error)
 return <WorkspaceShell {...w}><h1>Corrective actions</h1><p>Follow up here. Updates do not change the finalized report or its PDF.</p>{actions.count>200&&<p role="status">Showing the first 200 of {actions.count} company actions by due date. Filters apply to this loaded set.</p>}<ActionList initial={actions.data} members={members.data} events={events.data} actor={w.user.id} role={w.membership.role} companyId={w.company.id} initialMine={params.mine!=='0'} initialClosed={params.closed==='1'}/></WorkspaceShell>
}
