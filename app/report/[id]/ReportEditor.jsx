'use client'
import { useRef,useState } from 'react'
import Link from 'next/link'
import { useDraft } from '@/lib/client/useDraft'
import { command } from '@/lib/client/commands'
import { ANSWERS,answerState,finalizationIssues,hasConcerns } from '@/lib/domain/inspection'
import EvidencePanel from './EvidencePanel'

export default function ReportEditor({report,actor,editable,initialStep=2,stagingBuild=null}) {
 const draft=useDraft(report,actor),[step,changeStep]=useState(initialStep),[ack,setAck]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('')
 function setStep(next){changeStep(next);window.history.replaceState(null,'','?step='+next)}
 const finalizeRequest=useRef(null),finalizeLock=useRef(false)
 const doc=draft.document,template=report.template_snapshot,issues=finalizationIssues(doc,template)
 const answer=(id,key,value)=>draft.change({...doc,answers:{...doc.answers,[id]:{state:'unanswered',note:'',controls:'',...doc.answers[id],[key]:value}}})
 async function finalize(){if(finalizeLock.current)return;finalizeLock.current=true;setBusy(true);setError('');try{
  if(!await draft.flush()){setError('Save your changes successfully before finalizing.');return}
  finalizeRequest.current ||= crypto.randomUUID()
  await command('finalize',{id:report.id,companyId:report.company_id,revision:draft.revision.current,requestId:finalizeRequest.current,acknowledged:ack})
  window.location.reload()
 }catch(e){setError(e.message)}finally{finalizeLock.current=false;setBusy(false)}}
 return <><div className="work-title"><div><p className="eyebrow">Saved draft · {template.trade}</p><h1>{doc.job.address||'Job observations'}</h1></div><div className="save-state" role="status" aria-live="polite">{draft.status}</div></div>
 <p className="work-notice">Questions pending qualified review. These observations do not certify compliance or authorize work. Work stopped or unresolved concerns can still be recorded.</p>
 {report.amendment_of&&<p className="work-notice">Amendment to <Link href={'/report/'+report.amendment_of}>the original report</Link>: {report.amendment_reason}. Review every retained answer before finalizing this amendment.</p>}
 {!editable&&<p role="alert">You can read this draft. Its author, a supervisor or an owner can edit it.</p>}
 {draft.error&&<div className="work-alert" role="alert"><p>{draft.error}</p><div className="work-buttons"><button onClick={draft.save} disabled={draft.blocked.current}>Retry saving</button><a href={'/report/'+report.id} target="_blank" rel="noopener noreferrer">Open latest saved version</a><a href="/auth/login" target="_blank" rel="noopener noreferrer">Sign in again</a><button onClick={()=>{if(confirm('Discard unsaved changes and load the latest saved version?'))window.location.reload()}}>Discard changes and reload</button></div></div>}
 <p><a href="#photo-evidence">Add or review photos</a></p>
 <nav className="work-steps" aria-label="Report steps">{[[2,'Job details'],[3,'Observations'],[4,'Review']].map(([n,label])=><button key={n} aria-current={step===n?'step':undefined} onClick={()=>setStep(n)}>{n} · {label}</button>)}</nav>
 <fieldset disabled={!editable||busy} className="work-fieldset">
 {step===2&&<section className="work-panel"><h2>Job details</h2><p>Business snapshot: <strong>{report.business_snapshot.name}</strong>. Change company settings for future reports; this snapshot stays with this job.</p>
 {Object.entries(report.business_snapshot.details||{}).filter(([key,value])=>['contact_email','contact_phone','address','license_number','ecra_number','coq_number','cot_cert_number','wah_cert_number','wsib_number','liability_policy_number'].includes(key)&&value).map(([key,value])=><p key={key}><small>{key.replaceAll('_',' ')}: {String(value)}</small></p>)}
 {[['address','Job address','text'],['client','Client or job reference (optional)','text'],['date','Work date','date']].map(([key,label,type])=><div key={key}><label htmlFor={'job-'+key}>{label}</label><input id={'job-'+key} type={type} maxLength={1000} value={doc.job[key]} onChange={e=>draft.change({...doc,job:{...doc.job,[key]:e.target.value}})} aria-describedby={key!=='client'?'job-'+key+'-help':undefined}/>{key!=='client'&&!doc.job[key]?.trim()&&<p id={'job-'+key+'-help'}>{label} is required before finalizing.</p>}</div>)}
 <button onClick={()=>setStep(3)} className="primary">Continue to observations</button></section>}
 {step===3&&<section><h2>Record each observation</h2><p>{template.items.filter(i=>answerState(doc.answers[i.id]?.state)==='unanswered').length} unanswered · {hasConcerns(doc)} concerns</p>
 {template.items.map(item=>{const a=doc.answers[item.id]||{state:'unanswered',note:'',controls:''};const s=answerState(a.state);return <fieldset className="work-panel" key={item.id}><legend>{item.category} · {item.question}</legend>
 <label htmlFor={'answer-'+item.id}>Observation</label><select id={'answer-'+item.id} value={s} onChange={e=>answer(item.id,'state',e.target.value)}>{Object.entries(ANSWERS).map(([v,label])=><option value={v} key={v}>{label}</option>)}</select>
 <label htmlFor={'note-'+item.id}>{['attention','not_applicable','unable'].includes(s)?'Explanation (required)':'Notes (optional)'}</label><textarea id={'note-'+item.id} maxLength={4000} value={a.note} onChange={e=>answer(item.id,'note',e.target.value)} aria-describedby={s!=='meets'&&s!=='unanswered'?'note-help-'+item.id:undefined}/>{s!=='meets'&&s!=='unanswered'&&!a.note?.trim()&&<p id={'note-help-'+item.id}>Add an explanation for this observation before finalizing.</p>}
 {['attention','unable'].includes(s)&&<><label htmlFor={'controls-'+item.id}>Immediate controls or action taken (if any)</label><textarea id={'controls-'+item.id} maxLength={4000} value={a.controls} onChange={e=>answer(item.id,'controls',e.target.value)}/><p>Finalizing opens a follow-up action assigned to you. A supervisor or owner can reassign it.</p></>}
 </fieldset>})}<button className="primary" onClick={()=>setStep(4)}>Review observations</button></section>}
 {step===4&&<section className="work-panel"><h2>Review before finalizing</h2><p>{doc.job.address||'Job address missing'} · {doc.job.date||'Work date missing'}</p>
 {!!hasConcerns(doc)&&<div className="work-alert"><h3>{hasConcerns(doc)} unresolved concerns</h3><p>These will remain visible in the finalized record. Finalization does not resolve or authorize the work.</p></div>}
 {!!issues.length&&<div role="alert"><h3>{issues.length} items need your input</h3><ul>{issues.map((issue,i)=><li key={i}>{issue}</li>)}</ul></div>}
 <ul className="review-list">{template.items.map(i=><li key={i.id}><strong>{i.question}</strong><span>{ANSWERS[answerState(doc.answers[i.id]?.state)]}</span>{doc.answers[i.id]?.note&&<p>{doc.answers[i.id].note}</p>}</li>)}</ul>
 <label className="work-check"><input type="checkbox" checked={ack} onChange={e=>setAck(e.target.checked)}/>I acknowledge that these observations and explanations accurately reflect what I recorded. This record does not certify compliance, authorize work, or mean that unresolved concerns are safe.</label>
 <button className="primary" disabled={!ack||issues.length>0||busy} onClick={finalize}>{busy?'Finalizing...':'Finalize observations'}</button>{busy&&<p role="status">Saving changes and finalizing. Keep this page open until the finalized report appears.</p>}{error&&<div role="alert"><p>{error}</p><a href="/auth/login" target="_blank" rel="noopener noreferrer">Sign in in another tab, then retry here</a></div>}</section>}
 </fieldset><EvidencePanel reportId={report.id} editable={editable} disabled={busy} stagingBuild={stagingBuild}/><p className="work-footnote">Saved drafts can be reopened from Reports. Unsaved changes are only held on this open page; offline persistence is not provided.</p></>
}
