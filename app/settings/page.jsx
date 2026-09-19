import { workspace,databaseError } from '@/lib/server/workspace'
import WorkspaceShell from '@/app/components/WorkspaceShell'
import CreateCompany from '@/app/components/CreateCompany'
import CompanyChoice from '@/app/components/CompanyChoice'
import CompanySettings from './CompanySettings'
export default async function SettingsPage({searchParams}) {
 const p=await searchParams;const w=await workspace('/settings',p.company)
 if(!p.company&&w.companies.length>1)return <WorkspaceShell {...w} company={null}><CompanyChoice companies={w.companies} destination="/settings"/></WorkspaceShell>
 if(!w.company)return <WorkspaceShell {...w}><CreateCompany actor={w.user.id}/></WorkspaceShell>
 const [members,invitations]=await Promise.all([w.supabase.from('ts_members').select('*').eq('company_id',w.company.id).order('joined_at'),w.supabase.from('ts_invitations').select('id,email,role,expires_at,accepted_by,revoked').eq('company_id',w.company.id).order('created_at',{ascending:false}).limit(50)])
 for(const r of [members,invitations])if(r.error)throw databaseError(r.error)
 return <WorkspaceShell {...w}><CompanySettings company={w.company} members={members.data} invitations={invitations.data} role={w.membership.role} actor={w.user.id}/></WorkspaceShell>
}
