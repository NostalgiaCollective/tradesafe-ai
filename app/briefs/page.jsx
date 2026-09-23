import {loadSite} from '@/lib/server/sites'
import Link from 'next/link'
import {notFound} from 'next/navigation'
import {workspace,databaseError} from '@/lib/server/workspace'
import {briefsEnabled} from '@/lib/server/briefs'
import WorkspaceShell from '@/app/components/WorkspaceShell'
import CompanyChoice from '@/app/components/CompanyChoice'
import CreateCompany from '@/app/components/CreateCompany'
import CreateBrief from './CreateBrief'
export default async function BriefsPage({searchParams}){
 if(!briefsEnabled())notFound()
 const p=await searchParams,w=await workspace('/briefs?'+new URLSearchParams(Object.entries(p).filter(([,v])=>typeof v==='string')),p.company)
 if(!p.company&&w.companies.length>1)return <WorkspaceShell {...w} company={null}><CompanyChoice companies={w.companies} destination="/briefs"/></WorkspaceShell>
 if(!w.company)return <WorkspaceShell {...w}><CreateCompany actor={w.user.id}/></WorkspaceShell>
 const site=p.site?await loadSite(w.supabase,p.site,w.company.id):null,page=Math.max(0,Math.min(10000,parseInt(p.page)||0))
 let query=w.supabase.from('ts_briefs').select('*'+(site?',site_link:ts_site_links!inner(site_id)':''),{count:'exact'}).eq('company_id',w.company.id)
 if(site)query=query.eq('site_link.site_id',site.id)
 const r=await query.order('updated_at',{ascending:false}).order('id').range(page*25,page*25+24)
 const url=n=>'/briefs?'+new URLSearchParams({company:w.company.id,...(site?{site:site.id}:{}),page:String(n)})
 if(r.error)throw databaseError(r.error)
 return <WorkspaceShell {...w}>{site&&<p><Link href={'/sites/'+site.id}>Back to site: {site.document.name}</Link></p>}<p className="eyebrow">Staging · content pending qualified review</p><h1>Daily site briefs</h1><p>Site → Today’s work → Hazards and controls → Crew briefing → Outstanding actions.</p><p>Trade installation reports are separate records, not a complete workplace safety assessment.</p>{!site&&<CreateBrief companyId={w.company.id} actor={w.user.id} briefs={r.data}/>}<h2>Recent briefs</h2>{r.data.length?<ul className="work-list">{r.data.map(b=><li key={b.id}><Link href={'/briefs/'+b.id}><strong>{b.document.site||'Untitled site'}</strong><span>{b.document.date||'Work date not set'} · {b.lifecycle==='draft'?'Resume draft':'Recorded briefing'} · revision {b.revision}</span></Link></li>)}</ul>:<p>No daily briefs yet. Start one for today’s work.</p>}<nav aria-label="Brief pages">{page>0&&<Link href={url(page-1)}>Previous briefs</Link>}{(page+1)*25<r.count&&<Link href={url(page+1)}>Next briefs</Link>}</nav></WorkspaceShell>
}
