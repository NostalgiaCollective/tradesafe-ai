import { workspace } from '@/lib/server/workspace'
import WorkspaceShell from '@/app/components/WorkspaceShell'
import CreateCompany from '@/app/components/CreateCompany'
import StartReport from './StartReport'
export default async function NewReportPage({searchParams}) { const p=await searchParams;const w=await workspace('/report/new',p.company);return <WorkspaceShell {...w}>{w.company?<StartReport company={w.company}/>:<CreateCompany/>}</WorkspaceShell> }
