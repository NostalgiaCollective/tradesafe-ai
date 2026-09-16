'use client'
import { useRef,useState } from 'react'
import Link from 'next/link'
import { command } from '@/lib/client/commands'
import { canVerify,ACTION_STATES } from '@/lib/domain/inspection'
function Action({initial,members,events,role,actor,companyId,onSaved,onSaving}) {
 const [action,setAction]=useState(initial),[edit,setEdit]=useState(initial),[error,setError]=useState(''),[busy,setBusy]=useState(false),[history,setHistory]=useState(events),[updated,setUpdated]=useState(false)
 const pending=useRef(null),lock=useRef(false)
 const [uncertain,setUncertain]=useState(false)
 const editable=canVerify(role)||(actor===action.responsible_id&&action.state!=='closed')
 async function save(e){e.preventDefault();if(lock.current)return;lock.current=true;setBusy(true);setError('');setUpdated(false);onSaving();try{
  pending.current ||= {companyId,id:action.id,revision:action.revision,requestId:crypto.randomUUID(),state:edit.state,controls:edit.controls,responsibleId:edit.responsible_id,targetDate:edit.target_date||'',resolution:edit.resolution}
  const value=await command('update_action',pending.current);pending.current=null;setUncertain(false)
  setAction(value);setEdit(value);setHistory([]);setUpdated(true);onSaved(value)
 }catch(e){setError(e.message);if(['invalid_request','denied','conflict','immutable'].includes(e.code)){pending.current=null;setUncertain(false)}else setUncertain(true)}finally{lock.current=false;setBusy(false)}}
 const name=id=>members.find(m=>m.user_id===id)?.display_name||id
 return <article className="work-panel" id={'action-'+action.id}><h2>{action.observation}</h2><p><strong>{action.state.replaceAll('_',' ')}</strong> · <Link href={'/report/'+action.report_id}>Original report</Link></p>
 {action.verified_at&&<p>Verified by {name(action.verified_by)} on {new Date(action.verified_at).toLocaleString('en-CA')}</p>}
 <form onSubmit={save}><fieldset disabled={!editable||busy||uncertain} className="work-fieldset">
 <label htmlFor={'controls-'+action.id}>Immediate controls or action taken</label><textarea id={'controls-'+action.id} value={edit.controls} maxLength={4000} onChange={e=>setEdit({...edit,controls:e.target.value})}/>
 <label htmlFor={'responsible-'+action.id}>Responsible member</label><select id={'responsible-'+action.id} value={edit.responsible_id} disabled={!canVerify(role)} onChange={e=>setEdit({...edit,responsible_id:e.target.value})}>{members.filter(m=>m.active||m.user_id===edit.responsible_id).map(m=><option key={m.user_id} value={m.user_id} disabled={!m.active}>{m.display_name}{m.active?'':' (removed — reassign)'}</option>)}</select>
 <label htmlFor={'target-'+action.id}>Target date (optional)</label><input id={'target-'+action.id} type="date" value={edit.target_date||''} onChange={e=>setEdit({...edit,target_date:e.target.value})}/>
 <label htmlFor={'state-'+action.id}>Action state</label><select id={'state-'+action.id} value={edit.state} onChange={e=>setEdit({...edit,state:e.target.value})}>{ACTION_STATES.map(s=><option key={s} value={s} disabled={(s==='closed'&&!canVerify(role))||(action.state==='closed'&&!['closed','open'].includes(s))}>{s.replaceAll('_',' ')}</option>)}</select>
 <label htmlFor={'resolution-'+action.id}>Resolution notes (required for verification)</label><textarea id={'resolution-'+action.id} maxLength={4000} required={edit.state==='closed'} value={edit.resolution} onChange={e=>setEdit({...edit,resolution:e.target.value})}/>
 {edit.state==='closed'&&action.state!=='closed'&&<p>Saving records you as the verification actor. Your app role does not establish statutory competence.</p>}
 {action.state==='closed'&&<p>Select Open to reopen this action. Previous resolution and verification remain in its history.</p>}
 </fieldset>{uncertain&&<p>Retry the previous update before editing it further. Its result has not been confirmed.</p>}<button disabled={busy||!editable||(action.state==='closed'&&edit.state!=='open')}>{busy?'Saving...':action.state==='closed'?'Reopen action':'Save action update'}</button>{busy&&<p role="status">Saving action update. Keep this page open.</p>}{updated&&<p role="status">Action update saved.</p>}{error&&<div role="alert"><p>{error}</p><a href="/auth/login" target="_blank" rel="noopener noreferrer">Sign in in another tab, then retry here</a></div>}</form>
 <details><summary>Action history</summary>{history.length?<ol>{[...history].reverse().map(e=><li key={e.id}><strong>{e.kind.replaceAll('_',' ')}</strong> · {name(e.actor_id)} · {new Date(e.occurred_at).toLocaleString('en-CA')}<p>{e.before_value?.state?e.before_value.state+' → ':''}{e.after_value?.state}</p>{e.after_value?.resolution&&<p>Resolution: {e.after_value.resolution}</p>}{e.after_value?.controls&&<p>Controls: {e.after_value.controls}</p>}{e.after_value?.verified_at&&<p>Verified by {name(e.after_value.verified_by)} at {e.after_value.verified_at}</p>}</li>)}</ol>:<p>{updated?'Update saved. ':'No history entries loaded. '}<button onClick={()=>window.location.reload()}>Reload recorded history</button></p>}</details>
 </article>
}
export default function ActionList({initial,members,events,actor,role,companyId}) {
 const [mine,setMine]=useState(true),[showClosed,setShowClosed]=useState(false),[actions,setActions]=useState(initial),[message,setMessage]=useState('')
 const filtered=actions.filter(a=>(!mine||a.responsible_id===actor)&&(showClosed||a.state!=='closed'))
 const saved=value=>{setActions(rows=>rows.map(a=>a.id===value.id?value:a));setMessage('Action update saved. Current filters may hide a closed or reassigned action.')}
 return <><div className="work-filters"><label className="work-check"><input type="checkbox" checked={mine} onChange={e=>setMine(e.target.checked)}/>Assigned to me</label><label className="work-check"><input type="checkbox" checked={showClosed} onChange={e=>setShowClosed(e.target.checked)}/>Include closed actions</label></div>
 {message&&<p role="status">{message}</p>}
 {!filtered.length?<section className="work-panel"><h2>No matching actions</h2><p>Actions are created when a report is finalized with a concern. Clear the filters to see other company actions.</p></section>:filtered.map(a=><Action key={a.id} initial={a} members={members} events={events.filter(e=>e.entity_id===a.id)} actor={actor} role={role} companyId={companyId} onSaved={saved} onSaving={()=>setMessage('')}/>)}</>
}
