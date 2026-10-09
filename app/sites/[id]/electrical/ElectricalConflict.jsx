import {electricalFields} from '@/lib/domain/electrical-job.mjs'
export default function ElectricalConflict({record}){
 const {d,latest,operation,compare,resolve}=record
 const fields=[...electricalFields,{key:'certificatePhoto',label:'Certificate photo reference'},{key:'defectPhoto',label:'Defect photo reference'}]
 return <section aria-label="Resolve electrical job conflict"><p role="alert">Server changes require review. Your entered text is still here. No automatic merge or overwrite will occur.</p>
 <button type="button" disabled={operation.busy} onClick={()=>void compare()}>Compare with latest server entries</button>
 {latest&&<><h3>Server revision {latest.revision}</h3><p>Compare all differences below. Keeping your entries makes them an unsaved proposal against this revision; review every field before saving. A further server edit will cause another conflict.</p>
 <ul>{fields.filter(f=>d[f.key]!==latest.document[f.key]).map(f=><li key={f.key}><strong>{f.label}</strong><p>Your entry: {d[f.key]||'Not entered'}</p><p>Server entry: {latest.document[f.key]||'Not entered'}</p></li>)}</ul>
 <details><summary>Server review and credential records</summary><p>{JSON.stringify({internalReview:latest.internal_review,credentialCheck:latest.credential_check})}</p></details>
 <div className="work-buttons"><button type="button" disabled={operation.busy} onClick={()=>resolve(false)}>Keep my entries for review</button><button type="button" disabled={operation.busy} onClick={()=>resolve(true)}>Use server entries</button></div></>}
 </section>
}
