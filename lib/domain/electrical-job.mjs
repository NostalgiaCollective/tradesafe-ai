// Recording fields, not an installation checklist or legal decision engine.
export const ELECTRICAL_CONTENT_VERSION='on-residential-electrical-2026-10-07-v1'
export const electricalFields=[
 {key:'workKind',label:'Type of electrical work',group:'Scope',options:['unknown','new installation','alteration','repair','service']},
 {key:'setting',label:'Confirmed work setting',group:'Scope',options:['unknown','Ontario residential construction project','Ontario residential setting requiring applicability review','other — use general documentation']},
 {key:'scope',label:'Job scope and location within the site',group:'Scope',max:2000},
 {key:'equipment',label:'Equipment and circuit identifiers',group:'Scope',max:1000},
 {key:'applicability',label:'Workplace applicability questions or disputed basis',group:'Scope',max:2000},
 {key:'business',label:'Contractor business',group:'People and credentials',max:200},
 {key:'lec',label:'LEC licence reference (user entered)',group:'People and credentials',max:200},
 {key:'personnel',label:'Responsible personnel and designated master electrician',group:'People and credentials',max:2000},
 {key:'qualifications',label:'Individual qualification references and evidence location',group:'People and credentials',max:3000},
 {key:'notification',label:'ESA notification applicability',group:'ESA record',options:['unknown — review needed','notification reference recorded','exemption basis proposed — review needed','disputed — review needed']},
 {key:'notificationRef',label:'ESA notification reference',group:'ESA record',max:200},
 {key:'notificationBasis',label:'Applicability question or proposed exemption basis and source',group:'ESA record',max:2000},
 {key:'codeEdition',label:'Applicable OESC edition and basis (recorded by user)',group:'ESA record',max:500},
 {key:'inspection',label:'ESA inspection or review status (reported)',group:'ESA record',options:['not recorded','request recorded','awaiting outcome','defects recorded','acceptance reported','applicability unresolved']},
 {key:'inspectionRecord',label:'Request date, outcome, defect notice and ESA reference',group:'ESA record',max:3000},
 {key:'assessment',label:'Qualified personnel assessment reference and unresolved hazards',group:'Safety records',max:3000},
 {key:'procedure',label:'Employer isolation / lockout procedure and version reference',group:'Safety records',max:2000},
 {key:'verification',label:'Verification record, performer and time (user entered)',group:'Safety records',max:2000},
 {key:'documentation',label:'TradeSafe documentation status (reported)',group:'Handover',options:['in progress','documentation complete reported']},
 {key:'handover',label:'Outstanding documentation and handover notes',group:'Handover',max:2000},
]
export const emptyElectricalJob=()=>Object.fromEntries([...electricalFields.map(f=>[f.key,f.options?.[0]||'']),['certificatePhoto',''],['defectPhoto','']])
export function electricalMissing(d){
 const missing=[]
 for(const [key,label] of [['scope','Job scope'],['business','Contractor business'],['lec','LEC reference'],['personnel','Responsible personnel'],['qualifications','Qualification references'],['codeEdition','OESC edition basis']])if(!d[key]?.trim())missing.push(label)
 if(d.workKind==='unknown')missing.push('Type of work')
 if(d.setting!=='Ontario residential construction project')missing.push('Workplace applicability remains for review; use general documentation for unsupported settings')
 if(d.notification!=='notification reference recorded')missing.push('ESA applicability remains for review')
 else if(!d.notificationRef?.trim())missing.push('ESA notification reference')
 return missing
}
const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
export function electricalExport(version){
 const s=version.snapshot,e=escape,row=(k,v)=>`<p><strong>${e(k)}:</strong> ${e(v||'Not recorded')}</p>`
 return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Electrical job record</title><style>body{font:16px/1.5 system-ui;max-width:760px;margin:2rem auto;padding:1rem}p{white-space:pre-wrap;overflow-wrap:anywhere}</style><h1>${s.practice?'PRACTICE — ':''}Electrical job record</h1><p>Source-linked draft content. No certification, work authorization or live registry check. Statuses are independent user records.</p>${row('Site',s.site.name)}${row('Address',s.site.address)}${row('Company',s.company)}${row('Record revision',version.revision)}${row('Recorded at (server)',version.recorded_at)}${row('Recorded by',s.actorName)}${row('Content version',s.content.version)}${electricalFields.map(f=>row(f.label,s.document[f.key])).join('')}${row('Internal review',s.internalReview?JSON.stringify(s.internalReview):'None for this saved revision')}${row('Credential check reported',s.credentialCheck?JSON.stringify(s.credentialCheck):'User-entered only; no external check recorded')}<h2>Retained evidence references</h2>${s.evidence.map(p=>row(p.kind,`Report ${p.reportId}; photo ${p.id}; ${p.caption}; SHA-256 ${p.sha256}`)).join('')||'<p>No certificate or defect evidence attached.</p>'}<h2>Unresolved documentation</h2>${electricalMissing(s.document).map(m=>row('For review',m)).join('')||'<p>No missing fields detected by this limited form; not a completeness or compliance assessment.</p>'}<h2>Source mapping</h2>${s.content.payload.prompts.map(p=>row(p.id+' v'+p.version,p.wording+' Sources: '+p.sourceIds.join(', '))).join('')}${s.content.payload.sources.map(x=>row(x.id,x.title+'; '+x.section+'; '+x.url+'; retrieved '+x.retrieved)).join('')}<p>This export is one retained electrical-job revision. Briefings, exact-version acknowledgements, installation reports and follow-up status remain separate linked site records. Use Daily handover and Evidence package for those records.</p></html>`
}
