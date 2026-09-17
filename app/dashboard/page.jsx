import Link from 'next/link'
import { workspace,databaseError } from '@/lib/server/workspace'
import WorkspaceShell from '@/app/components/WorkspaceShell'
import CreateCompany from '@/app/components/CreateCompany'
export default async function DashboardPage({searchParams}) {
 const params=await searchParams;const w=await workspace('/dashboard',params.company)
 if(!w.company)return <WorkspaceShell {...w}><CreateCompany /></WorkspaceShell>
 const page=Math.max(0,Math.min(10000,Number.parseInt(params.page||'0',10)||0))
 const status=['draft','finalized'].includes(params.status)?params.status:null
 let query=w.supabase.from('ts_reports').select('*',{count:'exact'}).eq('company_id',w.company.id).order('updated_at',{ascending:false}).order('id').range(page*25,page*25+24)
 if(status)query=query.eq('lifecycle',status)
 const [reports,actions,legacy,resume]=await Promise.all([query,w.supabase.from('ts_actions').select('id',{count:'exact',head:true}).eq('company_id',w.company.id).eq('responsible_id',w.user.id).neq('state','closed'),w.supabase.from('ts_legacy_reports').select('report_id').eq('company_id',w.company.id).limit(100),w.supabase.from('ts_reports').select('id,document,updated_at').eq('company_id',w.company.id).eq('author_id',w.user.id).eq('lifecycle','draft').order('updated_at',{ascending:false}).order('id').limit(1).maybeSingle()])
 for(const r of [reports,actions,legacy,resume])if(r.error)throw databaseError(r.error)
 const resumeReport=page===0&&status!=='finalized'?resume.data:null
 const url=(n)=>'/dashboard?'+new URLSearchParams({company:w.company.id,page:String(n),...(status?{status}:{})})
 return <WorkspaceShell {...w}><div className="work-title"><div><p className="eyebrow">Company records</p><h1>Reports</h1></div><Link className={resumeReport?'button':'primary button'} href={'/report/new?company='+w.company.id}>New report</Link></div>
 {resumeReport&&<section className="work-panel"><h2>Continue your draft</h2><p>{resumeReport.document.job.address||'Untitled job'} · Last saved {new Date(resumeReport.updated_at).toLocaleString('en-CA')}</p><Link className="primary button" href={'/report/'+resumeReport.id}>Resume latest draft</Link></section>}
 <p><Link href={'/actions?company='+w.company.id}>{actions.count} unresolved actions assigned to you</Link></p>
 <form className="work-filters"><input type="hidden" name="company" value={w.company.id}/><label htmlFor="status">Report state</label><select name="status" id="status" defaultValue={status||''}><option value="">All reports</option><option value="draft">Drafts to resume</option><option value="finalized">Finalized observations</option></select><button>Show reports</button><Link href={'/dashboard?company='+w.company.id}>Reset</Link></form>
 {!reports.data.length?<section className="work-panel"><h2>{status?'No matching reports':'Record your first observations'}</h2><p>Create a report for a job, answer each check, and return to the saved draft whenever you need.</p></section>:<ul className="work-list">{reports.data.map(r=><li key={r.id}><Link href={'/report/'+r.id}><strong>{r.document.job.address||'Untitled job'}</strong><span>{r.template_snapshot.trade} | {r.lifecycle==='draft'?'Draft - resume':'Finalized observations'}{r.amendment_of?' / Amendment':''}</span><small>Last saved {new Date(r.updated_at).toLocaleString('en-CA')}</small></Link></li>)}</ul>}
 <nav aria-label="Report pages" className="work-buttons">{page>0&&<Link href={url(page-1)}>Previous</Link>}<span>{reports.count} reports | Page {page+1}</span>{(page+1)*25<reports.count&&<Link href={url(page+1)}>Next</Link>}</nav>
 {!!legacy.data.length&&<details className="work-panel"><summary>Historical reports ({legacy.data.length}{legacy.data.length===100?'+':''})</summary><p>Legacy observations have unknown default-pass provenance. Their payment history does not establish safety completion.</p><ul>{legacy.data.map(r=><li key={r.report_id}><Link href={'/report/'+r.report_id}>Legacy report {r.report_id.slice(0,8)}</Link></li>)}</ul></details>}
 </WorkspaceShell>
}
