import { randomBytes } from 'node:crypto'
import { authenticatedClient } from '@/lib/server/auth'
import { appOrigin } from '@/lib/server/config'
import { databaseError } from '@/lib/server/workspace'
import { readObject, UUID } from '@/lib/domain/validation'
import { AppError,errorResponse } from '@/lib/domain/errors'
import { validDraft, canEditReport } from '@/lib/domain/inspection'
import {assertExpectedActor} from '@/lib/domain/actor'

const commands=['create_company','save_company','invite','revoke_invitation','accept_invitation','member','create_report','save_report','finalize','amend','update_action']
export async function POST(request: Request) {
 try {
  const {supabase,user}=await authenticatedClient()
  assertExpectedActor(user.id,request.headers.get('x-expected-actor'))
  // Browser mutations use JSON and require the configured same origin. Direct RPC is also guarded in SQL.
  if(request.headers.get('origin')!==new URL(appOrigin()).origin)throw new AppError('denied')
  if(!request.headers.get('content-type')?.startsWith('application/json'))throw new AppError('invalid_request')
  const body=await readObject(request)
  if(typeof body.command!=='string'||!commands.includes(body.command)||!body.payload||typeof body.payload!=='object'||Array.isArray(body.payload))throw new AppError('invalid_request')
  const p=body.payload as Record<string,unknown>
  if(JSON.stringify(p).length>120000)throw new AppError('invalid_request')
  if(!['create_company','accept_invitation'].includes(body.command)) {
   if(typeof p.companyId!=='string'||!UUID.test(p.companyId))throw new AppError('invalid_request')
   const m=await supabase.from('ts_members').select('role').eq('company_id',p.companyId).eq('user_id',user.id).eq('active',true).maybeSingle()
   if(m.error)throw databaseError(m.error)
   if(!m.data)throw new AppError('denied')
   if(['save_company','invite','revoke_invitation','member'].includes(body.command)&&m.data.role!=='owner')throw new AppError('denied')
   if(['save_report','finalize','amend'].includes(body.command)) {
    const r=await supabase.from('ts_reports').select('author_id,template_snapshot').eq('company_id',p.companyId).eq('id',body.command==='amend'?p.amendmentOf:p.id).maybeSingle()
    if(r.error)throw databaseError(r.error)
    if(!r.data)throw new AppError('not_found')
    if(!canEditReport(m.data.role,user.id,r.data.author_id))throw new AppError('denied')
    if(body.command==='save_report'&&!validDraft(p.document,r.data.template_snapshot))throw new AppError('invalid_request')
   }
   if(body.command==='update_action'&&m.data.role==='worker') {
    const a=await supabase.from('ts_actions').select('responsible_id,state').eq('id',p.id).eq('company_id',p.companyId).maybeSingle()
    if(a.error)throw databaseError(a.error)
    if(!a.data)throw new AppError('not_found')
    if(a.data.responsible_id!==user.id||p.responsibleId!==user.id||p.state==='closed'||a.data.state==='closed')throw new AppError('denied')
   }
  }
  if(body.command==='invite')p.token=randomBytes(32).toString('hex')
  const {data,error}=await supabase.rpc('ts_command',{command:body.command,p})
  if(error)throw databaseError(error)
  return Response.json(body.command==='invite'?{...data,link:appOrigin()+'/join#token='+p.token}:data,{headers:{'Cache-Control':'no-store'}})
 }catch(error){return errorResponse(error)}
}
