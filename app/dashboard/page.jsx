import Link from 'next/link'
import {redirect} from 'next/navigation'
import {workspace,databaseError} from '@/lib/server/workspace'
import WorkspaceShell from '@/app/components/WorkspaceShell'
import CreateCompany from '@/app/components/CreateCompany'
import CompanyChoice from '@/app/components/CompanyChoice'
import PendingInvitations from '@/app/components/PendingInvitations'
import ReportRows from '@/app/components/ReportRows'
import {reportFilters,reportListUrl} from '@/lib/domain/report-list'
import {briefsEnabled} from '@/lib/server/briefs'
import {actionCounts} from '@/lib/server/action-counts'
export default async function DashboardPage({searchParams}){
 const params=await searchParams,w=await workspace('/dashboard?'+new URLSearchParams(Object.entries(params).filter(([,v])=>typeof v==='string')),params.company)
 const invites=await w.supabase.rpc('ts_invitation_context');if(invites.error)throw databaseError(invites.error)
 const pending=<PendingInvitations invitations={invites.data}/>
 if(!params.company&&w.companies.length>1)return <WorkspaceShell {...w} company={null}>{pending}<CompanyChoice companies={w.companies}/></WorkspaceShell>
 if(!w.company)return <WorkspaceShell {...w}>{pending}<CreateCompany actor={w.user.id}/></WorkspaceShell>
 if(['q','status','trade','sort','page'].some(k=>params[k]))redirect(reportListUrl(w.company.id,reportFilters(params)))
 const company=w.company.id,returnTo='/dashboard?company='+company,library='/reports?company='+company
 const worker=w.membership.role==='worker'
 let attention=w.supabase.from('ts_actions').select('id,observation,state,target_date,report:ts_reports(id,document)'+(briefsEnabled()?',brief:ts_briefs!ts_actions_brief_id_fkey(id,document)':''),{count:'exact'}).eq('company_id',company).neq('state','closed')
 if(worker)attention=attention.eq('responsible_id',w.user.id)
 const [drafts,finalized,actions,counts]=await Promise.all([
 w.supabase.from('ts_reports').select('id,document,template_snapshot,lifecycle,amendment_of,updated_at',{count:'exact'}).eq('company_id',company).eq('author_id',w.user.id).eq('lifecycle','draft').order('updated_at',{ascending:false}).order('id').limit(3),
 w.supabase.from('ts_reports').select('id,document,template_snapshot,lifecycle,amendment_of,updated_at',{count:'exact'}).eq('company_id',company).eq('lifecycle','finalized').order('finalized_at',{ascending:false}).order('id').limit(4),
 attention.order('target_date',{nullsFirst:false}).order('id').limit(4),actionCounts(w.supabase,company,w.user.id,worker)])
 for(const r of [drafts,finalized,actions])if(r.error)throw databaseError(r.error)
 return <WorkspaceShell {...w}>{pending}<div className="daily-intro"><p className="eyebrow">Your working day</p><h1>Ready for the next job.</h1><p>Pick up where you left off, or record a new visit.</p><Link className="primary button" href={'/report/new?company='+company}>Start new report</Link><Link className="button" href={'/actions?'+new URLSearchParams({company,mine:worker?'1':'0'})}>{counts.outstanding} outstanding actions</Link></div>{briefsEnabled()&&<section className="daily-section"><h2>Daily site safety brief</h2><p>Site, today?s work, hazards and controls, crew briefing and follow-up. Draft content pending qualified review.</p><Link className="button" href={'/briefs?company='+company}>Open daily site briefs</Link></section>}<section className="daily-section"><div className="section-heading"><h2>Resume drafts</h2><Link href={library+'&status=draft'}>View all drafts</Link></div><p className="work-footnote">{drafts.count} of your drafts{drafts.count>3?' · showing the 3 most recently saved':''}</p><ReportRows reports={drafts.data} returnTo={returnTo} empty="No drafts to resume. Start a report when you arrive at your next job."/></section><section className="daily-section"><div className="section-heading"><h2>Outstanding actions</h2><Link href={'/actions?company='+company+(worker?'':'&mine=0')}>{worker?'Assigned to me':'View crew actions'}</Link></div><div className="action-overview"><Link href={'/actions?'+new URLSearchParams({company,mine:worker?'1':'0',status:'attention'})}>{counts.attention} Needs attention</Link><Link href={'/actions?'+new URLSearchParams({company,mine:worker?'1':'0',status:'awaiting_verification'})}>{counts.awaiting_verification} Awaiting verification</Link></div><p>{actions.count} outstanding actions {worker?'assigned to you':'in your company'}{actions.count>4?' · showing the next 4 by due date':''}.</p>{actions.data.length?<ul className="work-list attention-rows">{actions.data.map(a=><li key={a.id}><Link href={'/actions?company='+company+(worker?'':'&mine=0')+'&focus='+a.id}><strong>{a.brief?.document.site||a.report?.document.job.address||'Original record'}</strong><span>{a.observation}</span><small>{a.state==='awaiting_verification'?'Awaiting supervisor verification':'Follow-up required'} · {a.target_date?'Due '+a.target_date:'No due date'}</small></Link></li>)}</ul>:<p className="empty-work">{worker?'Nothing assigned to you needs follow-up. Company actions remain available in Actions.':'No open company follow-ups. Finalized findings remain in your report library.'}</p>}</section><section className="daily-section"><div className="section-heading"><h2>Recently finalized</h2><Link href={library+'&status=finalized'}>View finalized reports</Link></div><ReportRows reports={finalized.data} returnTo={returnTo} empty="Finalized reports will appear here. Resume a draft to review and finalize it."/></section><Link className="button library-entry" href={library}>Search / view all reports</Link></WorkspaceShell>
}
