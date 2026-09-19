import Link from 'next/link'
export default function CompanyChoice({companies,destination='/dashboard'}){
 return <section className="work-panel"><h1>Choose your company</h1><p>You belong to more than one company. Choose where you want to work; records stay separate.</p><ul className="work-list">{companies.map(c=><li key={c.id}><Link href={destination+(destination.includes('?')?'&':'?')+'company='+c.id}>{c.name}</Link></li>)}</ul></section>
}
