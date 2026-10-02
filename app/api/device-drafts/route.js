import {authenticatedClient} from '@/lib/server/auth'
import {requireBriefs} from '@/lib/server/briefs'
import {databaseError} from '@/lib/server/workspace'
import {assertExpectedActor} from '@/lib/domain/actor'
import {UUID} from '@/lib/domain/validation'
import {AppError,errorResponse} from '@/lib/domain/errors'
export async function GET(request){try{
 requireBriefs();const {supabase,user}=await authenticatedClient();assertExpectedActor(user.id,request.headers.get('x-expected-actor'))
 const p=new URL(request.url).searchParams,kind=p.get('kind'),id=p.get('id'),company=p.get('company'),site=p.get('siteId')
 if(!['concern','brief'].includes(kind)||!UUID.test(id||'')||!UUID.test(company||''))throw new AppError('invalid_request')
 const m=await supabase.from('ts_members').select('role').eq('company_id',company).eq('user_id',user.id).eq('active',true).maybeSingle();if(m.error)throw databaseError(m.error);if(!m.data)throw new AppError('denied')
 const r=await supabase.from(kind==='concern'?'ts_concerns':'ts_briefs').select('*').eq('company_id',company).eq('id',id).maybeSingle();if(r.error)throw databaseError(r.error)
 if(r.data){if(r.data.author_id!==user.id&&(kind==='concern'||m.data.role==='worker'))throw new AppError('denied');return Response.json({record:r.data,editable:r.data.lifecycle==='draft'},{headers:{'Cache-Control':'no-store'}})}
 if(kind!=='concern'||!UUID.test(site||''))throw new AppError('not_found')
 const s=await supabase.from('ts_sites').select('id,archived').eq('id',site).eq('company_id',company).maybeSingle();if(s.error)throw databaseError(s.error);if(!s.data)throw new AppError('denied');if(s.data.archived)throw new AppError('site_archived')
 return Response.json({record:null,editable:true},{headers:{'Cache-Control':'no-store'}})
 }catch(e){return errorResponse(e)}}
