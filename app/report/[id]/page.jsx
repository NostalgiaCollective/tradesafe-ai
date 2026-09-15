import Link from 'next/link'
import { notFound } from 'next/navigation'
import { loadReport,workspace,databaseError } from '@/lib/server/workspace'
import { ANSWERS,answerState,canEditReport,hasConcerns } from '@/lib/domain/inspection'
import WorkspaceShell from '@/app/components/WorkspaceShell'
import ReportEditor from './ReportEditor'
import ReportTools from './ReportTools'
import EvidencePanel from './EvidencePanel'
import ExportPanel from './ExportPanel'
import { legacyAnswers } from '@/lib/domain/legacy'
export default async function ReportPage({params,searchParams}) {
 const {id}=await params;let loaded
 try{loaded=await loadReport(id)}catch(e){if(e.code==='not_found')notFound();throw e}
 const {supabase,user,report,membership}=loaded
 if(!report){
  const legacy=await supabase.from('reports').select('*').eq('id',id).maybeSingle()
  if(legacy.error)throw databaseError(legacy.error);if(!legacy.data)notFound()
  const link=await supabase.from('ts_legacy_reports').select('company_id').eq('report_id',id).maybeSingle()
  if(link.error)throw databaseError(link.error);if(!link.data)notFound()
  const w=await workspace('/report/'+id,link.data.company_id),r=legacy.data
  const entries=legacyAnswers(r.checklist)
  return <WorkspaceShell {...w}><h1>Legacy job record</h1><div className="work-alert"><h2>Unknown default-pass provenance</h2><p>This historic application could mark unanswered items as passed. Recorded values are preserved below; they are not verified observations or proof of compliance. Payment never establishes safety completion.</p></div><section className="work-panel"><h2>{r.job_address}</h2><p>{r.business_name} | {r.date_of_work}</p><p>Historical payment marker: {r.status==='completed'?'Recorded as completed by the old payment flow; entitlement not verified':'No completed payment marker'}</p><ul className="review-list">{entries.map((a,i)=><li key={i}><strong>{a.label||a.item||a.category||'Historical item'}</strong><span>{a.status==='pass'?'Recorded as pass; provenance unknown':a.status==='fail'?'Recorded as fail':a.status==='na'?'Recorded as not applicable':'Unknown / not recorded'}</span><p>{a.notes||''}</p></li>)}</ul></section><ReportTools report={r} canAmend={false}/></WorkspaceShell>
 }
 const w=await workspace('/report/'+id,report.company_id)
 const stagingBuild=process.env.HOSTED_STAGING==='1'&&/^[a-f0-9]{40}$/.test(process.env.RENDER_GIT_COMMIT||'')?process.env.RENDER_GIT_COMMIT:null
 const editable=canEditReport(membership.role,user.id,report.author_id)
 if(report.lifecycle==='draft'){const query=await searchParams;const initialStep=[2,3,4].includes(Number(query.step))?Number(query.step):2;return <WorkspaceShell {...w}><ReportEditor key={report.id} report={report} actor={user.id} editable={editable} initialStep={initialStep} stagingBuild={stagingBuild}/></WorkspaceShell>}
 const [actions,amendments,members]=await Promise.all([supabase.from('ts_actions').select('*').eq('report_id',id),supabase.from('ts_reports').select('id,lifecycle,amendment_reason').eq('amendment_of',id),supabase.from('ts_members').select('user_id,display_name').eq('company_id',report.company_id)])
 for(const r of [actions,amendments,members])if(r.error)throw databaseError(r.error)
 const name=id=>members.data.find(m=>m.user_id===id)?.display_name||id
 return <WorkspaceShell {...w}><article className="inspection-print"><p className="eyebrow">Finalized observations | {report.template_snapshot.trade}</p><h1>{report.document.job.address}</h1><p>{report.business_snapshot.name} | Work date {report.document.job.date}</p>
 <p>Recorded by {name(report.author_id)}. Finalized by {name(report.finalized_by)} on {new Date(report.finalized_at).toLocaleString('en-CA')}.</p><p>Template {report.template_snapshot.version} | Snapshot {report.snapshot_version} | Record {report.id}</p>
 <div className="work-notice">Checklist content pending qualified review. Finalization acknowledges recorded observations; it does not certify compliance, authorize work or resolve hazards.</div>
 {report.amendment_of&&<p>Amendment to <Link href={'/report/'+report.amendment_of}>original record</Link>. Reason: {report.amendment_reason}</p>}
 {!!hasConcerns(report.document)&&<section className="work-alert"><h2>{hasConcerns(report.document)} concerns recorded at finalization</h2><p>The original concerns remain part of this snapshot even when subsequent actions close.</p></section>}
 <ul className="review-list">{report.template_snapshot.items.map(i=>{const a=report.document.answers[i.id];return <li key={i.id}><div className="observation-summary"><small>{i.category}</small><strong>{i.question}</strong><span>{ANSWERS[answerState(a?.state)]}</span></div>{a?.note&&<p>{a.note}</p>}{a?.controls&&<p>Immediate controls: {a.controls}</p>}</li>})}</ul>
 <p>I acknowledge that these observations and explanations accurately reflect what I recorded. This record does not certify compliance, authorize work, or mean that unresolved concerns are safe.</p>
 <section className="work-panel"><h2>Subsequent corrective actions</h2><p>Current action state, separate from the immutable observations above.</p>{!actions.data.length?<p>No follow-up concerns were recorded.</p>:<ul>{actions.data.map(a=><li key={a.id}>{a.observation}: <strong>{a.state.replaceAll('_',' ')}</strong> | Responsible: {name(a.responsible_id)}{a.verified_at?' | Verified by '+name(a.verified_by)+' at '+new Date(a.verified_at).toLocaleString('en-CA'):''}</li>)}</ul>}<Link className="no-print" href={'/actions?company='+report.company_id}>Review actions and history</Link></section>
 {!!amendments.data.length&&<section><h2>Linked amendments</h2><ul>{amendments.data.map(a=><li key={a.id}><Link href={'/report/'+a.id}>{a.amendment_reason} ({a.lifecycle})</Link></li>)}</ul></section>}
 </article><EvidencePanel reportId={report.id}/><ExportPanel reportId={report.id}/><ReportTools report={report} canAmend={editable}/></WorkspaceShell>
}
