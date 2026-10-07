import 'server-only'
import {loadSite} from './sites'
import {databaseError} from './workspace'
import {AppError} from '../domain/errors'
export async function electricalJobData(supabase,id){
 const site=await loadSite(supabase,id)
 const results=await Promise.all([
  supabase.from('ts_electrical_jobs').select('*').eq('site_id',id).maybeSingle(),
  supabase.from('ts_electrical_job_versions').select('revision,recorded_at,recorded_by').eq('site_id',id).order('revision',{ascending:false}).limit(20),
  supabase.from('ts_brief_content_catalog').select('*').eq('version','on-residential-electrical-2026-10-07-v1').single(),
  supabase.from('ts_site_links').select('report:ts_reports!inner(id,lifecycle,template_id,evidence:ts_evidence(id,caption,state))').eq('site_id',id).eq('report.lifecycle','finalized').like('report.template_id','electrical:%').order('linked_at',{ascending:false}).limit(30),
 ])
 for(const r of results)if(r.error)throw databaseError(r.error)
 const job=results[0].data,evidence=results[3].data.flatMap(l=>(l.report?.evidence||[]).filter(e=>e.state==='ready').map(e=>({...e,reportId:l.report.id})))
 const missing=[job?.document.certificatePhoto,job?.document.defectPhoto].filter(id=>id&&!evidence.some(e=>e.id===id))
 if(missing.length){
  const selected=await supabase.from('ts_evidence').select('id,caption,report_id').in('id',missing).eq('company_id',site.company_id).eq('state','ready')
  if(selected.error)throw databaseError(selected.error)
  if(selected.data.length!==new Set(missing).size)throw new AppError('evidence_missing')
  evidence.push(...selected.data.map(e=>({...e,reportId:e.report_id})))
 }
 return {site,job,versions:results[1].data,content:results[2].data,evidence}
}
export async function electricalVersion(supabase,id,revision){
 await loadSite(supabase,id)
 if(!/^[1-9][0-9]{0,3}$/.test(String(revision)))throw new AppError('invalid_request')
 const r=await supabase.from('ts_electrical_job_versions').select('*').eq('site_id',id).eq('revision',Number(revision)).maybeSingle()
 if(r.error)throw databaseError(r.error)
 if(!r.data)throw new AppError('not_found')
 return r.data
}
