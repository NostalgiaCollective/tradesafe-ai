import Link from 'next/link'
import {notFound} from 'next/navigation'
import {workspace,databaseError} from '@/lib/server/workspace'
import {briefsEnabled} from '@/lib/server/briefs'
import WorkspaceShell from '@/app/components/WorkspaceShell'
import CompanyChoice from '@/app/components/CompanyChoice'
import CreateCompany from '@/app/components/CreateCompany'
export default async function SitesPage({searchParams}){
 if(!briefsEnabled())notFound()
 const p=await searchParams,w=await workspace('/sites?'+new URLSearchParams(Object.entries(p).filter(([,v])=>typeof v==='string')),p.company)
 if(!p.company&&w.companies.length>1)return <WorkspaceShell {...w}><CompanyChoice companies={w.companies} destination="/sites"/></WorkspaceShell>
 if(!w.company)return <WorkspaceShell {...w}><CreateCompany actor={w.user.id}/></WorkspaceShell>
 const archived=p.archived==='1',page=Math.max(0,Math.min(10000,parseInt(p.page)||0)),q=typeof p.q==='string'?p.q.slice(0,120):''
 let query=w.supabase.from('ts_sites').select('*',{count:'exact'}).eq('company_id',w.company.id).eq('archived',archived)
 if(q)query=query.ilike('document->>name','%'+q.replace(/[\\%_]/g,'\\$&')+'%')
 const r=await query.order('updated_at',{ascending:false}).order('id').range(page*25,page*25+24);if(r.error)throw databaseError(r.error)
 const url=n=>'/sites?'+new URLSearchParams({company:w.company.id,archived:archived?'1':'0',q,page:String(n)}),from=url(page)
 return <WorkspaceShell {...w}><div className="work-title"><h1>Sites</h1><Link className="button primary" href={'/sites/new?company='+w.company.id}>New site</Link></div><p>Return to a site for its daily briefs, trade reports and follow-up. Existing records are linked deliberately, never by matching an address.</p><form action="/sites"><input type="hidden" name="company" value={w.company.id}/><label htmlFor="site-search">Find a site by name</label><input id="site-search" name="q" type="search" maxLength={120} defaultValue={q}/><label htmlFor="site-status">Site status</label><select id="site-status" name="archived" defaultValue={archived?'1':'0'}><option value="0">Active sites</option><option value="1">Archived sites</option></select><button>Find sites</button></form><p role="status">{r.count} matching sites</p>{r.data.length?<ul className="work-list">{r.data.map(s=><li key={s.id} id={'site-'+s.id}><Link href={'/sites/'+s.id+'?'+new URLSearchParams({from})}><strong>{s.document.name}</strong><span>{s.document.address}{s.archived?' · Archived':''}</span></Link></li>)}</ul>:<p>No matching sites. Change your search or create a site; existing reports and briefs remain available in their company lists.</p>}<nav aria-label="Site pages">{page>0&&<Link href={url(page-1)}>Previous sites</Link>}{(page+1)*25<r.count&&<Link href={url(page+1)}>Next sites</Link>}</nav></WorkspaceShell>
}
