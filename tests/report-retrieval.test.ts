import test from 'node:test'
import assert from 'node:assert/strict'
import {listReturn,reportFilters,reportListUrl,searchPattern,reportSearch} from '../lib/domain/report-list.ts'
import {canUpdateAction,needsResolution,definitiveActionFailure} from '../lib/domain/action-edit.ts'
const company='11111111-1111-4111-8111-111111111111'
test('report search is bounded and return navigation preserves only same-company list filters',()=>{
 const filters=reportFilters({q:'  Site 20%_ ',status:'draft',page:'2'})
 assert.equal(filters.q,'Site 20%_');assert.equal(searchPattern(filters.q),'%Site 20\\%\\_%')
 const url=reportListUrl(company,filters);assert.equal(listReturn(url,company),url)
 for(const bad of ['https://evil.test/dashboard?company='+company,'//evil.test','/actions?company=other','/dashboard?company='+company+'#x'])assert.equal(listReturn(bad,company),'/reports?company='+company)
 assert.equal(listReturn('/actions?company='+company+'&mine=0&closed=1&unsafe=x',company),'/actions?company='+company+'&mine=0&status=all')
 assert.equal(reportFilters({q:'x'.repeat(200),status:'anything',page:'-2'}).q.length,120)
 assert.equal(reportFilters({status:'anything',page:'-2'}).status,'');assert.equal(reportFilters({page:'-2'}).page,0)
})
test('action UI preserves existing role boundaries and validation failures stay editable',()=>{
 const action={responsible_id:'worker',state:'open'}
 assert.equal(canUpdateAction('worker','worker',action),true);assert.equal(canUpdateAction('worker','other',action),false)
 assert.equal(canUpdateAction('worker','worker',{...action,state:'closed'}),false)
 for(const role of ['supervisor','owner'] as const)assert.equal(canUpdateAction(role,'other',{...action,state:'closed'}),true)
 assert.equal(needsResolution('awaiting_verification'),true);assert.equal(needsResolution('closed'),true);assert.equal(needsResolution('open'),false)
 assert.equal(definitiveActionFailure('incomplete'),true);assert.equal(definitiveActionFailure('invalid_request'),true)
 assert.equal(definitiveActionFailure('network'),false);assert.equal(definitiveActionFailure('unauthorized'),false)
})

test('library filters retain trade, sort and amendment state without accepting arbitrary values',()=>{
 const f=reportFilters({q:'Customer, (east)',status:'amended',trade:'electrical',sort:'work_date',page:'1'});assert.equal(listReturn(reportListUrl(company,f),company),reportListUrl(company,f));assert.equal(f.status,'amended');assert.equal(f.trade,'electrical');assert.equal(f.sort,'work_date');assert.equal(reportFilters({trade:'sql',sort:'secret'}).trade,'');assert.equal(reportFilters({sort:'secret'}).sort,'recent');
 const text='x"),company_id.neq.secret';assert.equal(reportSearch(text),'document->job->>address.ilike.'+JSON.stringify(searchPattern(text))+',document->job->>client.ilike.'+JSON.stringify(searchPattern(text)));
})
