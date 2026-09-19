'use client'
import Link from 'next/link'
import {usePathname} from 'next/navigation'
export default function WorkspaceNav({company,returnTo}){
 const path=usePathname(),query=company?'?company='+company.id:''
 const links=company?[['/dashboard','Today'],['/reports','Reports'],['/actions','Actions'],['/settings','Settings']]:[['/dashboard','My companies']]
 return <nav aria-label="Company work">{links.map(([to,label])=><Link key={to} aria-current={path===to||(to==='/reports'&&path.startsWith('/report/'))?'page':undefined} href={to==='/reports'&&returnTo?.startsWith('/reports?')?returnTo:to+query}>{label}</Link>)}</nav>
}
