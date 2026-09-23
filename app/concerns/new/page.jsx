import Link from 'next/link'
import {pageClient} from '@/lib/server/page-auth'
import {workspace} from '@/lib/server/workspace'
import {loadSite} from '@/lib/server/sites'
import WorkspaceShell from '@/app/components/WorkspaceShell'
import ConcernForm from '../ConcernForm'
export default async function NewConcern({searchParams}){
 const p=await searchParams,{supabase}=await pageClient('/concerns/new?'+new URLSearchParams({site:p.site||''})),site=await loadSite(supabase,p.site),w=await workspace('/concerns/new?site='+site.id,site.company_id)
 return <WorkspaceShell {...w}><Link href={'/sites/'+site.id}>Back to site</Link>{site.archived?<><h1>Site archived</h1><p>New concerns cannot be started here. Existing work and follow-up remain accessible.</p></>:<ConcernForm site={site} actor={w.user.id}/>}</WorkspaceShell>
}
