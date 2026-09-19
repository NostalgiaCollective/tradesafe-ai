'use client'
import { useEffect,useRef,useState,useSyncExternalStore } from 'react'
import Link from 'next/link'
import { useDraft } from '@/lib/client/useDraft'
import { command } from '@/lib/client/commands'
import { ANSWERS,answerState,finalizationChecklist,hasConcerns } from '@/lib/domain/inspection'
import EvidencePanel from './EvidencePanel'
import {reportState} from '@/lib/client/report-state'
const subscribe=()=>()=>{},clientReady=()=>true,serverReady=()=>false
const stages=[[2,'Job'],[3,'Observations'],[5,'Review'],[4,'Finalize']]

export default function ReportEditor({report,actor,editable,initialStep=2,stagingBuild=null,returnTo}) {
 const ready=useSyncExternalStore(subscribe,clientReady,serverReady)
 const draft=useDraft(report,actor),[navigation,setNavigation]=useState({step:initialStep,target:null}),[ack,setAck]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('')
 const [photos,setPhotos]=useState({loading:true,failed:false,busy:false,selected:false,ready:0,pending:0})
 const step=navigation.step,index=stages.findIndex(([n])=>n===step)
 function setStep(next,target='stage-heading'){setNavigation({step:next,target});const query=new URLSearchParams(window.location.search);query.set('step',String(next));window.history.replaceState(null,'','?'+query)}
 useEffect(()=>{if(navigation.target){const field=document.getElementById(navigation.target);field?.focus({preventScroll:true});field?.scrollIntoView({block:'start'})}},[navigation])
 const finalizeRequest=useRef(null),finalizeLock=useRef(false)
 const [uncertain,setUncertain]=useState(false)
 const doc=draft.document,template=report.template_snapshot,issues=finalizationChecklist(doc,template)
 const answer=(id,key,value)=>draft.change({...doc,answers:{...doc.answers,[id]:{state:'unanswered',note:'',controls:'',...doc.answers[id],[key]:value}}})
 const photoBlocked=photos.loading||photos.failed||photos.busy||photos.selected||photos.pending>0
 function openFinalized(){
  // Fetch the authoritative locked snapshot; PDF preparation is a separate operation.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.assign('/report/'+report.id+'?'+new URLSearchParams({from:returnTo})+'#report-pdf')
 }
 async function finalize(){if(finalizeLock.current||photoBlocked||issues.length||!ack)return;finalizeLock.current=true;setBusy(true);setError('');try{
  if(finalizeRequest.current){
   const state=await reportState(report.id,actor)
   if(state.lifecycle==='finalized'){openFinalized();return}
   if(state.revision!==draft.revision.current){setError('A newer draft was saved. Keep this page open and compare the latest saved version in another tab. No observations were merged.');return}
  }
  if(!await draft.flush()){setError('Your changes are not saved yet. Use Retry saving above, then finalize.');return}
  finalizeRequest.current ||= crypto.randomUUID()
  await command('finalize',{id:report.id,companyId:report.company_id,revision:draft.revision.current,requestId:finalizeRequest.current,acknowledged:ack},actor)
  openFinalized()
 }catch(e){if(['incomplete','evidence_pending','invalid_request'].includes(e.code)){finalizeRequest.current=null;setUncertain(false);setError(e.message);return}setUncertain(true);setError(e.message+' Check the server result before retrying. Keep this page open.');try{const state=await reportState(report.id,actor);if(state.lifecycle==='finalized')openFinalized()}catch{/* Keep the original bounded failure visible. */}}finally{finalizeLock.current=false;setBusy(false)}}
 return <><div className="work-title"><div><p className="eyebrow">Draft · {template.trade}</p><h1>{doc.job.address||'New report'}</h1></div><div className="save-state" role="status" aria-live="polite">{ready?draft.status:'Loading save controls'}</div></div>
 <p className="work-footnote">Changes save automatically. Wait for Saved before leaving this page.</p>
 <p className="work-notice">Questions pending qualified review. This report records observations; it does not certify compliance or authorize work.</p>
 {report.amendment_of&&<p className="work-notice">Amendment to <Link href={'/report/'+report.amendment_of}>the original report</Link>: {report.amendment_reason}. Review each answer. Photos are separate from the original.</p>}
 {!editable&&<p role="alert">You can read this draft. Its author, a supervisor or an owner can edit it.</p>}
 {draft.error&&<div className="work-alert" role="alert"><p>{draft.error}</p><div className="work-buttons"><button onClick={draft.save} disabled={draft.blocked.current}>Retry saving</button><a href={'/auth/login?'+new URLSearchParams({redirect:'/report/'+report.id+'?step='+step})} target="_blank" rel="noopener noreferrer">Sign in in another tab</a></div><details><summary>More recovery options</summary><a href={'/report/'+report.id} target="_blank" rel="noopener noreferrer">Open latest saved version</a><button onClick={()=>{if(confirm('Discard unsaved changes and load the latest saved version?'))window.location.reload()}}>Discard changes and reload</button></details></div>}
 <nav className="work-steps journey-steps" aria-label="Report steps">{stages.map(([n,label],i)=><button type="button" key={n} disabled={busy} aria-current={step===n?'step':undefined} onClick={()=>setStep(n)}>{i+1}. {label}</button>)}</nav>
 <h2 id="stage-heading" tabIndex={-1}>Step {index+1} of 4: {stages[index][1]}</h2>
 <fieldset disabled={!ready||!editable||busy||uncertain} className="work-fieldset">
 {step===2&&<section className="work-panel"><h3>Where and when was the work?</h3>
 {[['address','Job address','text'],['client','Client or job reference (optional)','text'],['date','Work date','date']].map(([key,label,type])=><div key={key}><label htmlFor={'job-'+key}>{label}</label><input id={'job-'+key} type={type} autoComplete={key==='address'?'street-address':'off'} maxLength={1000} value={doc.job[key]} onChange={e=>draft.change({...doc,job:{...doc.job,[key]:e.target.value}})} aria-describedby={key!=='client'&&!doc.job[key]?.trim()?'job-'+key+'-help':undefined}/>{key!=='client'&&!doc.job[key]?.trim()&&<p id={'job-'+key+'-help'}>{label} is required before finalizing.</p>}</div>)}
 <details><summary>Company details saved with this report</summary><p>{report.business_snapshot.name}. Company setting changes apply to future reports.</p>{Object.entries(report.business_snapshot.details||{}).filter(([key,value])=>['contact_email','contact_phone','address','license_number','ecra_number','coq_number','cot_cert_number','wah_cert_number','wsib_number','liability_policy_number'].includes(key)&&value).map(([key,value])=><p key={key}>{key.replaceAll('_',' ')}: {String(value)}</p>)}</details>
 <div className="journey-actions"><button type="button" onClick={()=>setStep(3)} className="primary">Continue to observations</button></div></section>}
 {step===3&&<section><p>{template.items.filter(i=>answerState(doc.answers[i.id]?.state)!=='unanswered').length} of {template.items.length} answered · {hasConcerns(doc)} concerns. You can return to any answer.</p><a className="button" href="#photo-evidence">Add or review photos</a>
 {template.items.map((item,i)=>{const a=doc.answers[item.id]||{state:'unanswered',note:'',controls:''},s=answerState(a.state),needsNote=['attention','not_applicable','unable'].includes(s);return <fieldset className="work-panel" key={item.id}><legend>{i+1}. {item.question}</legend><p className="work-footnote">{item.category}</p>
 <label htmlFor={'answer-'+item.id}>Observation</label><select id={'answer-'+item.id} value={s} onChange={e=>answer(item.id,'state',e.target.value)}>{Object.entries(ANSWERS).map(([v,label])=><option value={v} key={v}>{label}</option>)}</select>
 {needsNote?<><label htmlFor={'note-'+item.id}>Explanation (required)</label><textarea id={'note-'+item.id} maxLength={4000} value={a.note} onChange={e=>answer(item.id,'note',e.target.value)} aria-describedby={!a.note?.trim()?'note-help-'+item.id:undefined}/>{!a.note?.trim()&&<p id={'note-help-'+item.id}>Explain what you observed or why this check could not be completed.</p>}</>:<details open={Boolean(a.note)||undefined}><summary>Notes (optional)</summary><label htmlFor={'note-'+item.id}>Notes for observation {i+1}</label><textarea id={'note-'+item.id} maxLength={4000} value={a.note} onChange={e=>answer(item.id,'note',e.target.value)}/></details>}
 {['attention','unable'].includes(s)&&<><label htmlFor={'controls-'+item.id}>Immediate controls or action taken (optional)</label><textarea id={'controls-'+item.id} maxLength={4000} value={a.controls} onChange={e=>answer(item.id,'controls',e.target.value)}/><p>Finalizing creates a follow-up action. It does not resolve this concern.</p></>}
 </fieldset>})}</section>}
 </fieldset>
 {/* Keep the file input mounted so navigation never discards a selected photo. */}
 <div hidden={step!==3}><EvidencePanel reportId={report.id} actor={actor} editable={editable} disabled={busy||uncertain} stagingBuild={stagingBuild} onStateChange={setPhotos}/><div className="journey-actions"><button type="button" disabled={busy} onClick={()=>setStep(2)}>Back to job</button><button type="button" className={photos.selected||photos.busy?'':'primary'} disabled={busy||photos.busy} onClick={()=>setStep(5)}>Continue to review</button></div></div>
 {(step===5||step===4)&&<section className="work-panel"><h3>{step===5?'Review your observations':'Finalize this report'}</h3><p>{doc.job.address||'Job address missing'} · {doc.job.date||'Work date missing'}</p>
 {!!hasConcerns(doc)&&<div className="work-alert"><h3>{hasConcerns(doc)} concerns will remain recorded</h3><p>Finalization does not resolve these concerns or authorize the work.</p></div>}
 {!!issues.length&&<div className="work-alert" role="alert"><h3>{issues.length} items need your input</h3><ul>{issues.map(issue=><li key={issue.field}><a href={'?step='+issue.step+'#'+issue.field} onClick={e=>{e.preventDefault();setStep(issue.step,issue.field)}}>{issue.message}</a></li>)}</ul></div>}
 <p>{photos.ready} saved photos. {photos.ready===0&&!photoBlocked?'Photos are optional.':''} <a href="?step=3#photo-evidence" onClick={e=>{e.preventDefault();setStep(3,'photo-evidence')}}>Review photos and captions</a></p>
 {photoBlocked&&<p role="alert">{photos.loading?'Checking saved photos…':photos.busy?'Wait for the photo operation to finish.':photos.selected?'A photo or caption has not been saved. Upload it or clear the selection before finalizing.':photos.failed?'The photo list could not be checked. Return to Observations and refresh photos before finalizing.':'An upload is incomplete. Return to Observations to retry or remove the photo.'}</p>}
 {step===5&&<ul className="review-list">{template.items.map((i,n)=><li key={i.id}><strong>{n+1}. {i.question}</strong><span>{ANSWERS[answerState(doc.answers[i.id]?.state)]}</span>{doc.answers[i.id]?.note&&<p>{doc.answers[i.id].note}</p>}{doc.answers[i.id]?.controls&&<p>Action taken: {doc.answers[i.id].controls}</p>}<a href={'?step=3#answer-'+i.id} onClick={e=>{e.preventDefault();setStep(3,'answer-'+i.id)}}>Edit observation {n+1}</a></li>)}</ul>}
 {step===4&&<><div className="work-notice"><h3>What happens when you finalize?</h3><p>This locks the saved observations and photos. You can then open a PDF. Corrections need a separate amendment; the original report and evidence remain unchanged.</p></div>
 <label className="work-check"><input type="checkbox" checked={ack} disabled={!editable||busy} onChange={e=>setAck(e.target.checked)}/>I confirm these observations and explanations accurately reflect what I recorded. This does not certify compliance, authorize work, or mean unresolved concerns are safe.</label>
 <div className="journey-actions"><button type="button" disabled={busy} onClick={()=>setStep(5)}>Back to review</button><button type="button" className="primary" disabled={!editable||!ack||issues.length>0||photoBlocked||busy} onClick={finalize}>{busy?'Checking and finalizing…':uncertain?'Check finalization and retry':'Finalize report'}</button></div>{busy&&<p role="status">Saving and finalizing your report. Keep this page open.</p>}{error&&<div role="alert"><p>{error}</p><a href={'/auth/login?'+new URLSearchParams({redirect:'/report/'+report.id+'?step=4'})} target="_blank" rel="noopener noreferrer">Sign in in another tab, then retry here</a><p><a href={'/report/'+report.id} target="_blank" rel="noopener noreferrer">Open latest saved version</a></p></div>}</>}{step===5&&<div className="journey-actions"><button type="button" onClick={()=>setStep(3)}>Back to observations</button><button type="button" className="primary" onClick={()=>setStep(4)}>Continue to finalize</button></div>}</section>}
 <p className="work-footnote">Find this draft in Reports. Unsaved changes and selected files stay only on this open page; offline persistence is not provided.</p></>
}
