import test from 'node:test'
import assert from 'node:assert/strict'
import {handoverExport,validHandoverDate,todayInZone} from '../lib/domain/handover.mjs'
import {safeRedirect} from '../lib/domain/validation.ts'
test('handover dates reject rollover and preserve validated site return timezone',()=>{
 assert.equal(validHandoverDate('2026-02-30'),false);assert.equal(validHandoverDate('2028-02-29'),true)
 assert.equal(todayInZone('America/Toronto',new Date('2026-09-29T03:59:59Z')),'2026-09-28')
 assert.equal(todayInZone('America/Toronto',new Date('2026-09-29T04:00:00Z')),'2026-09-29')
 const site='/sites/11111111-1111-4111-8111-111111111111'
 assert.equal(safeRedirect(site+'?date=2026-09-29&timezone=America%2FToronto&token=hidden'),site+'?date=2026-09-29&timezone=America%2FToronto')
 assert.equal(safeRedirect(site+'?date=2026-02-30&timezone=bad'),site)
})
test('handover export escapes entered content and distinguishes closure event from reopened status',()=>{
 const s={site:{id:'site',company_id:'company',revision:2,document:{name:'<script>site</script>',address:'Bay'}},company:'Synthetic',date:'2026-09-29',timezone:'UTC',start:'2026-09-29T00:00:00Z',end:'2026-09-30T00:00:00Z',generatedAt:'2026-09-29T10:00:00Z',outstanding:[],briefs:[],concerns:[],closures:[{id:'action',eventId:1,at:'2026-09-29T09:00:00Z',verifiedBy:'Supervisor',responsible:'Worker',observation:'Original',resolution:'<img onerror=bad>',currentState:'open',concern_id:'concern'}]}
 const html=handoverExport(s,'https://example.test');assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('<script>'));assert.ok(html.includes('Current status at generation:</strong> Open'));assert.ok(html.includes('Verified closed'));assert.ok(html.includes('https://example.test/concerns/concern'));assert.ok(html.includes('does not reconstruct historical status'));assert.ok(html.includes('No photo bytes'))
})
