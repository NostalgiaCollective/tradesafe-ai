import Link from 'next/link'
export default function SiteContext({link}){
 if(!link)return null
 return <aside className="work-notice no-print"><Link href={'/sites/'+link.site_id}>Back to site: {link.site.document.name}</Link>{link.site.archived&&<p>Archived site. Existing records and follow-up remain available.</p>}<details><summary>Site details captured for this record</summary><p>{link.snapshot.name} — {link.snapshot.address}</p><p>{link.snapshot.instructions||'No site instructions captured.'}</p><p>{link.association==='explicit_existing'?'Explicit association made later; these are site details at linking, not invented historical values.':'Site details captured at creation; later site edits do not change them.'}</p></details></aside>
}
