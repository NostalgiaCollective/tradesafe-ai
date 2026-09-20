'use client'
import {useState} from 'react'
import {ANSWERS,answerState} from '@/lib/domain/inspection'

export default function ObservationSections({template,document:doc,answer,open,setOpen,unansweredOnly,setUnansweredOnly}) {
 const [editing,setEditing]=useState(null)
 const groups=[...new Set(template.items.map(item=>item.category))]
 const unanswered=template.items.filter(item=>answerState(doc.answers[item.id]?.state)==='unanswered').length
 return <section aria-label="Observations">
  <div className="observation-tools">
   <p role="status">{template.items.length-unanswered} of {template.items.length} answered · {unanswered} unanswered</p>
   <label className="work-check"><input type="checkbox" checked={unansweredOnly} onChange={e=>{setEditing(null);setUnansweredOnly(e.target.checked)}}/>Unanswered only</label>
   <a className="button" href="#photo-evidence" onClick={()=>documentFocus('photo-evidence')}>Add or review photos</a>
  </div>
  {unansweredOnly&&unanswered===0&&<p role="status">All observations have an answer. Review still checks for required explanations.</p>}
  {groups.map((category,g)=>{
   const items=template.items.filter(item=>item.category===category)
   const remaining=items.filter(item=>answerState(doc.answers[item.id]?.state)==='unanswered').length
   return <section className="observation-section" key={category}>
    <h3><button type="button" aria-expanded={Boolean(open[category])} aria-controls={'observation-group-'+g} onClick={()=>{setEditing(null);setOpen({...open,[category]:!open[category]})}}><span>{category}</span><span>{items.length-remaining}/{items.length} answered <span aria-hidden="true">{open[category]?'−':'+'}</span></span></button></h3>
    <div id={'observation-group-'+g} hidden={!open[category]}>
     {unansweredOnly&&remaining===0&&!items.some(item=>item.id===editing)&&<p>No unanswered observations in this section.</p>}
     {items.map(item=>{
      const i=template.items.findIndex(candidate=>candidate.id===item.id),a=doc.answers[item.id]||{state:'unanswered',note:'',controls:''},state=answerState(a.state),needsNote=['attention','not_applicable','unable'].includes(state)
      return <fieldset className="work-panel observation-field" key={item.id} hidden={unansweredOnly&&state!=='unanswered'&&editing!==item.id} onFocusCapture={()=>setEditing(item.id)}>
       <legend>{i+1}. {item.question}</legend>
       <label htmlFor={'answer-'+item.id}>Observation</label><select id={'answer-'+item.id} value={state} onChange={e=>{setEditing(item.id);answer(item.id,'state',e.target.value)}}>{Object.entries(ANSWERS).map(([value,label])=><option value={value} key={value}>{label}</option>)}</select>
       {unansweredOnly&&state!=='unanswered'&&<p className="work-footnote">Answered. Kept here while you edit; other answered observations are hidden.</p>}
       {needsNote?<><label htmlFor={'note-'+item.id}>Explanation (required)</label><textarea id={'note-'+item.id} maxLength={4000} value={a.note} onChange={e=>answer(item.id,'note',e.target.value)} aria-describedby={!a.note?.trim()?'note-help-'+item.id:undefined}/>{!a.note?.trim()&&<p id={'note-help-'+item.id}>Explain what you observed or why this check could not be completed.</p>}</>:<details open={Boolean(a.note)||undefined}><summary>Notes (optional)</summary><label htmlFor={'note-'+item.id}>Notes for observation {i+1}</label><textarea id={'note-'+item.id} maxLength={4000} value={a.note} onChange={e=>answer(item.id,'note',e.target.value)}/></details>}
       {['attention','unable'].includes(state)&&<><label htmlFor={'controls-'+item.id}>Immediate controls or action taken (optional)</label><textarea id={'controls-'+item.id} maxLength={4000} value={a.controls} onChange={e=>answer(item.id,'controls',e.target.value)}/><p>Finalizing creates a follow-up action. It does not resolve this concern.</p></>}
      </fieldset>
     })}
    </div>
   </section>
  })}
 </section>
}
function documentFocus(id){globalThis.document.getElementById(id)?.focus({preventScroll:true})}
