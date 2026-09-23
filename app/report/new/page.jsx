import {loadSite} from '@/lib/server/sites'
import { workspace } from '@/lib/server/workspace'
import WorkspaceShell from '@/app/components/WorkspaceShell'
import CreateCompany from '@/app/components/CreateCompany'
import CompanyChoice from '@/app/components/CompanyChoice'
import StartReport from './StartReport'
export default async function NewReportPage({searchParams}) { const p=await searchParams;const w=await workspace('/report/new'+(p.site?'?'+new URLSearchParams({company:p.company||'',site:p.site}):''),p.company);const site=p.site&&w.company?await loadSite(w.supabase,p.site,w.company.id):null;return <WorkspaceShell {...w}>{!p.company&&w.companies.length>1?<CompanyChoice companies={w.companies} destination="/report/new"/>:w.company?site?.archived?<p>This site is archived. Restore it before starting a new report.</p>:<StartReport company={w.company} actor={w.user.id} site={site}/>:<CreateCompany actor={w.user.id}/>}</WorkspaceShell> }
