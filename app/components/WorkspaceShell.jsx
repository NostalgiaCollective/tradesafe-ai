import Link from 'next/link'
import SignOutButton from './SignOutButton'
export default function WorkspaceShell({company,companies=[],children,returnTo}) {
 const query=company?'?company='+company.id:''
 return <div className="work-app"><a className="work-skip" href="#work-content">Skip to content</a>
  <header className="work-header"><Link className="work-brand" href={'/dashboard'+query}>TradeSafe AI</Link><SignOutButton />
   <nav aria-label="Company work"><Link href={returnTo?.startsWith('/dashboard?')?returnTo:'/dashboard'+query}>{company?'Reports':'My companies'}</Link>{company&&<><Link href={'/report/new'+query}>New report</Link><Link href={'/actions'+query}>Assigned to me</Link><Link href={'/settings'+query}>Company & people</Link></>}<Link href="/join">Join a crew</Link></nav>
  </header><main id="work-content" className="work-main">
   {company&&(companies.length>1?<details className="company-picker no-print"><summary>{company.name} · Switch company</summary><form action="/dashboard" className="company-switch"><label htmlFor="company-switch">Company</label><select id="company-switch" name="company" defaultValue={company.id}>{companies.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select><button type="submit">Switch company</button></form></details>:<p className="work-footnote no-print">{company.name}</p>)}
   {returnTo&&<p className="no-print"><a className="button" href={returnTo}>{returnTo.startsWith('/actions?')?'Back to actions':'Back to reports'}</a></p>}
   {children}
  </main></div>
}
