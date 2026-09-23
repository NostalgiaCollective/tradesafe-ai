'use client'
import {useRef,useState} from 'react'
import {useRouter} from 'next/navigation'
import {siteCommand} from '@/lib/client/site-command'
import {useOperation} from '@/lib/client/useOperation'
import OperationFeedback from '@/app/components/OperationFeedback'
export default function LinkRecord({sites,companyId,actor,id,kind}){
 const [site,setSite]=useState(''),attempt=useRef(null),operation=useOperation(),router=useRouter()
 return <details><summary>Associate with a site</summary><p>This explicit association helps retrieval. It does not rewrite the original record or establish historical site details.</p><form onSubmit={e=>{e.preventDefault();void operation.run('Linking record.',async()=>{attempt.current||={companyId,id,siteId:site,requestId:crypto.randomUUID()};await siteCommand('link_'+kind,attempt.current,actor);router.refresh();return 'Record linked.'})}}><label htmlFor="link-site">Site</label><select id="link-site" value={site} required disabled={!operation.ready||operation.busy||!!attempt.current} onChange={e=>setSite(e.target.value)}><option value="">Choose an active site</option>{sites.map(s=><option key={s.id} value={s.id}>{s.document.name} — {s.document.address}</option>)}</select><button disabled={!site||!operation.ready||operation.busy}>{attempt.current?'Retry association':'Link this record'}</button><OperationFeedback operation={operation}/></form></details>
}
