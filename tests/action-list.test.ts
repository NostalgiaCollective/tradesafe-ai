import test from 'node:test'
import assert from 'node:assert/strict'
import {actionFilters,actionListUrl,applyActionFilters,matchesAction} from '../lib/domain/action-list.ts'
import {listReturn} from '../lib/domain/report-list.ts'
import {safeRedirect} from '../lib/domain/validation.ts'
const company='11111111-1111-4111-8111-111111111111',focus='22222222-2222-4222-8222-222222222222'
test('action views map to existing statuses and filter before bounded retrieval',()=>{
 const calls:unknown[]=[],query={eq:(...args:unknown[])=>{calls.push(['eq',...args]);return query},neq:(...args:unknown[])=>{calls.push(['neq',...args]);return query},in:(...args:unknown[])=>{calls.push(['in',...args]);return query}}
 applyActionFilters(query,actionFilters({status:'attention'}),'worker')
 assert.deepEqual(calls,[['eq','responsible_id','worker'],['in','state',['open','in_progress']]])
 assert.equal(matchesAction({state:'awaiting_verification',responsible_id:'worker'},actionFilters({}),'worker'),true)
 assert.equal(matchesAction({state:'closed',responsible_id:'worker'},actionFilters({}),'worker'),false)
 assert.equal(matchesAction({state:'open',responsible_id:'other'},actionFilters({}),'worker'),false)
 assert.equal(actionFilters({status:'sql',page:'-1',focus:'unsafe'}).status,'outstanding')
 assert.equal(actionFilters({status:'sql',page:'-1',focus:'unsafe'}).page,0)
 assert.equal(actionFilters({focus:'unsafe'}).focus,'')
 assert.equal(actionFilters({closed:'1'}).status,'all')
})
test('action return destinations retain permitted scope, status, page and selected position only',()=>{
 const url=actionListUrl(company,actionFilters({mine:'0',status:'awaiting_verification',page:'2',focus}))
 assert.equal(listReturn(url,company),url);assert.equal(safeRedirect(url),url)
 assert.equal(listReturn('/actions?company='+focus+'&focus='+focus,company),'/reports?company='+company)
 assert.equal(listReturn(url+'&token=secret',company),url)
 assert.equal(safeRedirect('/actions?company='+company+'&focus=bad&status=unsafe&page=999999'),'/actions?company='+company)
})
