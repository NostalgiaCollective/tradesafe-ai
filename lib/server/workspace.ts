import 'server-only'
import { redirect } from 'next/navigation'
import { pageClient } from './page-auth'
import { AppError, type ErrorCode } from '../domain/errors.ts'
import { UUID } from '../domain/validation.ts'

export function databaseError(error: { message?: string; code?: string }) {
  const known: ErrorCode[] = ['unauthorized','denied','not_found','conflict','immutable','incomplete','invitation','last_owner','evidence_pending','evidence_limit','export_busy']
  const code = known.find(code => error.message === 'TS_' + code)
  if (code) return new AppError(code)
  if (error.message === 'TS_invalid' || error.code?.startsWith('22') || error.code?.startsWith('23')) return new AppError('invalid_request')
  return new AppError('query_failed')
}
export async function workspace(returnTo: string, companyId?: string) {
  const { supabase, user } = await pageClient(returnTo)
  const { data: memberships, error } = await supabase.from('ts_members').select('company_id,role').eq('user_id',user.id).eq('active',true).order('joined_at')
  if (error) throw databaseError(error)
  const membership = companyId ? memberships.find((m: {company_id:string})=>m.company_id===companyId) : memberships[0]
  if (companyId && !membership) redirect('/access-denied')
  const companies = await supabase.from('ts_companies').select('*').order('created_at')
  if (companies.error) throw databaseError(companies.error)
  const company = membership ? companies.data.find((c:{id:string})=>c.id===membership.company_id) : null
  if (membership && !company) throw new AppError('query_failed')
  return { supabase,user,membership,company,companies:companies.data }
}
export async function loadReport(id: string) {
  const {supabase,user}=await pageClient('/report/'+id)
  if (!UUID.test(id)) throw new AppError('not_found')
  const {data:report,error}=await supabase.from('ts_reports').select('*').eq('id',id).maybeSingle()
  if(error)throw databaseError(error)
  if(!report)return {supabase,user,report:null}
  const member=await supabase.from('ts_members').select('*').eq('company_id',report.company_id).eq('user_id',user.id).eq('active',true).maybeSingle()
  if(member.error)throw databaseError(member.error)
  if(!member.data)redirect('/access-denied')
  return {supabase,user,report,membership:member.data}
}
