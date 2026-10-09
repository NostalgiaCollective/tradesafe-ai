import Link from 'next/link'
import {notFound} from 'next/navigation'
import {pageClient} from '@/lib/server/page-auth'
import {workspace} from '@/lib/server/workspace'
import {electricalJobData,electricalWorkData} from '@/lib/server/electrical-job'
import WorkspaceShell from '@/app/components/WorkspaceShell'
import ContentSources from '@/app/briefs/ContentSources'
import ElectricalJob from './ElectricalJob'
export default async function Page({params}){
 const {id}=await params,{supabase}=await pageClient('/sites/'+id+'/electrical');let data
 try{data=await electricalJobData(supabase,id)}catch(e){if(e.code==='not_found')notFound();throw e}
 const w=await workspace('/sites/'+id+'/electrical',data.site.company_id)
 data.work=await electricalWorkData(supabase,data.site,w.user.id,w.membership.role)
 return <WorkspaceShell {...w}><Link href={'/sites/'+id}>Back to site: {data.site.document.name}</Link><h1>Electrical job</h1><p>{data.site.document.address}</p><p className="work-notice">Ontario residential contractor documentation. Draft prompts await qualified review. Other settings use the general site records; recording here does not determine which law applies.</p><ElectricalJob {...data} actor={w.user.id} canEdit={w.membership.role!=='worker'&&!data.site.archived}/><details><summary>Electrical sources and review</summary><ContentSources content={data.content} prompts={data.content.payload.prompts}/><Link href={'/brief-content?'+new URLSearchParams({company:w.company.id,version:data.content.version})}>Open qualified content review record</Link></details></WorkspaceShell>
}
