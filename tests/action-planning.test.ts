import test from 'node:test'
import assert from 'node:assert/strict'
import {planningDay,deadline,planningFilters} from '../lib/domain/action-planning.ts'
test('planning midnight, DST and closed/reopened deadlines',()=>{
 assert.equal(planningDay(new Date('2026-10-02T03:59:59Z')),'2026-10-01')
 assert.equal(planningDay(new Date('2026-10-02T04:00:00Z')),'2026-10-02')
 assert.equal(planningDay(new Date('2026-11-01T05:30:00Z')),'2026-11-01')
 assert.equal(planningDay(new Date('2026-11-01T06:30:00Z')),'2026-11-01')
 const a={target_date:'2026-10-01',state:'open'}
 assert.equal(deadline(a,'2026-10-01'),'today');assert.equal(deadline(a,'2026-10-02'),'overdue')
 assert.equal(deadline({...a,state:'closed'},'2026-10-02'),'closed');assert.equal(deadline({...a,target_date:null}),'unscheduled')
 assert.deepEqual(planningFilters({deadline:'bad',priority:'sql',sort:'bad'}),{deadline:'all',priority:'all',sort:'due'})
})
