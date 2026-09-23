import {UUID} from './validation.ts'
export const ACTION_VIEWS={outstanding:'Outstanding',attention:'Needs attention',awaiting_verification:'Awaiting verification',closed:'Completed',all:'All actions'} as const
export function actionFilters(params:Record<string,unknown>){
 return {...(UUID.test(String(params.site))?{site:String(params.site)}:{}),mine:params.mine!=='0',status:Object.hasOwn(ACTION_VIEWS,String(params.status))?String(params.status):params.closed==='1'?'all':'outstanding',page:Math.max(0,Math.min(10000,Number.parseInt(String(params.page||'0'),10)||0)),focus:typeof params.focus==='string'&&UUID.test(params.focus)?params.focus:''}
}
export function actionListUrl(company:string,filters:ReturnType<typeof actionFilters>){return '/actions?'+new URLSearchParams({company,...(filters.site?{site:filters.site}:{}),mine:filters.mine?'1':'0',...(filters.status!=='outstanding'?{status:filters.status}:{}),...(filters.page?{page:String(filters.page)}:{}),...(filters.focus?{focus:filters.focus}:{})})}
export function matchesAction(action:{state:string;responsible_id:string},filters:ReturnType<typeof actionFilters>,actor:string){return (!filters.mine||action.responsible_id===actor)&&(filters.status==='all'||(filters.status==='outstanding'?action.state!=='closed':filters.status==='attention'?['open','in_progress'].includes(action.state):action.state===filters.status))}
export function applyActionFilters<T extends {eq:(key:string,value:string)=>T;neq:(key:string,value:string)=>T;in:(key:string,value:string[])=>T}>(query:T,filters:ReturnType<typeof actionFilters>,actor:string):T{
 if(filters.site)query=query.eq('site_id',filters.site)
 if(filters.mine)query=query.eq('responsible_id',actor)
 if(filters.status==='outstanding')return query.neq('state','closed')
 if(filters.status==='attention')return query.in('state',['open','in_progress'])
 return filters.status==='all'?query:query.eq('state',filters.status)
}
