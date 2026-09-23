'use client'
import {useState,useRef} from 'react'
import {useRouter} from 'next/navigation'
import {useOperation} from '@/lib/client/useOperation'
import {useUnsavedWarning} from '@/lib/client/useUnsavedWarning'
import {concernCommand} from '@/lib/client/concern-command'
import OperationFeedback from '@/app/components/OperationFeedback'
export default function ConcernNote({id,actor}){
 const [note,setNote]=useState(''),[uncertain,setUncertain]=useState(false),op=useOperation(),pending=useRef(null),router=useRouter()
 useUnsavedWarning(Boolean(note||uncertain))
 function save(e){e.preventDefault();void op.run('Saving correction note.',async()=>{pending.current||={id,note,requestId:crypto.randomUUID()};try{await concernCommand('note',pending.current,actor);pending.current=null;setNote('');setUncertain(false);router.refresh();return 'Correction note saved.'}catch(e){setUncertain(true);throw e}})}
 return <details><summary>Add a correction note</summary><p>The original observation remains unchanged. This note records your account and server time; it does not close the action.</p><form onSubmit={save}><label htmlFor="concern-note">Correction note</label><textarea id="concern-note" required maxLength={4000} value={note} disabled={op.busy||uncertain} onChange={e=>setNote(e.target.value)}/><button disabled={!op.ready||op.busy}>{uncertain?'Retry same note':'Save correction note'}</button><OperationFeedback operation={op}/></form></details>
}
