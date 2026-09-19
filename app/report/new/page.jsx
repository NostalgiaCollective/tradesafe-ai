import { workspace } from '@/lib/server/workspace'
import WorkspaceShell from '@/app/components/WorkspaceShell'
import CreateCompany from '@/app/components/CreateCompany'
import CompanyChoice from '@/app/components/CompanyChoice'
import StartReport from './StartReport'
export default async function NewReportPage({searchParams}) { const p=await searchParams;const w=await workspace('/report/new',p.company);return <WorkspaceShell {...w}>{!p.company&&w.companies.length>1?<CompanyChoice companies={w.companies} destination="/report/new"/>:w.company?<StartReport company={w.company} actor={w.user.id}/>:<CreateCompany actor={w.user.id}/>}</WorkspaceShell> }
