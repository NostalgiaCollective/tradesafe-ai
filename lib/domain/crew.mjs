export function participation(version,members,acknowledgements){
 return version.snapshot.document.crew.map(id=>({id,
  name:version.snapshot.people?.find(p=>p.id===id)?.name||members.find(m=>m.user_id===id)?.display_name||'Former member',
  active:members.some(m=>m.user_id===id&&m.active),
  acknowledgedAt:acknowledgements.find(a=>a.user_id===id&&a.version===version.version)?.acknowledged_at||null,
 }))
}
export function crewView(params){return {crew:params.view==='crew',page:Math.max(0,Math.min(10000,parseInt(params.page)||0))}}
