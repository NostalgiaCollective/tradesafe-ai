import { workspace,databaseError } from '@/lib/server/workspace'
import WorkspaceShell from '@/app/components/WorkspaceShell'
import CreateCompany from '@/app/components/CreateCompany'
import ActionList from './ActionList'
export default async function ActionsPage({searchParams}) {
 const params=await searchParams;const w=await workspace('/actions',params.company)
 if(!w.company)return <WorkspaceShell><CreateCompany /></WorkspaceShell>
 const [actions,members,events]=await Promise.all([
  w.supabase.from('ts_actions').select('*').eq('company_id',w.company.id).order('target_date',{nullsFirst:false}).limit(200),
  w.supabase.from('ts_members').select('*').eq('company_id',w.company.id),
  w.supabase.from('ts_events').select('*').eq('company_id',w.company.id).in('kind',['action_opened','action_updated']).order('id',{ascending:false}).limit(500),
 ])
 for(const r of [actions,members,events])if(r.error)throw databaseError(r.error)
 return <WorkspaceShell {...w}><h1>Corrective actions</h1><p>Follow up without changing the original observations. Showing up to 200 actions; history shows the latest 500 company action events.</p><ActionList initial={actions.data} members={members.data} events={events.data} actor={w.user.id} role={w.membership.role} companyId={w.company.id} /></WorkspaceShell>
}
