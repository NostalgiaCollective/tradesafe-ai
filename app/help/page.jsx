import Link from 'next/link'
import {notFound} from 'next/navigation'
import {workspace,databaseError} from '@/lib/server/workspace'
import {briefsEnabled} from '@/lib/server/briefs'
import {firstWorkday} from '@/lib/server/first-workday'
import WorkspaceShell from '@/app/components/WorkspaceShell'
import CompanyChoice from '@/app/components/CompanyChoice'
import CreateCompany from '@/app/components/CreateCompany'
import PendingInvitations from '@/app/components/PendingInvitations'
import FirstWorkday from '@/app/components/FirstWorkday'
import Feedback,{FeedbackStatus} from './Feedback'
const explanations=[
 ['Where is my text saved?','Saved to server means the server confirmed the save. Saved on this device; upload pending means an opted-in text copy is in this browser only. Device drafts lets you review it after signing in and reconnecting. Photos are not kept there. Browser data can be cleared; this is not a backup.'],
 ['Record a briefing or acknowledge it?','Recording freezes a briefing version. Included workers open My work and acknowledge that displayed version themselves. Entered attendance is not acknowledgement, proof of understanding or qualification. A revised version needs a new response.'],
 ['Report a concern or update its follow-up?','Report a concern records your original observation and optional photo. After submission, its follow-up lives in Actions. Progress updates do not rewrite the original concern. No notification is sent.'],
 ['Request verification or verify closure?','The assigned worker records progress and requests verification. A permitted supervisor reviews the work and verifies closure, or records further follow-up. Closing an action does not certify the site safe or authorize work.'],
 ['Original report or correction?','Make a correction creates a separate amendment. The finalized original and retained PDF stay unchanged. Review both records to understand the finding and subsequent correction.'],
 ['Current status or historical evidence?','Actions shows current responsibility and status. Site history preserves recorded events; Daily handover distinguishes selected-day activity from outstanding work now. An evidence package copies retained records with an explicit date range and cutoff.'],
]
export default async function Help({searchParams}){
 if(!briefsEnabled())notFound()
 const p=await searchParams,w=await workspace('/help',p.company),invites=await w.supabase.rpc('ts_invitation_context')
 if(invites.error)throw databaseError(invites.error)
 if(!p.company&&w.companies.length>1)return <WorkspaceShell {...w} company={null}><CompanyChoice companies={w.companies} destination="/help"/></WorkspaceShell>
 if(!w.company)return <WorkspaceShell {...w}><h1>Help</h1><PendingInvitations invitations={invites.data}/><p>Join through your invitation or create a company. Opening a briefing link does not give company access.</p><CreateCompany actor={w.user.id}/></WorkspaceShell>
 const guide=await firstWorkday(w),page=Math.max(0,Math.min(10000,parseInt(p.page,10)||0)),feedback=await w.supabase.from('ts_pilot_feedback').select('*',{count:'exact'}).eq('company_id',w.company.id).order('created_at',{ascending:false}).order('id').range(page*20,page*20+19)
 if(feedback.error)throw databaseError(feedback.error)
 return <WorkspaceShell {...w}><h1>Help and pilot feedback</h1><PendingInvitations invitations={invites.data}/><FirstWorkday guide={guide} company={w.company.id} actor={w.user.id} help/>
 <section className="daily-section"><h2>Practice a workday</h2><p>Use the prepared practice supervisor and worker accounts in separate browsers. Credentials are supplied privately by the pilot coordinator; they are never shown here. Do not enter real site information into a practice company.</p>{w.company.practice?<><p><strong>PRACTICE — synthetic records only.</strong> Counts here belong only to this practice company. Previous practice records are preserved; no reset is performed.</p><ol><li>Supervisor: Open sites, create or select a practice site, prepare today’s brief, include the practice worker and record a version.</li><li>Worker: In My work, read and acknowledge the displayed version. Open the site and Report a concern.</li><li>Supervisor: Open Actions, assign the concern to the worker and set its deadline.</li><li>Worker: record progress and request verification. Supervisor: review and verify closure.</li><li>Supervisor: return to the site, review Site history and download a Site evidence package for the practice date.</li></ol><Link className="button primary" href={'/sites?company='+w.company.id}>Open practice sites</Link></>:<p>You are in an operational company. Sign out and use the separate prepared practice account to rehearse. Practice data is not mixed into this company’s counts.</p>}</section>
 <section className="daily-section"><h2>Quick explanations</h2>{explanations.map(([title,text])=><details key={title}><summary>{title}</summary><p>{text}</p></details>)}</section><Feedback company={w.company.id} actor={w.user.id} route={typeof p.context==='string'?p.context:'/help'}/>
 <section className="daily-section"><h2>{w.membership.role==='owner'?'Company pilot feedback':'My pilot feedback'}</h2><p>{feedback.count} submissions. Owners can manage status; no external support message is sent.</p>{feedback.data.length?<ul className="work-list">{feedback.data.map(f=><li key={f.id}><strong>{f.task}</strong><p>{f.kind} · {f.status} · {new Date(f.created_at).toISOString()}</p><details><summary>Submission and support reference</summary><p>{f.description}</p>{f.expectation&&<p>{f.expectation}</p>}<p>Reference: {f.id}</p><p>Page: {f.route} · App: {f.app_version}</p></details>{w.membership.role==='owner'&&<FeedbackStatus key={f.id} item={f} actor={w.user.id}/>}</li>)}</ul>:<p>No feedback submitted here yet.</p>}<nav aria-label="Feedback pages">{page>0&&<Link href={'/help?company='+w.company.id+'&page='+(page-1)}>Previous feedback</Link>}{(page+1)*20<feedback.count&&<Link href={'/help?company='+w.company.id+'&page='+(page+1)}>More feedback</Link>}</nav></section></WorkspaceShell>
}
