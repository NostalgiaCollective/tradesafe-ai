// Navigation help for the existing recording requirements. SQL remains authoritative.
// This does not assess safety, confirm controls, or acknowledge a briefing.
export function briefMissingFields(document, members) {
 const issues=[]
 const add=(step,id,label)=>issues.push({step,id,label})
 for(const [key,label] of [['site','Site name or address'],['date','Work date'],['jurisdiction','Jurisdiction'],['workplace','Workplace context']]){
  if(!document[key]?.trim())add(1,'brief-'+key,label)
 }
 if(!document.confirmed)add(1,'brief-confirmed','Confirm jurisdiction and workplace context')
 for(const [key,label] of [['task','Today’s work'],['contact','Responsible site contact']]){
  if(!document[key]?.trim())add(2,'brief-'+key,label)
 }
 const active=id=>members.some(m=>m.user_id===id&&m.active)
 if(!document.crew.length)add(2,'brief-crew','Choose participating crew')
 else if(document.crew.some(id=>!active(id)))add(2,'brief-crew','Remove crew whose access was removed')
 if(!document.steps.length)add(3,'brief-add-step','Add a task step and hazard')
 document.steps.forEach((s,i)=>{
  for(const [key,label] of [['task','Task step'],['hazard','Hazard or concern'],['control','Control or precaution']]){
   if(!s[key].trim())add(3,key+'-'+s.id,`Task step ${i+1}: ${label}`)
  }
  if(!active(s.responsible))add(3,'responsible-'+s.id,`Task step ${i+1}: Choose an active responsible member`)
 })
 if(document.paused&&!document.pauseReason.trim())add(3,'brief-pauseReason','Why work was paused')
 if(!document.briefingNote.trim())add(4,'briefing-note','What was discussed in the briefing?')
 return issues
}
