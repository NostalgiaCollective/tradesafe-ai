import RecordSite from '@/app/sites/RecordSite'
import {siteLink} from '@/lib/server/sites'
import {safeRedirect} from '@/lib/domain/validation'
import {notFound} from 'next/navigation'
import {briefData,briefsEnabled} from '@/lib/server/briefs'
import {workspace} from '@/lib/server/workspace'
import {pageClient} from '@/lib/server/page-auth'
import WorkspaceShell from '@/app/components/WorkspaceShell'
import {canEditReport} from '@/lib/domain/inspection'
import BriefEditor from './BriefEditor'
import BriefRecord from './BriefRecord'
export default async function BriefPage({params,searchParams}){
 if(!briefsEnabled())notFound()
 const {id}=await params,p=await searchParams,{supabase,user}=await pageClient('/briefs/'+id+'?'+new URLSearchParams(Object.entries(p).filter(([,v])=>typeof v==='string')))
 let data;try{data=await briefData(supabase,id,p.version)}catch(e){if(e.code==='not_found')notFound();throw e}
 const w=await workspace('/briefs/'+id,data.brief.company_id),editable=canEditReport(w.membership.role,user.id,data.brief.author_id)
 const linkedSite=await siteLink(supabase,id,'brief')
 const dest=safeRedirect(p.from),returnTo=/^\/(actions|my-work)\?/.test(dest)&&new URL(dest,'https://internal.invalid').searchParams.get('company')===w.company.id?dest:''
 return <WorkspaceShell {...w}>{returnTo&&<p><a href={returnTo}>{returnTo.startsWith('/my-work?')?'Back to My work':'Back to actions'}</a></p>}<RecordSite link={linkedSite} supabase={supabase} companyId={w.company.id} actor={user.id} id={id} kind="brief" editable={editable}/><p><a href={'/briefs?company='+w.company.id}>Back to daily briefs</a></p><p className="work-notice">Draft safety content — staging only, pending qualified review. Recording this brief does not certify compliance or authorize work. App roles do not establish constructor, supervisor or competent-person status under law.</p>{data.brief.lifecycle==='draft'&&!p.version?<BriefEditor returnTo={returnTo} key={id+data.brief.revision} initial={data.brief} contentCatalog={data.contentCatalog} actor={user.id} members={data.members} editable={editable} initialStep={Number(p.step)||1} previousVersion={data.versions[0]?.version}/>:<BriefRecord siteId={linkedSite?.site_id} returnTo={returnTo} {...data} actor={user.id} role={w.membership.role} editable={editable}/>}</WorkspaceShell>
}
