import Link from 'next/link'
import SignOutButton from './SignOutButton'
import {briefsEnabled} from '@/lib/server/briefs'
import WorkspaceNav from './WorkspaceNav'
import DeviceAccount from './DeviceAccount'
import HelpLink from './HelpLink'
export default function WorkspaceShell({company,companies=[],children,returnTo,user}) {
 const query=company?'?company='+company.id:''
 const demo=Boolean(user?.app_metadata?.phone_demo)
 return <DeviceAccount key={user?.id} actor={user?.id} demo={demo}><div className="work-app"><a className="work-skip" href="#work-content">Skip to content</a>
  <header className="work-header"><Link className="work-brand" href={'/dashboard'+query}>TradeSafe AI</Link><SignOutButton demo={demo}/>
   <WorkspaceNav company={company} returnTo={returnTo} sitesEnabled={briefsEnabled()} demo={demo}/>
  </header><main id="work-content" className="work-main">
   {company&&(companies.length>1?<details className="company-picker no-print"><summary>{company.name} · Switch company</summary><form action="/dashboard" className="company-switch"><label htmlFor="company-switch">Company</label><select id="company-switch" name="company" defaultValue={company.id}>{companies.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select><button type="submit">Switch company</button></form></details>:<p className="work-footnote no-print">{company.name}</p>)}
   {returnTo&&<p className="no-print"><a className="button" href={returnTo}>{returnTo.endsWith('/electrical')?'Back to electrical job':returnTo.startsWith('/sites/')?'Back to site':returnTo.startsWith('/actions?')?'Back to actions':returnTo.startsWith('/dashboard?')?'Back to today':'Back to reports'}</a></p>}
   {demo?<aside className="work-notice"><strong>DEMO — SYNTHETIC DATA</strong><p>Shared visitor activity. Use fictional details only. Other visitors can see your entries. No individual acknowledgement or safety approval is represented.</p><details><summary>Try this</summary><ol><li><a href={'/sites/'+user.app_metadata.demo_site+'/electrical'}>Open the demo electrical job</a>. Open Job details and inspect the saved entries.</li><li>Select Report a concern. Enter a fictional observation, Save concern draft, add a captioned photo if you wish, then Submit concern.</li><li>Open follow-up action, record Progress or resolution notes, then Save progress. Reload to check your entry.</li><li>Return to the electrical job and select Download electrical job record. Site evidence package contains the linked evidence separately.</li></ol><p>Changes are shared and revision checked. If another visitor saved first, review the conflict before retrying. Records are not automatically reset. Account settings, invitations and crew acknowledgements are unavailable.</p></details></aside>:company?.practice&&<p role="status"><strong>PRACTICE — synthetic workspace.</strong> Not operational site records.</p>}
   {children}
   {!demo&&company&&briefsEnabled()&&<p className="no-print"><Link href={'/device-drafts?company='+company.id}>Device drafts</Link></p>}
  {!demo&&briefsEnabled()&&<p className="no-print"><HelpLink company={company?.id}/></p>}
  </main></div></DeviceAccount>
}
