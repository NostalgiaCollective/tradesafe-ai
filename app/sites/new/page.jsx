import {notFound} from 'next/navigation'
import {workspace} from '@/lib/server/workspace'
import {briefsEnabled} from '@/lib/server/briefs'
import WorkspaceShell from '@/app/components/WorkspaceShell'
import CompanyChoice from '@/app/components/CompanyChoice'
import CreateCompany from '@/app/components/CreateCompany'
import SiteForm from '../SiteForm'
export default async function NewSite({searchParams}){
 if(!briefsEnabled())notFound();const p=await searchParams,w=await workspace('/sites/new',p.company)
 return <WorkspaceShell {...w}>{!p.company&&w.companies.length>1?<CompanyChoice companies={w.companies} destination="/sites/new"/>:w.company?<><h1>New site</h1><SiteForm companyId={w.company.id} actor={w.user.id}/></>:<CreateCompany actor={w.user.id}/>}</WorkspaceShell>
}
