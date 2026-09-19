import Link from 'next/link'
export default function PendingInvitations({invitations=[]}){
 if(!invitations.length)return null
 return <section className="work-panel"><h2>You have a company invitation</h2><ul>{invitations.map(i=><li key={i.id}>{i.company_name} · {i.role} · Expires {new Date(i.expires_at).toLocaleDateString('en-CA')}</li>)}</ul><p>Open the private link your owner shared, or resume the invitation opened in this tab. You do not need to create a company to join a crew.</p><Link className="primary button" href="/join">Continue joining your crew</Link></section>
}
