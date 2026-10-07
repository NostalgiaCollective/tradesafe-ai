import test from 'node:test'
import assert from 'node:assert/strict'
import {browserRunPassed,LOCAL_WORKFLOW_COUNT,RESTORED_WORKFLOW_COUNT} from '../scripts/ci/browser-contract.mjs'
test('browser gate requires every expected workflow to execute and pass',()=>{
 for(const [recovery,count] of [[false,LOCAL_WORKFLOW_COUNT],[true,RESTORED_WORKFLOW_COUNT]]){
  const rows=Array.from({length:count},()=>({status:'passed'}))
  assert.equal(browserRunPassed({status:'passed'},rows,recovery),true)
  assert.equal(browserRunPassed({status:'passed'},rows.slice(1),recovery),false)
  assert.equal(browserRunPassed({status:'passed'},[...rows,{status:'passed'}],recovery),false)
  for(const status of ['skipped','failed','timedOut','interrupted']){
   assert.equal(browserRunPassed({status:'passed'},[{status},...rows.slice(1)],recovery),false)
   assert.equal(browserRunPassed({status},rows,recovery),false)
  }
 }
})
