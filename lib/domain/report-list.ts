import { UUID } from './validation.ts'
export function reportFilters(params: Record<string,unknown>) {
 return {q:typeof params.q==='string'?params.q.trim().slice(0,120):'',status:['draft','finalized'].includes(String(params.status))?String(params.status):'',page:Math.max(0,Math.min(10000,Number.parseInt(String(params.page||'0'),10)||0))}
}
export function reportListUrl(company:string,filters:ReturnType<typeof reportFilters>){return '/dashboard?'+new URLSearchParams({company,...(filters.q?{q:filters.q}:{}),...(filters.status?{status:filters.status}:{}),...(filters.page?{page:String(filters.page)}:{})})}
// A return link may only reconstruct known same-origin list filters, never arbitrary navigation.
export function listReturn(value:unknown,company:string) {
 const fallback='/dashboard?company='+company
 if(typeof value!=='string'||value.length>2048||/[\\\r\n#]/.test(value))return fallback
 try{const url=new URL(value,'https://internal.invalid');if(url.origin!=='https://internal.invalid'||!['/dashboard','/actions'].includes(url.pathname)||url.searchParams.get('company')!==company||!UUID.test(company))return fallback
  if(url.pathname==='/dashboard')return reportListUrl(company,reportFilters(Object.fromEntries(url.searchParams)))
  return '/actions?'+new URLSearchParams({company,mine:url.searchParams.get('mine')==='0'?'0':'1',...(url.searchParams.get('closed')==='1'?{closed:'1'}:{})})
 }catch{return fallback}
}
export const searchPattern=(value:string)=>'%'+value.replace(/[\\%_]/g,'\\$&')+'%'
