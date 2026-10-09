import 'server-only'
import {loadSite} from './sites'
import {databaseError} from './workspace'
import {AppError} from '../domain/errors'
import {actionCounts} from './action-counts'
import {canEditReport} from '../domain/inspection'
// RLS applies before ordering/limits. Read only the linked fields used by the journey.
export async function electricalWorkData(supabase,site,actor,role){
 const [reports,briefs,counts]=await Promise.all([
  supabase.from('ts_site_links').select('report:ts_reports!inner(id,lifecycle,author_id,amendment_of,job:document->job)').eq('company_id',site.company_id).eq('site_id',site.id).like('report.template_id','electrical:%').order('linked_at',{ascending:false}).order('report_id').limit(8),
  supabase.from('ts_site_links').select('brief:ts_briefs!inner(id,lifecycle,author_id,task:document->>task,date:document->>date,revision)').eq('company_id',site.company_id).eq('site_id',site.id).order('linked_at',{ascending:false}).order('brief_id').limit(8),
  actionCounts(supabase,site.company_id,actor,role==='worker',site.id),
 ])
 for(const r of [reports,briefs])if(r.error)throw databaseError(r.error)
 const editable=r=>r.lifecycle==='draft'&&canEditReport(role,actor,r.author_id)
 return {reports:reports.data.map(l=>({...l.report,document:{job:l.report.job},editable:editable(l.report)})),briefs:briefs.data.map(l=>({...l.brief,document:{task:l.brief.task,date:l.brief.date},editable:editable(l.brief)})),counts,mine:role==='worker'}
}
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
