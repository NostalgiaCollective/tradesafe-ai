import Link from 'next/link'
import {notFound} from 'next/navigation'
import {workspace,databaseError} from '@/lib/server/workspace'
import {pageClient} from '@/lib/server/page-auth'
import {loadSite} from '@/lib/server/sites'
import {actionCounts} from '@/lib/server/action-counts'
import {canEditReport} from '@/lib/domain/inspection'
import {safeRedirect} from '@/lib/domain/validation'
import WorkspaceShell from '@/app/components/WorkspaceShell'
import SiteReturn from '../SiteReturn'
import SiteForm from '../SiteForm'
import SiteStart from '../SiteStart'
export default async function SitePage({params,searchParams}){
 const {id}=await params,p=await searchParams,{supabase}=await pageClient('/sites/'+id);let site
 try{site=await loadSite(supabase,id)}catch(e){if(e.code==='not_found')notFound();throw e}
 const w=await workspace('/sites/'+id,site.company_id),company=site.company_id
 const [links,counts,concerns]=await Promise.all([supabase.from('ts_site_links').select('*,brief:ts_briefs(*),report:ts_reports(id,document,lifecycle,amendment_of,author_id)').eq('company_id',company).eq('site_id',id).order('linked_at',{ascending:false}).limit(50),actionCounts(supabase,company,w.user.id,false,id),supabase.from('ts_concerns').select('*').eq('company_id',company).eq('site_id',id).order('created_at',{ascending:false}).limit(20)])
 if(links.error)throw databaseError(links.error);if(concerns.error)throw databaseError(concerns.error)
 const briefs=links.data.filter(l=>l.brief).map(l=>l.brief),reports=links.data.filter(l=>l.report).map(l=>l.report)
 const back=typeof p.from==='string'?safeRedirect(p.from):'',validBack=(back.startsWith('/sites?')||back.startsWith('/my-work?'))&&new URL(back,'https://internal.invalid').searchParams.get('company')===company
 const canEdit=canEditReport(w.membership.role,w.user.id,site.author_id),query=new URLSearchParams({company,site:id})
 return <WorkspaceShell {...w}><SiteReturn id={id} company={company} actor={w.user.id} from={validBack?back:''}/><p className="eyebrow">{site.archived?'Archived site':'Site workspace'}</p><h1>{site.document.name}</h1><p>{site.document.address}</p>{site.document.instructions&&<details><summary>Current site instructions</summary><p className="preserve-lines">{site.document.instructions}</p><p>Company instructions, not professionally approved content. Recorded versions keep their own captured details.</p></details>}{site.archived?<p className="work-notice">New briefs, reports and associations are blocked. Existing drafts, corrections and action follow-up remain available.</p>:<SiteStart site={site} actor={w.user.id} briefs={briefs}/>}
 <h2>Site concerns</h2>{!site.archived&&<Link className="button" href={'/concerns/new?site='+id}>Report a concern</Link>}<p>Concerns you can access; drafts are visible only to their reporter. Submitted concerns are available to their reporter, assignee and company supervisors/owners. No notifications are sent.</p>{concerns.data.length?<ul className="work-list">{concerns.data.map(c=><li key={c.id}><Link href={'/concerns/'+c.id}><strong>{c.lifecycle==='draft'?'Resume concern draft':'Submitted concern'}</strong><span>{c.document.observation||'Observation not entered'}</span><span>{c.document.location||'Location not entered'}</span></Link></li>)}</ul>:<p>No concerns available to your account at this site.</p>}{concerns.data.length===20&&<p>Showing the 20 most recent concerns you can access. Older submitted concerns remain available through site Actions.</p>}
 <h2>Daily briefs</h2>{briefs.length?<ul className="work-list">{briefs.map(b=><li key={b.id}><Link href={'/briefs/'+b.id}><strong>{b.document.date||'Date not set'} · {b.lifecycle==='draft'?'Resume brief':'Recorded brief'}</strong><span>{b.document.task||'Task not entered'}</span></Link></li>)}</ul>:<p>No briefs linked to this site yet.</p>}<Link href={'/briefs?'+query}>View site briefs</Link>
 <h2>Trade reports</h2>{reports.length?<ul className="work-list">{reports.map(r=><li key={r.id}><Link href={'/report/'+r.id+'?'+new URLSearchParams({from:'/sites/'+id})}><strong>{r.lifecycle==='draft'?'Resume report':'Finalized report'}{r.amendment_of?' · Amendment':''}</strong><span>{r.document.job.address} · {r.document.job.date||'Date not set'}</span></Link></li>)}</ul>:<p>No trade reports linked to this site yet.</p>}<div className="work-buttons">{!site.archived&&<Link className="button" href={'/report/new?'+query}>New site report</Link>}<Link href={'/reports?'+query}>View site reports</Link></div>{links.data.length===50&&<p>Showing the 50 most recently linked records. Use the site lists for older work.</p>}
 <h2>Follow-up</h2><p>{counts.attention} needing attention · {counts.awaiting_verification} awaiting verification · {counts.closed} completed</p><Link className="button" href={'/actions?'+query+'&mine=0'}>Site actions ({counts.outstanding} outstanding)</Link><p>These are record counts, not a safety or compliance assessment.</p>
 {canEdit&&<details><summary>Manage site</summary><SiteForm key={site.revision} site={site} companyId={company} actor={w.user.id} canArchive={w.membership.role!=='worker'}/></details>}
 </WorkspaceShell>
}
