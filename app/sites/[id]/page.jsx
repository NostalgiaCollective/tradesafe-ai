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
import SiteHandover from '../SiteHandover'
export default async function SitePage({params,searchParams}){
 const {id}=await params,p=await searchParams,{supabase}=await pageClient('/sites/'+id+'?'+new URLSearchParams({date:p.date||'',timezone:p.timezone||''}));let site
 try{site=await loadSite(supabase,id)}catch(e){if(e.code==='not_found')notFound();throw e}
 const w=await workspace('/sites/'+id,site.company_id),company=site.company_id
 const [links,counts,concerns]=await Promise.all([supabase.from('ts_site_links').select('*,brief:ts_briefs(*),report:ts_reports(id,document,lifecycle,amendment_of,author_id)').eq('company_id',company).eq('site_id',id).order('linked_at',{ascending:false}).limit(50),actionCounts(supabase,company,w.user.id,false,id),supabase.from('ts_concerns').select('*').eq('company_id',company).eq('site_id',id).order('created_at',{ascending:false}).limit(20)])
 if(links.error)throw databaseError(links.error);if(concerns.error)throw databaseError(concerns.error)
 const briefs=links.data.filter(l=>l.brief).map(l=>l.brief),reports=links.data.filter(l=>l.report).map(l=>l.report)
 const back=typeof p.from==='string'?safeRedirect(p.from):'',validBack=(back.startsWith('/sites?')||back.startsWith('/my-work?'))&&new URL(back,'https://internal.invalid').searchParams.get('company')===company
 const canEdit=canEditReport(w.membership.role,w.user.id,site.author_id),query=new URLSearchParams({company,site:id})
 const editable=r=>r.lifecycle==='draft'&&canEditReport(w.membership.role,w.user.id,r.author_id)
 const savedBriefs=briefs.filter(editable),savedReports=reports.filter(editable),savedConcerns=concerns.data.filter(c=>c.lifecycle==='draft'&&c.author_id===w.user.id)
 const hasSaved=savedBriefs.length+savedReports.length+savedConcerns.length>0
 const briefLink=b=><Link href={'/briefs/'+b.id}><strong>{b.document.date||'Date not set'} · {b.lifecycle==='draft'?(editable(b)?'Resume brief':'View brief draft'):'Recorded brief'}</strong><span>{b.document.task||'Task not entered'}</span></Link>
 const reportLink=r=><Link href={'/report/'+r.id+'?'+new URLSearchParams({from:'/sites/'+id})}><strong>{r.lifecycle==='draft'?(editable(r)?'Resume report':'View report draft'):'Finalized report'}{r.amendment_of?' · Amendment':''}</strong><span>{r.document.job.address} · {r.document.job.date||'Date not set'}</span></Link>
 const concernLink=c=><Link href={'/concerns/'+c.id}><strong>{c.lifecycle==='draft'?'Resume concern draft':'Submitted concern'}</strong><span>{c.document.observation||'Observation not entered'}</span><span>{c.document.location||'Location not entered'}</span></Link>
 const otherBriefs=briefs.filter(b=>!editable(b)),otherReports=reports.filter(r=>!editable(r)),submitted=concerns.data.filter(c=>c.lifecycle!=='draft')
 return <WorkspaceShell {...w}><div className="site-workspace"><SiteReturn id={id} company={company} actor={w.user.id} from={validBack?back:''}/><p className="eyebrow">{site.archived?'Archived site':'Site workspace'}</p><h1>{site.document.name}</h1><p>{site.document.address}</p>{site.document.instructions&&<details><summary>Current site instructions</summary><p className="preserve-lines">{site.document.instructions}</p><p>Company instructions, not professionally approved content. Recorded versions keep their own captured details.</p></details>}
 <div className="site-quick-actions">
  {!site.archived&&<Link className="button" href={'/concerns/new?site='+id}>Report a concern</Link>}
  <Link className="button" href={'/actions?'+query+'&mine=0'}>Site actions ({counts.outstanding} outstanding)</Link>
 </div>
 <p className="site-follow-up-counts">{counts.attention} needing attention · {counts.awaiting_verification} awaiting verification · {counts.closed} completed</p>
 <nav aria-label="On this site" className="site-section-links">
  {hasSaved&&<a href="#site-saved">Saved work</a>}<a href="#site-briefs">Daily briefs</a><a href="#site-reports">Trade reports</a><a href="#site-concerns">Site concerns</a><a href="#handover-title">Daily handover</a>
 </nav>
 {hasSaved&&<section aria-labelledby="site-saved"><h2 id="site-saved" tabIndex={-1}>Continue saved work</h2><p>Saved drafts you can edit. Open one to continue where you left off.</p><ul className="work-list site-saved-list">
  {savedBriefs.map(b=><li key={b.id}>{briefLink(b)}</li>)}{savedReports.map(r=><li key={r.id}>{reportLink(r)}</li>)}{savedConcerns.map(c=><li key={c.id}>{concernLink(c)}</li>)}
 </ul></section>}
 {site.archived?<p className="work-notice">New briefs, reports and associations are blocked. Existing drafts, corrections and action follow-up remain available.</p>:<SiteStart site={site} actor={w.user.id} briefs={briefs}/>}
 <section aria-labelledby="site-briefs"><h2 id="site-briefs" tabIndex={-1}>Daily briefs</h2>{otherBriefs.length?<ul className="work-list">{otherBriefs.map(b=><li key={b.id}>{briefLink(b)}</li>)}</ul>:<p>{savedBriefs.length?'Your editable briefs are in Continue saved work.':'No briefs linked to this site yet.'}</p>}<Link href={'/briefs?'+query}>View site briefs</Link></section>
 <section aria-labelledby="site-reports"><h2 id="site-reports" tabIndex={-1}>Trade reports</h2>{otherReports.length?<ul className="work-list">{otherReports.map(r=><li key={r.id}>{reportLink(r)}</li>)}</ul>:<p>{savedReports.length?'Your editable reports are in Continue saved work.':'No trade reports linked to this site yet.'}</p>}<div className="work-buttons">{!site.archived&&<Link className="button" href={'/report/new?'+query}>New site report</Link>}<Link href={'/reports?'+query}>View site reports</Link></div>{links.data.length===50&&<p>Showing the 50 most recently linked records, including drafts above. Use the site lists for older work.</p>}</section>
 <section aria-labelledby="site-concerns"><h2 id="site-concerns" tabIndex={-1}>Site concerns</h2>{submitted.length?<ul className="work-list">{submitted.map(c=><li key={c.id}>{concernLink(c)}</li>)}</ul>:<p>{savedConcerns.length?'Your concern drafts are in Continue saved work.':'No submitted concerns available to your account at this site.'}</p>}{concerns.data.length===20&&<p>Showing the 20 most recent concerns you can access, including drafts above. Older submitted concerns remain available through site Actions.</p>}<details><summary>Who can see a concern?</summary><p>Drafts are visible only to their reporter. Submitted concerns are available to their reporter, assignee and company supervisors/owners. No notifications are sent.</p></details></section>
 <SiteHandover key={w.user.id+id} site={site} actor={w.user.id} date={p.date} timezone={p.timezone}/>
 <p className="work-footnote">These are record counts, not a safety or compliance assessment.</p>
 {canEdit&&<details><summary>Manage site</summary><SiteForm key={site.revision} site={site} companyId={company} actor={w.user.id} canArchive={w.membership.role!=='worker'}/></details>}
 </div></WorkspaceShell>
}
