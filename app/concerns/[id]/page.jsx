import Link from 'next/link'
import {notFound} from 'next/navigation'
import {workspace,databaseError} from '@/lib/server/workspace'
import {pageClient} from '@/lib/server/page-auth'
import {requireBriefs} from '@/lib/server/briefs'
import {UUID,safeRedirect} from '@/lib/domain/validation'
import {ACTION_LABELS} from '@/lib/domain/action-edit'
import WorkspaceShell from '@/app/components/WorkspaceShell'
import EvidencePanel from '@/app/report/[id]/EvidencePanel'
import ConcernForm from '../ConcernForm'
import ConcernNote from '../ConcernNote'
export default async function ConcernPage({params,searchParams}){
 requireBriefs();const {id}=await params,p=await searchParams,{supabase}=await pageClient('/concerns/'+id+'?'+new URLSearchParams({from:p.from||''}))
 if(!UUID.test(id))notFound();const r=await supabase.from('ts_concerns').select('*').eq('id',id).maybeSingle();if(r.error)throw databaseError(r.error);if(!r.data)notFound()
 const c=r.data,w=await workspace('/concerns/'+id,c.company_id),back=safeRedirect(p.from),validBack=/^\/(my-work|actions)\?/.test(back)&&new URL(back,'https://internal.invalid').searchParams.get('company')===c.company_id
 const [notes,action,members]=await Promise.all([supabase.from('ts_concern_notes').select('*').eq('concern_id',id).order('recorded_at').limit(100),supabase.from('ts_actions').select('*').eq('concern_id',id).maybeSingle(),supabase.from('ts_members').select('user_id,display_name').eq('company_id',c.company_id)])
 for(const x of [notes,action,members])if(x.error)throw databaseError(x.error)
 const name=u=>members.data.find(m=>m.user_id===u)?.display_name||'Former member',site={id:c.site_id,document:{name:c.site_snapshot.name,address:c.site_snapshot.address}}
 return <WorkspaceShell {...w}><div className="work-buttons">{validBack&&<Link href={back}>{back.startsWith('/my-work')?'Back to My work':'Back to actions'}</Link>}<a href={'/sites/'+c.site_id}>Back to site</a></div>{c.lifecycle==='draft'?<ConcernForm initial={c} site={site} actor={w.user.id}/>:<><p className="eyebrow">Submitted site concern</p><h1>{c.site_snapshot.name}</h1><p>{c.site_snapshot.address}</p><p role="status">Concern submitted. No notification was sent.</p><h2>Original observation</h2><p className="preserve-lines">{c.document.observation}</p><p><strong>Location:</strong> {c.document.location}</p><p><strong>Immediate steps reported:</strong> {c.document.immediate||'None entered'}</p><p>Reported by {name(c.author_id)}. Submitted at {new Date(c.submitted_at).toISOString()} (server time).</p><p>Entered observation time: {c.document.observedAt?new Date(c.document.observedAt).toISOString():'Not entered'}. This time is user-supplied.</p>{action.data&&<><p>Follow-up: {ACTION_LABELS[action.data.state]} · Assigned to {name(action.data.responsible_id)}</p><Link className="button primary" href={'/actions?'+new URLSearchParams({company:c.company_id,site:c.site_id,mine:'0',status:'all',focus:action.data.id})}>Open follow-up action</Link></>}<p>The original observation and photos are retained. Use the action for progress and supervisor verification. This record does not authorize work or represent an emergency response or statutory incident-reporting service.</p><EvidencePanel concernId={id} actor={w.user.id}/><h2>Correction notes</h2>{notes.data.length?<ol>{notes.data.map(n=><li key={n.id}><p className="preserve-lines">{n.note}</p><p>{name(n.actor_id)} · {new Date(n.recorded_at).toISOString()}</p></li>)}</ol>:<p>No correction notes recorded.</p>}{(c.author_id===w.user.id||w.membership.role!=='worker')&&<ConcernNote id={id} actor={w.user.id}/>}</>}</WorkspaceShell>
}
