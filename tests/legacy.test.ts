import test from 'node:test'
import assert from 'node:assert/strict'
import { legacyAnswers } from '../lib/domain/legacy.ts'
test('historical values remain recorded values without inferred answers', () => {
  assert.deepEqual(legacyAnswers({ 'Wiring__Stored question': { status: 'pass', notes: 'Original note' }, Missing: null }), [
    { label: 'Wiring: Stored question', status: 'pass', notes: 'Original note' },
    { label: 'Missing', status: 'unknown', notes: '' },
  ])
  assert.equal(legacyAnswers([{ item: 'Stored item', status: 'fail' }])[0].status, 'fail')
  assert.equal(legacyAnswers([{ category: 'Stored section', items: [{ label: 'Stored question', status: 'na' }] }])[0].status, 'na')
  assert.deepEqual(legacyAnswers(null), [])
  assert.equal(legacyAnswers([{ items: [null] }])[0].status, 'unknown')
})
