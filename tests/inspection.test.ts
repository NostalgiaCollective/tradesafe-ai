import test from 'node:test'
import assert from 'node:assert/strict'
import { answerState,finalizationChecklist,finalizationIssues,validDraft,canEditReport,canVerify } from '../lib/domain/inspection.ts'
import { buildChecklistState,getTemplate } from '../lib/domain/templates.ts'
import { safeRedirect } from '../lib/domain/validation.ts'

test('review links resolve missing fields without changing finalization requirements',()=>{
 const template=getTemplate('electrical'),doc={job:{address:'',client:'',date:''},answers:buildChecklistState('electrical')}
 doc.answers[template.items[0].id]={state:'unable',note:'',controls:''}
 const checklist=finalizationChecklist(doc,template)
 assert.deepEqual(checklist.slice(0,2).map(({field,step})=>({field,step})),[{field:'job-address',step:2},{field:'job-date',step:2}])
 assert.equal(checklist[2].field,'note-'+template.items[0].id)
 assert.equal(checklist[3].field,'answer-'+template.items[1].id)
 assert.ok(checklist.slice(2).every(issue=>issue.step===3))
 assert.deepEqual(checklist.map(issue=>issue.message),finalizationIssues(doc,template))
 const photo='/report/11111111-1111-4111-8111-111111111111?step=5'
 assert.equal(safeRedirect(photo),photo)
 assert.notEqual(safeRedirect('https://example.test'+photo),'https://example.test'+photo)
})
test('missing, legacy and unknown answer values never become meets',()=>{
 for(const value of [undefined,null,'pass','yes','unknown',true,{},'__proto__'])assert.equal(answerState(value),'unanswered')
 for(const trade of ['electrical','plumbing','roofing'] as const)assert.ok(Object.values(buildChecklistState(trade)).every(a=>a.state==='unanswered'))
})
test('finalization requires explicit observations and reasons, including not-applicable and unable-to-verify',()=>{
 const t=getTemplate('plumbing');const doc={job:{address:'Fixture',client:'',date:'2026-09-11'},answers:buildChecklistState('plumbing')}
 assert.equal(finalizationIssues(doc,t).length,15)
 for(const item of t.items)doc.answers[item.id]={state:'meets',note:'',controls:''}
 assert.equal(finalizationIssues(doc,t).length,0)
 for(const state of ['not_applicable','unable','attention'] as const){
  doc.answers[t.items[0].id]={state,note:'',controls:''};assert.equal(finalizationIssues(doc,t).length,1)
  doc.answers[t.items[0].id].note='Explicit explanation';assert.equal(finalizationIssues(doc,t).length,0)
 }
 assert.equal(validDraft(doc,'plumbing'),true)
 doc.answers['unknown-item']={state:'meets',note:'',controls:''};assert.equal(validDraft(doc,'plumbing'),false)
})
test('workers author their own records; supervisor and owner permissions do not change answer truth',()=>{
 assert.equal(canEditReport('worker','a','b'),false);assert.equal(canEditReport('worker','a','a'),true)
 assert.equal(canEditReport('supervisor','a','b'),true);assert.equal(canVerify('worker'),false);assert.equal(canVerify('owner'),true)
})

test('plumbing and roofing review fields and draft validation use their own immutable template IDs',()=>{
 for(const trade of ['plumbing','roofing'] as const){
  const template=getTemplate(trade),answers=buildChecklistState(trade),doc={job:{address:'SYNTHETIC trade validation',client:'',date:'2026-09-20'},answers}
  assert.equal(template.items.length,trade==='plumbing'?15:18)
  assert.equal(template.reviewStatus,'pending_qualified_review')
  assert.deepEqual(finalizationChecklist(doc,template).map(e=>e.field),template.items.map(i=>'answer-'+i.id))
  for(const item of template.items)answers[item.id]={state:'meets',note:'',controls:''}
  for(const state of ['attention','not_applicable','unable'] as const){
   const item=template.items.at(-1)!
   answers[item.id]={state,note:'',controls:''}
   assert.deepEqual(finalizationChecklist(doc,template),[{field:'note-'+item.id,step:3,message:item.question+': add an explanation.'}])
   answers[item.id].note='Synthetic explanation; optional controls stay empty'
   assert.equal(finalizationIssues(doc,template).length,0)
  }
  assert.equal(validDraft(doc,template),true)
  assert.equal(validDraft({...doc,answers:{...answers,'electrical-001':{state:'meets',note:'',controls:''}}},template),false)
 }
})
