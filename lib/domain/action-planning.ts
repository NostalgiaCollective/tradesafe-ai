export const PLANNING_ZONE='America/Toronto'
export const PRIORITIES={high:'High',normal:'Normal',low:'Low',unspecified:'Not set'} as const
export const DEADLINES={all:'Any deadline',overdue:'Overdue',today:'Due today',upcoming:'Upcoming',unscheduled:'Unscheduled'} as const
export function planningDay(now=new Date()){return new Intl.DateTimeFormat('en-CA',{timeZone:PLANNING_ZONE,year:'numeric',month:'2-digit',day:'2-digit'}).format(now)}
export function deadline(a:{state:string;target_date?:string|null},day=planningDay()){return a.state==='closed'?'closed':!a.target_date?'unscheduled':a.target_date<day?'overdue':a.target_date===day?'today':'upcoming'}
export function planningFilters(p:Record<string,unknown>){return {deadline:Object.hasOwn(DEADLINES,String(p.deadline))?String(p.deadline):'all',priority:Object.hasOwn(PRIORITIES,String(p.priority))?String(p.priority):'all',sort:p.sort==='priority'?'priority':'due'}}
export function planningParams(p:Record<string,unknown>){return Object.fromEntries(Object.entries(planningFilters(p)).filter(([k,v])=>v!=='all'&&(k!=='sort'||v!=='due')))}
export type PlanningQuery={eq:(k:string,v:string)=>PlanningQuery;neq:(k:string,v:string)=>PlanningQuery;is:(k:string,v:null)=>PlanningQuery;lt:(k:string,v:string)=>PlanningQuery;gt:(k:string,v:string)=>PlanningQuery}
type Query=PlanningQuery
export function filterPlanning<T extends Query>(input:T,p:ReturnType<typeof planningFilters>,day=planningDay()):T{
 let query:Query=input
 if(p.priority!=='all')query=query.eq('priority',p.priority)
 if(p.deadline!=='all'){query=query.neq('state','closed');if(p.deadline==='unscheduled')query=query.is('target_date',null);if(p.deadline==='today')query=query.eq('target_date',day);if(p.deadline==='overdue')query=query.lt('target_date',day);if(p.deadline==='upcoming')query=query.gt('target_date',day)}
 return query as T
}
export function orderPlanning<T extends {order:(k:string,o?:{ascending?:boolean;nullsFirst?:boolean})=>T}>(query:T,sort:string):T{return (sort==='priority'?query.order('priority_rank',{ascending:true}).order('priority'):query).order('target_date',{nullsFirst:false}).order('id')}
