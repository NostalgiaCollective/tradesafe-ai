'use client'
import {useContext,useEffect,useRef,useState} from 'react'
import {DemoSessionContext} from '@/app/components/DeviceAccount'
import {request} from '@/lib/client/request.mjs'
import {todayInZone} from '@/lib/domain/handover.mjs'
export default function SitePackage({site,actor}){
 const demo=useContext(DemoSessionContext)
 const [errorCode,setErrorCode]=useState('')
 const [start,setStart]=useState(''),[end,setEnd]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[saved,setSaved]=useState(false)
 const [preparation,setPreparation]=useState(null),[changed,setChanged]=useState(false),lock=useRef(false),generation=useRef(null)
 useEffect(()=>{queueMicrotask(()=>{setStart(todayInZone());setEnd(todayInZone())})},[])
 const endpoint='/api/sites/'+site.id+'/package',headers={'x-expected-actor':actor}
 const query=()=>new URLSearchParams({start,end})
 function editDate(set,value){set(value);setSaved(false);setPreparation(null);generation.current=null;setChanged(false);setError('')}
 async function run(fn){if(lock.current)return;lock.current=true;setBusy(true);setError('');setErrorCode('');try{await fn()}catch(e){setError(e.message);setErrorCode(e.code);if(['package_changed','conflict'].includes(e.code))setChanged(true)}finally{lock.current=false;setBusy(false)}}
 async function check(){const data=await request(endpoint+'?'+query(),{headers});setPreparation(data);return data}
 async function download(e){e.preventDefault();await run(async()=>{
  setSaved(false)
  // Preflight never generates PDFs. Each missing PDF is a separate bounded request.
  if(!generation.current){const data=await check();if(data.missingReports.length)return;generation.current=crypto.randomUUID()}
  const p=query();p.set('generation',generation.current)
  const blob=await request(endpoint+'?'+p,{method:'POST',headers,timeoutMs:120000},'blob'),url=URL.createObjectURL(blob),a=document.createElement('a')
  a.href=url;a.download='site-evidence-'+start+'-'+end+'.zip';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setSaved(true)
  // Refresh the receipt list separately; a list error never erases download success.
  try{await check()}catch{setError('The package was received, but the retained list could not refresh. Use Find retained packages to retry.')}
 })}
 async function prepareNext(){await run(async()=>{const next=preparation?.missingReports[0];if(!next)return;await request('/api/reports/'+next.id+'/exports',{method:'POST',headers,timeoutMs:90000});await check()})}
 return <section aria-labelledby="site-package"><h2 id="site-package" tabIndex={-1}>Evidence package</h2><p>Download permitted site records and retained evidence for a date range. Original reports, separate amendments and completion updates remain distinct.</p>
 <details><summary>What is included and package limits</summary><p>Dates use America/Toronto. Briefing versions use recorded time; concerns use submission time; reports and amendments use finalization time; action history uses event time. The latest retained electrical-job revision at generation is included as context, even outside the range. Selected actions include their history and completion photos through the cutoff. Current follow-up is labelled as of generation, not historical status. Parent references outside the range are identified.</p><p>Maximum 31 days, 200 selected activity records, 100 files and 16 MiB per file. Retained owner/supervisor packages must fit 50 MiB in the existing private storage; one-time worker packages have a 64 MiB total limit. All attachments must pass integrity checks. Missing PDFs must be prepared individually before downloading. No partial package is reported as complete.</p><p>Owner and supervisor generations are retained privately for the creating account. Retry downloads the same generation; choose a new generation to include later edits. Worker downloads contain only permitted records and are not retained as package generations. This is not certification or an atomic database-and-storage snapshot.</p></details>
 <form onSubmit={download} className="handover-filters"><div><label htmlFor="package-from">Package from</label><input id="package-from" type="date" required value={start} disabled={busy} onChange={e=>editDate(setStart,e.target.value)}/></div><div><label htmlFor="package-through">Package through</label><input id="package-through" type="date" required value={end} disabled={busy} onChange={e=>editDate(setEnd,e.target.value)}/></div><button disabled={busy||changed}>{busy?'Preparing evidence package…':error?'Retry evidence package':'Download evidence package'}</button></form>
 {busy&&<p role="status">Preparing and checking the requested files. Keep this page open.</p>}{error&&<div role="alert"><p>{error}</p>{['unauthorized','account_changed','session_missing'].includes(errorCode)&&<a href={demo?'/demo':'/auth/login?'+new URLSearchParams({redirect:'/sites/'+site.id})} target="_blank" rel="noopener noreferrer">Sign in in another tab, then retry here</a>}</div>}
 {preparation?.missingReports.length>0&&<div><p role="status">Preparation required: {preparation.missingReports.length} selected report PDFs are not retained yet. Your package has not been generated.</p><ul>{preparation.missingReports.map(r=><li key={r.id}><a href={'/report/'+r.id+'?'+new URLSearchParams({from:'/sites/'+site.id})}>Report {r.id}</a></li>)}</ul><button type="button" disabled={busy} onClick={prepareNext}>Prepare next report PDF</button></div>}
 {(changed||saved)&&<button type="button" disabled={busy} onClick={()=>{generation.current=null;setChanged(false);setSaved(false);setError('');setPreparation(null)}}>Start new package generation</button>}
 {saved&&<p role="status">Complete package received; download requested. Open index.html inside the ZIP. If interrupted, retry the same generation here.</p>}
 <details><summary>Retained packages</summary><button type="button" disabled={busy||!start||!end} onClick={()=>run(check)}>Find retained packages</button>{preparation&&<><p>{preparation.retained?'Your 10 most recent retained generations for this site. Downloads recheck current access.':'Worker downloads are not retained here. Ask a supervisor for the permitted site handover.'}</p>{preparation.retained&&!preparation.packages.length&&<p>No retained generations for your account at this site.</p>}<ul>{preparation.packages.map(p=><li key={p.id}><a href={endpoint+'?generation='+p.id}>Download generation {p.id}</a><p>{p.first_day} through {p.last_day}; recorded {p.completed_at}. Earlier snapshot, not current status.</p></li>)}</ul></>}</details></section>
}
