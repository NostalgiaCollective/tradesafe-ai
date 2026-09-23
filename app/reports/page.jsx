import {loadSite} from '@/lib/server/sites'
import Link from 'next/link'
import {workspace,databaseError} from '@/lib/server/workspace'
import WorkspaceShell from '@/app/components/WorkspaceShell'
import CreateCompany from '@/app/components/CreateCompany'
import CompanyChoice from '@/app/components/CompanyChoice'
import ListSearch from '@/app/components/ListSearch'
import ReportRows from '@/app/components/ReportRows'
import {reportFilters,reportListUrl,applyReportFilters} from '@/lib/domain/report-list'
export default async function ReportsPage({searchParams}){
 const params=await searchParams,w=await workspace('/reports?'+new URLSearchParams(Object.entries(params).filter(([,v])=>typeof v==='string')),params.company)
 if(!params.company&&w.companies.length>1)return <WorkspaceShell {...w} company={null}><CompanyChoice companies={w.companies} destination="/reports"/></WorkspaceShell>
 if(!w.company)return <WorkspaceShell {...w}><CreateCompany actor={w.user.id}/></WorkspaceShell>
 const filters=reportFilters(params),url=page=>reportListUrl(w.company.id,{...filters,page}),returnTo=url(filters.page)
 const site=filters.site?await loadSite(w.supabase,filters.site,w.company.id):null
 const [reports,legacy]=await Promise.all([applyReportFilters(w.supabase.from('ts_reports').select('id,document,template_snapshot,lifecycle,amendment_of,updated_at,actions:ts_actions(id,state)'+(filters.site?',site_link:ts_site_links!inner(site_id)':''),{count:'exact'}).eq('company_id',w.company.id),filters).range(filters.page*25,filters.page*25+24),w.supabase.from('ts_legacy_reports').select('report_id').eq('company_id',w.company.id).limit(100)])
 for(const r of [reports,legacy])if(r.error)throw databaseError(r.error)
 return <WorkspaceShell {...w}>{site&&<p><Link href={'/sites/'+site.id}>Back to site: {site.document.name}</Link></p>}<div className="work-title"><div><p className="eyebrow">Company records</p><h1>Report library</h1></div>{!site?.archived&&<Link className="button primary" href={'/report/new?company='+w.company.id+(site?'&site='+site.id:'')}>Start new report</Link>}</div><ListSearch key={returnTo} company={w.company.id} {...filters}/><p role="status">{reports.count} matching {reports.count===1?'report':'reports'}.</p>{reports.data.length?<ReportRows reports={reports.data} returnTo={returnTo}/>:<section className="empty-work"><h2>No matching reports</h2><p>Try another customer or address, or clear the filters. Your records have not been removed.</p><Link href={'/reports?company='+w.company.id+(site?'&site='+site.id:'')}>Show all reports</Link></section>}<nav aria-label="Report pages" className="work-buttons">{filters.page>0&&<Link className="button" href={url(filters.page-1)}>Previous</Link>}<span>Page {filters.page+1}</span>{(filters.page+1)*25<reports.count&&<Link className="button" href={url(filters.page+1)}>Next</Link>}</nav>{!site&&!!legacy.data.length&&<details><summary>Historical records ({legacy.data.length}{legacy.data.length===100?'+':''})</summary><p>Legacy observations have unknown default-pass provenance. Their payment history does not establish safety completion.</p><ul>{legacy.data.map(r=><li key={r.report_id}><Link href={'/report/'+r.report_id+'?'+new URLSearchParams({from:returnTo})}>Legacy record {r.report_id.slice(0,8)}</Link></li>)}</ul></details>}</WorkspaceShell>
}
