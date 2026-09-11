import Link from 'next/link'
import SignOutButton from './SignOutButton'
export default function WorkspaceShell({company,companies=[],children}) {
 const query=company?'?company='+company.id:''
 return <div className="work-app"><a className="work-skip" href="#work-content">Skip to content</a>
  <header className="work-header"><Link className="work-brand" href={'/dashboard'+query}>TradeSafe AI</Link><SignOutButton />
   <nav aria-label="Company work"><Link href={'/dashboard'+query}>Reports</Link><Link href={'/report/new'+query}>New report</Link><Link href={'/actions'+query}>Actions</Link><Link href={'/settings'+query}>Company & people</Link></nav>
  </header><main id="work-content" className="work-main">
   {company&&<form action="/dashboard" className="company-switch"><label htmlFor="company-switch">Company</label><select id="company-switch" name="company" defaultValue={company.id}>{companies.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select><button type="submit">Switch company</button></form>}
   {children}
  </main></div>
}
