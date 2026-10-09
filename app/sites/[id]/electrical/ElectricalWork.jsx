import Link from 'next/link'

// These are site-linked records, not a second job/report or safety status system.
export default function ElectricalWork({site,work,focusField}){
 const {reports,briefs,counts,mine}=work
 const back='/sites/'+site.id+'/electrical',query=new URLSearchParams({company:site.company_id,site:site.id})
 const reportUrl=r=>'/report/'+r.id+'?'+new URLSearchParams({from:back})
 const briefUrl=b=>'/briefs/'+b.id+'?'+new URLSearchParams({from:back})
 const draft=reports.find(r=>r.editable),brief=briefs.find(b=>b.editable)
 const actionUrl='/actions?'+query+'&mine='+(mine?'1':'0')
 const next=mine&&counts.outstanding?{href:actionUrl,label:'Open my assigned follow-up'}:brief?{href:briefUrl(brief),label:'Resume daily brief'}:draft?{href:reportUrl(draft),label:'Resume electrical report'}:null
 return <section aria-label="Continue this electrical job">
  <h2>Continue this job</h2>
  {next&&<Link className="button primary" href={next.href}>{next.label}</Link>}
  <nav className="work-buttons" aria-label="Electrical job journey">
   <button type="button" onClick={()=>focusField('scope')}>Job details</button>
   <button type="button" onClick={()=>focusField('inspection')}>Inspection records</button>
   <Link href={'/sites/'+site.id+'#handover-title'}>Daily handover</Link>
   {!site.archived&&<Link href={'/concerns/new?site='+site.id}>Report a concern</Link>}
  </nav>
  <p>{mine?'Your assigned follow-up':'Site follow-up'}: <Link href={actionUrl+'&status=attention'}>{counts.attention} needing attention</Link> · <Link href={actionUrl+'&status=awaiting_verification'}>{counts.awaiting_verification} awaiting verification</Link>.</p>
  {counts.outstanding===0&&<p>{mine?'No outstanding actions assigned to you at this site.':'No outstanding actions available to your account at this site.'}</p>}
  <details id="ej-saved-work"><summary>Briefs, observations and photos</summary>
   <h3>Daily briefs</h3>
   {briefs.length?<ul>{briefs.map(b=><li key={b.id}><Link href={briefUrl(b)}>{b.lifecycle==='draft'?(b.editable?'Resume brief':'View brief draft'):'Open recorded brief'}: {b.document.date||'Date not set'} · {b.document.task||'Task not entered'}</Link></li>)}</ul>:<p>No daily briefs linked to this site yet.</p>}
   <Link href={'/briefs?'+query}>View all site briefs</Link>
   <h3>Electrical reports</h3>
   {reports.length?<ul>{reports.map(r=><li key={r.id}><Link href={reportUrl(r)}>{r.lifecycle==='draft'?(r.editable?'Resume report':'View report draft'):'View finalized report'}{r.amendment_of?' (separate amendment)':''}: {r.document.job?.address||'Job details not entered'} · {r.document.job?.date||'Date not set'}</Link></li>)}</ul>:<p>No electrical reports linked to this site yet.</p>}
   <div className="work-buttons"><Link href={'/reports?'+query+'&trade=electrical'}>View all electrical reports</Link>{!site.archived&&<Link href={'/report/new?'+query+'&'+new URLSearchParams({from:back})}>New electrical report</Link>}</div>
   <p>Showing up to 8 most recently linked records of each kind available to your account. Open a report to continue observations, upload photos or open its retained PDF. Follow-up counts include all authorized site actions, including concerns.</p>
  </details>
 </section>
}
