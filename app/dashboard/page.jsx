import Link from 'next/link'
import { workspace,databaseError } from '@/lib/server/workspace'
import WorkspaceShell from '@/app/components/WorkspaceShell'
import CreateCompany from '@/app/components/CreateCompany'
import CompanyChoice from '@/app/components/CompanyChoice'
import PendingInvitations from '@/app/components/PendingInvitations'
import ListSearch from '@/app/components/ListSearch'
import {reportFilters,reportListUrl,searchPattern} from '@/lib/domain/report-list'
export default async function DashboardPage({searchParams}) {
 const params=await searchParams;const w=await workspace('/dashboard?'+new URLSearchParams(Object.entries(params).filter(([,v])=>typeof v==='string')),params.company)
 const invites=await w.supabase.rpc('ts_invitation_context')
 if(invites.error)throw databaseError(invites.error)
 const pending=<PendingInvitations invitations={invites.data}/>
 if(!params.company&&w.companies.length>1)return <WorkspaceShell {...w} company={null}>{pending}<CompanyChoice companies={w.companies}/></WorkspaceShell>
 if(!w.company)return <WorkspaceShell {...w}>{pending}<CreateCompany actor={w.user.id}/></WorkspaceShell>
 const filters=reportFilters(params),{page,status,q}=filters
 let query=w.supabase.from('ts_reports').select('*',{count:'exact'}).eq('company_id',w.company.id).order('updated_at',{ascending:false}).order('id').range(page*25,page*25+24)
 if(status)query=query.eq('lifecycle',status)
 if(q)query=query.ilike('document->job->>address',searchPattern(q))
 const [reports,actions,legacy,resume]=await Promise.all([query,w.supabase.from('ts_actions').select('id',{count:'exact',head:true}).eq('company_id',w.company.id).eq('responsible_id',w.user.id).neq('state','closed'),w.supabase.from('ts_legacy_reports').select('report_id').eq('company_id',w.company.id).limit(100),w.supabase.from('ts_reports').select('id,document,updated_at').eq('company_id',w.company.id).eq('author_id',w.user.id).eq('lifecycle','draft').order('updated_at',{ascending:false}).order('id').limit(1).maybeSingle()])
 for(const r of [reports,actions,legacy,resume])if(r.error)throw databaseError(r.error)
 const resumeReport=page===0&&status!=='finalized'?resume.data:null
 const url=n=>reportListUrl(w.company.id,{...filters,page:n}),returnTo=url(page),reportUrl=id=>'/report/'+id+'?'+new URLSearchParams({from:returnTo})
 return <WorkspaceShell {...w}>{pending}<div className="work-title"><div><p className="eyebrow">Company records</p><h1>Reports</h1></div><Link className={resumeReport?'button':'primary button'} href={'/report/new?company='+w.company.id}>New report</Link></div>
 {resumeReport&&<section className="work-panel"><h2>Continue your draft</h2><p>{resumeReport.document.job.address||'Untitled job'} · Last saved {new Date(resumeReport.updated_at).toLocaleString('en-CA')}</p><Link className="primary button" href={reportUrl(resumeReport.id)}>Resume latest draft</Link></section>}
 <p><Link href={'/actions?company='+w.company.id}>Assigned to me: {actions.count} open follow-ups</Link></p>
 <ListSearch key={returnTo} company={w.company.id} q={q} status={status}/><p role="status">{reports.count} matching {reports.count===1?'report':'reports'}{q?' for “'+q+'”':''}.</p>
 {!reports.data.length?<section className="work-panel"><h2>{status||q||page?'No matching reports':'Record your first observations'}</h2><p>{status||q||page?'Try another job address or clear the filters. Existing reports have not been removed.':'Start a report for your job. After Saved appears, you can leave and resume it here.'}</p><Link href={status||q||page?'/dashboard?company='+w.company.id:'/report/new?company='+w.company.id}>{status||q||page?'Show all reports':'Create your first report'}</Link></section>:<ul className="work-list">{reports.data.map(r=><li key={r.id}><Link href={reportUrl(r.id)}><strong>{r.document.job.address||'Untitled job'}</strong><span>{r.template_snapshot.trade} | {r.lifecycle==='draft'?'Draft — resume':'Finalized — view / PDF'}{r.amendment_of?' / Amendment':''}</span><small>Last saved {new Date(r.updated_at).toLocaleString('en-CA')}</small></Link></li>)}</ul>}
 <nav aria-label="Report pages" className="work-buttons">{page>0&&<Link href={url(page-1)}>Previous</Link>}<span>{reports.count} reports | Page {page+1}</span>{(page+1)*25<reports.count&&<Link href={url(page+1)}>Next</Link>}</nav>
 {!!legacy.data.length&&<details className="work-panel"><summary>Historical reports ({legacy.data.length}{legacy.data.length===100?'+':''})</summary><p>Legacy observations have unknown default-pass provenance. Their payment history does not establish safety completion.</p><ul>{legacy.data.map(r=><li key={r.report_id}><Link href={reportUrl(r.report_id)}>Legacy report {r.report_id.slice(0,8)}</Link></li>)}</ul></details>}
 </WorkspaceShell>
}
