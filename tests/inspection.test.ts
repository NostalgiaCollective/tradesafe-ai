import test from 'node:test'
import assert from 'node:assert/strict'
import { answerState,finalizationIssues,validDraft,canEditReport,canVerify } from '../lib/domain/inspection.ts'
import { buildChecklistState,getTemplate } from '../lib/domain/templates.ts'
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
