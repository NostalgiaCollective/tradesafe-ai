import {actionFilters,actionListUrl} from './action-list.ts'
import { UUID } from './validation.ts'
export function reportFilters(params: Record<string,unknown>) {
 return {q:typeof params.q==='string'?params.q.trim().slice(0,120):'',status:['draft','finalized','amended'].includes(String(params.status))?String(params.status):'',trade:['electrical','plumbing','roofing'].includes(String(params.trade))?String(params.trade):'',sort:['oldest','work_date'].includes(String(params.sort))?String(params.sort):'recent',page:Math.max(0,Math.min(10000,Number.parseInt(String(params.page||'0'),10)||0))}
}
export function reportListUrl(company:string,filters:ReturnType<typeof reportFilters>){return '/reports?'+new URLSearchParams({company,...(filters.q?{q:filters.q}:{}),...(filters.status?{status:filters.status}:{}),...(filters.trade?{trade:filters.trade}:{}),...(filters.sort!=='recent'?{sort:filters.sort}:{}),...(filters.page?{page:String(filters.page)}:{})})}
export function listReturn(value:unknown,company:string) {
 const fallback='/reports?company='+company
 if(typeof value!=='string'||value.length>2048||/[\\\r\n#]/.test(value))return fallback
 try{const url=new URL(value,'https://internal.invalid');if(url.origin!=='https://internal.invalid'||!['/dashboard','/reports','/actions'].includes(url.pathname)||url.searchParams.get('company')!==company||!UUID.test(company))return fallback
  if(url.pathname==='/reports')return reportListUrl(company,reportFilters(Object.fromEntries(url.searchParams)))
  if(url.pathname==='/dashboard')return '/dashboard?company='+company
  return actionListUrl(company,actionFilters(Object.fromEntries(url.searchParams)))
 }catch{return fallback}
}
export const searchPattern=(value:string)=>'%'+value.replace(/[\\%_]/g,'\\$&')+'%'
// PostgREST values must be quoted as well as LIKE-escaped: punctuation is data, not filter syntax.
export const reportSearch=(value:string)=>['address','client'].map(field=>'document->job->>'+field+'.ilike.'+JSON.stringify(searchPattern(value))).join(',')
export function applyReportFilters<T extends {eq:(key:string,value:string)=>T;not:(key:string,op:string,value:null)=>T;or:(value:string)=>T;order:(key:string,options?:{ascending?:boolean})=>T}>(query:T,filters:ReturnType<typeof reportFilters>):T{
 if(filters.status==='amended')query=query.not('amendment_of','is',null)
 else if(filters.status)query=query.eq('lifecycle',filters.status)
 if(filters.trade)query=query.eq('template_snapshot->>trade',filters.trade)
 if(filters.q)query=query.or(reportSearch(filters.q))
 return query.order(filters.sort==='work_date'?'document->job->>date':'updated_at',{ascending:filters.sort==='oldest'}).order('id')
}
