import {notFound,redirect} from 'next/navigation'
import {briefsEnabled} from '@/lib/server/briefs'
import {workspace,databaseError} from '@/lib/server/workspace'
import WorkspaceShell from '@/app/components/WorkspaceShell'
import ContentSources from '@/app/briefs/ContentSources'
import ReviewDecision from './ReviewDecision'
import pilot from '@/lib/domain/content-pilot.json'
export default async function ReviewPage({searchParams}){
 if(!briefsEnabled())notFound()
 const p=await searchParams,version=p.version||pilot.version
 if(!/^[a-z0-9-]{1,100}$/.test(version))notFound()
 const w=await workspace('/brief-content?version='+version,p.company);if(!w.company)redirect('/dashboard')
 const [r,permission,history]=await Promise.all([w.supabase.from('ts_brief_content_catalog').select('*').eq('version',version).maybeSingle(),w.supabase.rpc('ts_brief_content_review_permission',{content_version:version}),w.supabase.from('ts_brief_content_decisions').select('*').eq('version',version).order('sequence')])
 for(const result of [r,permission,history])if(result.error)throw databaseError(result.error)
 if(!r.data)notFound();const c=r.data
 return <WorkspaceShell {...w}><a href={'/briefs?company='+w.company.id}>Back to daily briefs</a><h1>Content review record</h1><h2>{c.payload.title}</h2><p>Authored by {c.created_by}; registered {c.created_at}.</p><p>{c.payload.applicability}</p><p>{c.payload.limits}</p><ContentSources content={c} prompts={c.payload.prompts}/><h2>Requested reviewer decisions</h2><ul>{c.payload.prompts.map(x=><li key={x.id}>{x.id} v{x.version}: {x.reviewQuestions}</li>)}</ul><p>Confirm current law and applicability, omissions, plain-language accuracy and the scope of your qualifications. Publication is not approval. Company owner/supervisor permission is not professional qualification.</p><h2>Decision history</h2>{history.data.length?history.data.map(d=><p key={d.sequence}>{d.state} · {d.reviewer_name} · {d.recorded_at} · {d.decision_ref}: {d.notes}</p>):<p>No qualified review decision has been recorded. All proposed wording remains draft.</p>}{permission.data&&c.state!=='superseded'?<ReviewDecision content={c} actor={w.user.id}/>:<p>Review controls require a separate, version-specific qualified-reviewer appointment. App roles alone do not grant this permission.</p>}</WorkspaceShell>
}
