'use client'
import {useRef,useState} from 'react'
import {useRouter} from 'next/navigation'
import {siteCommand} from '@/lib/client/site-command'
import {useOperation} from '@/lib/client/useOperation'
import {useUnsavedWarning} from '@/lib/client/useUnsavedWarning'
import OperationFeedback from '@/app/components/OperationFeedback'
export default function SiteForm({site,companyId,actor,canArchive=false}){
 const router=useRouter(),operation=useOperation(),attempt=useRef(null)
 const [document,setDocument]=useState(site?.document||{name:'',address:'',instructions:''}),[revision,setRevision]=useState(site?.revision),[dirty,setDirty]=useState(false),[blocked,setBlocked]=useState(false),[uncertain,setUncertain]=useState(false)
 useUnsavedWarning(dirty||uncertain)
 function change(k,v){setDocument(d=>({...d,[k]:v}));setDirty(true)}
 function run(command){void operation.run(command==='archive'?'Archiving site.':'Saving site.',async()=>{
  attempt.current||={command,payload:{companyId,id:site?.id||crypto.randomUUID(),revision,requestId:crypto.randomUUID(),...(command==='save'||command==='create'?{document}:{})}}
  try{const r=await siteCommand(attempt.current.command,attempt.current.payload,actor);attempt.current=null;setUncertain(false);setDirty(false);setRevision(r.revision);if(!site)router.push('/sites/'+r.id);else router.refresh();return command==='archive'?'Site archived. Existing work and history remain available.':command==='restore'?'Site restored.':'Site saved.'}
  catch(e){if(e.code==='invalid_request'){attempt.current=null;setUncertain(false)}else setUncertain(true);if(['conflict','denied','site_archived','account_changed'].includes(e.code))setBlocked(true);throw e}
 })}
 return <form onSubmit={e=>{e.preventDefault();run(site?'save':'create')}}><fieldset className="work-fieldset" disabled={!operation.ready||operation.busy||blocked||uncertain||site?.archived}><label htmlFor="site-name">Site name</label><input id="site-name" required maxLength={200} value={document.name} onChange={e=>change('name',e.target.value)}/><label htmlFor="site-address">Address or location description</label><textarea id="site-address" required maxLength={1000} value={document.address} onChange={e=>change('address',e.target.value)}/><label htmlFor="site-instructions">Site instructions (optional)</label><textarea id="site-instructions" maxLength={4000} value={document.instructions} onChange={e=>change('instructions',e.target.value)}/><p>Company instructions, not professionally approved safety content. Changes apply to future setup; recorded history stays unchanged.</p></fieldset><p role="status">{operation.busy?'Saving':dirty?'Unsaved changes':site?'Saved site details':'Not yet created'}</p>{!site?.archived&&<button className={site?'':'primary'} disabled={!operation.ready||operation.busy||blocked}>{operation.busy?'Saving…':uncertain?'Retry site operation':site?'Save site details':'Create site'}</button>}<OperationFeedback operation={operation}/>{uncertain&&<p>Your entries remain here. Retry the same operation to confirm its result. Do not create another site.</p>}{blocked&&<a href={'/sites/'+site?.id} target="_blank" rel="noopener noreferrer">Open latest site in another tab to compare</a>}{canArchive&&<details><summary>{site.archived?'Restore site':'Archive site'}</summary><p>Archiving blocks new briefs, reports and associations from this site. Existing drafts, corrections and action follow-up stay available.</p><button type="button" disabled={!operation.ready||operation.busy||dirty||blocked||uncertain} onClick={()=>run(site.archived?'restore':'archive')}>{site.archived?'Restore site':'Confirm archive'}</button>{dirty&&<p>Save your changes first.</p>}</details>}</form>
}
