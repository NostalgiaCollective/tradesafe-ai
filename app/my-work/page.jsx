import Link from 'next/link'
import {notFound} from 'next/navigation'
import {workspace,databaseError} from '@/lib/server/workspace'
import {briefsEnabled} from '@/lib/server/briefs'
import WorkspaceShell from '@/app/components/WorkspaceShell'
import CompanyChoice from '@/app/components/CompanyChoice'
import CreateCompany from '@/app/components/CreateCompany'
import {crewView} from '@/lib/domain/crew.mjs'
import {ACTION_LABELS} from '@/lib/domain/action-edit'
export default async function MyWork({searchParams}){
 if(!briefsEnabled())notFound()
 const p=await searchParams,{crew,page}=crewView(p),w=await workspace('/my-work?'+new URLSearchParams(Object.entries(p).filter(([,v])=>typeof v==='string')),p.company)
 if(!p.company&&w.companies.length>1)return <WorkspaceShell {...w} company={null}><CompanyChoice companies={w.companies} destination="/my-work"/></WorkspaceShell>
 if(!w.company)return <WorkspaceShell {...w}><CreateCompany actor={w.user.id}/></WorkspaceShell>
 if(crew&&w.membership.role==='worker')notFound()
 const company=w.company.id,url=n=>'/my-work?'+new URLSearchParams({company,...(crew?{view:'crew'}:{}),...(n?{page:String(n)}:{})}),back=url(page)
 const briefQuery=crew?w.supabase.from('ts_brief_response_summary').select('*',{count:'exact'}).eq('company_id',company):w.supabase.from('ts_brief_participation').select('*',{count:'exact'}).eq('company_id',company).eq('user_id',w.user.id).eq('latest_recorded',true).eq('member_active',true).is('acknowledged_at',null)
 let actionQuery=w.supabase.from('ts_action_ownership').select('*',{count:'exact'}).eq('company_id',company).neq('state','closed')
 actionQuery=crew?actionQuery.eq('needs_reassignment',true):actionQuery.eq('responsible_id',w.user.id)
 const [briefs,actions]=await Promise.all([briefQuery.order('recorded_at',{ascending:false}).order('brief_id').range(page*20,page*20+19),actionQuery.order('target_date',{nullsFirst:false}).order('id').range(page*20,page*20+19)])
 for(const r of [briefs,actions])if(r.error)throw databaseError(r.error)
 const briefLink=b=>'/briefs/'+b.brief_id+'?'+new URLSearchParams({version:String(b.version),from:back})+'#crew-responses'
 const actionLink=a=>'/actions?'+new URLSearchParams({company,mine:crew?'0':'1',focus:a.id,from:back,...(a.site_id?{site:a.site_id}:{})})
 return <WorkspaceShell {...w}><h1>{crew?'Crew responses':'My work'}</h1><p>{crew?'Review recorded participants and responsibilities.':'Briefings and actions for your signed-in account in this company.'} These items are available in the app; no notifications are sent.</p><nav className="work-buttons" aria-label="Crew work views"><Link href={'/my-work?company='+company}>My work</Link>{w.membership.role!=='worker'&&<Link href={'/my-work?company='+company+'&view=crew'}>Crew responses</Link>}<Link href={'/actions?company='+company+'&mine='+(crew?'0':'1')}>Open Actions</Link></nav>
 <h2>{crew?'Latest recorded briefings':'Briefings to review'}</h2><p role="status">{briefs.count} {crew?'recorded briefings':'briefings awaiting your response'}{briefs.count>20?' · 20 per page':''}.</p>
 {briefs.data.length?<ul className="work-list">{briefs.data.map(b=><li key={b.brief_id}><Link href={briefLink(b)}><strong>{b.record_site}</strong><span>{b.work_date} · Version {b.version}</span><span>{b.task}</span><span>{b.can_acknowledge?(crew?`${b.acknowledged} acknowledged · ${b.pending} awaiting acknowledgement`:'Read and acknowledge'):'Revision in progress — acknowledgement unavailable'}</span></Link>{crew&&<p>{b.participants} included participants{b.removed_participants>0?` · ${b.removed_participants} no longer have access`:''}. {b.revision_in_progress?'These responses belong to the last recorded version. A new recorded version needs fresh acknowledgement.':''}</p>}{b.site_id&&<Link href={'/sites/'+b.site_id+'?'+new URLSearchParams({from:back})}>Open site</Link>}</li>)}</ul>:<p>{crew?'No recorded briefing participants yet.':'No briefings awaiting your response. Only recorded versions that include you appear here; attendance entered by someone else is not your acknowledgement.'}</p>}
 <h2>{crew?'Responsibilities needing reassignment':'Assigned actions'}</h2><p role="status">{actions.count} {crew?'actions need reassignment':'outstanding actions assigned to you'}{actions.count>20?' · 20 per page':''}.</p>{actions.data.length?<ul className="work-list">{actions.data.map(a=><li key={a.id}><Link href={actionLink(a)}><strong>{a.record_site}</strong><span>{a.observation}</span><span>{ACTION_LABELS[a.state]}{crew?(a.responsible_id?' · Assignee no longer has access':' · Unassigned'):''}</span><span>{a.target_date?'Due '+a.target_date:'No due date'} · {crew?'Review assignment':'Open action'}</span></Link>{a.site_id&&<Link href={'/sites/'+a.site_id+'?'+new URLSearchParams({from:back})}>Open site</Link>}</li>)}</ul>:<p>{crew?'No outstanding actions need reassignment.':'Nothing assigned to you needs follow-up.'}</p>}
 {crew&&<p>Actions currently require an active assignee when saved. Removing access preserves the previous assignment and history until a permitted reassignment. <Link href={'/actions?company='+company+'&mine=0'}>Review all crew actions</Link></p>}
 <nav className="work-buttons" aria-label="My work pages">{page>0&&<Link href={url(page-1)}>Previous work</Link>}{(page+1)*20<Math.max(briefs.count,actions.count)&&<Link href={url(page+1)}>More work</Link>}</nav></WorkspaceShell>
}
