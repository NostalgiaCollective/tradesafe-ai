import {authenticatedClient} from '@/lib/server/auth'
import {requireBriefs} from '@/lib/server/briefs'
import {databaseError} from '@/lib/server/workspace'
import {assertExpectedActor} from '@/lib/domain/actor'
import {UUID} from '@/lib/domain/validation'
import {AppError,errorResponse} from '@/lib/domain/errors'
export async function GET(request){try{
 requireBriefs();const {supabase,user}=await authenticatedClient();assertExpectedActor(user.id,request.headers.get('x-expected-actor'))
 const p=new URL(request.url).searchParams,kind=p.get('kind'),id=p.get('id'),company=p.get('company'),site=p.get('siteId')
 if(!['concern','brief','electrical','action','package'].includes(kind)||!UUID.test(id||'')||!UUID.test(company||''))throw new AppError('invalid_request')
 const m=await supabase.from('ts_members').select('role').eq('company_id',company).eq('user_id',user.id).eq('active',true).maybeSingle();if(m.error)throw databaseError(m.error);if(!m.data)throw new AppError('denied')
 if(kind==='action'){
  const result=await supabase.from('ts_actions').select('*').eq('company_id',company).eq('id',id).maybeSingle();if(result.error)throw databaseError(result.error);if(!result.data)throw new AppError('not_found')
  if(m.data.role==='worker'&&result.data.responsible_id!==user.id)throw new AppError('denied')
  // Closed actions still allow an authoritative lookup of an ambiguous retained update.
  return Response.json({record:result.data,editable:true},{headers:{'Cache-Control':'no-store'}})
 }
 if(kind==='electrical'||kind==='package'){
  const current=await supabase.from('ts_sites').select('id,revision,archived,document').eq('id',id).eq('company_id',company).maybeSingle();if(current.error)throw databaseError(current.error);if(!current.data)throw new AppError('denied')
  if(m.data.role==='worker')throw new AppError('denied')
  if(kind==='package')return Response.json({record:current.data,editable:true},{headers:{'Cache-Control':'no-store'}})
  if(m.data.role==='worker')throw new AppError('denied')
  const electrical=await supabase.from('ts_electrical_jobs').select('*').eq('company_id',company).eq('site_id',id).maybeSingle();if(electrical.error)throw databaseError(electrical.error)
  return Response.json({record:electrical.data,editable:!current.data.archived},{headers:{'Cache-Control':'no-store'}})
 }
 const r=await supabase.from(kind==='concern'?'ts_concerns':'ts_briefs').select('*').eq('company_id',company).eq('id',id).maybeSingle();if(r.error)throw databaseError(r.error)
 if(r.data){if(r.data.author_id!==user.id&&(kind==='concern'||m.data.role==='worker'))throw new AppError('denied');return Response.json({record:r.data,editable:r.data.lifecycle==='draft'},{headers:{'Cache-Control':'no-store'}})}
 if(kind!=='concern'||!UUID.test(site||''))throw new AppError('not_found')
 const s=await supabase.from('ts_sites').select('id,archived').eq('id',site).eq('company_id',company).maybeSingle();if(s.error)throw databaseError(s.error);if(!s.data)throw new AppError('denied');if(s.data.archived)throw new AppError('site_archived')
 return Response.json({record:null,editable:true},{headers:{'Cache-Control':'no-store'}})
 }catch(e){return errorResponse(e)}}
