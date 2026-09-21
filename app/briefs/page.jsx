import Link from 'next/link'
import {notFound} from 'next/navigation'
import {workspace,databaseError} from '@/lib/server/workspace'
import {briefsEnabled} from '@/lib/server/briefs'
import WorkspaceShell from '@/app/components/WorkspaceShell'
import CompanyChoice from '@/app/components/CompanyChoice'
import CreateCompany from '@/app/components/CreateCompany'
import CreateBrief from './CreateBrief'
export default async function BriefsPage({searchParams}){
 if(!briefsEnabled())notFound()
 const p=await searchParams,w=await workspace('/briefs',p.company)
 if(!p.company&&w.companies.length>1)return <WorkspaceShell {...w} company={null}><CompanyChoice companies={w.companies} destination="/briefs"/></WorkspaceShell>
 if(!w.company)return <WorkspaceShell {...w}><CreateCompany actor={w.user.id}/></WorkspaceShell>
 const r=await w.supabase.from('ts_briefs').select('*').eq('company_id',w.company.id).order('updated_at',{ascending:false}).limit(50)
 if(r.error)throw databaseError(r.error)
 return <WorkspaceShell {...w}><p className="eyebrow">Staging · content pending qualified review</p><h1>Daily site briefs</h1><p>Site → Today’s work → Hazards and controls → Crew briefing → Outstanding actions.</p><p>Trade installation reports are separate records, not a complete workplace safety assessment.</p><CreateBrief companyId={w.company.id} actor={w.user.id} briefs={r.data}/><h2>Recent briefs</h2>{r.data.length?<ul className="work-list">{r.data.map(b=><li key={b.id}><Link href={'/briefs/'+b.id}><strong>{b.document.site||'Untitled site'}</strong><span>{b.document.date||'Work date not set'} · {b.lifecycle==='draft'?'Resume draft':'Recorded briefing'} · revision {b.revision}</span></Link></li>)}</ul>:<p>No daily briefs yet. Start one for today’s work.</p>}{r.data.length===50&&<p>Showing the 50 most recently updated briefs. Older records remain available through their saved links and Actions.</p>}</WorkspaceShell>
}
