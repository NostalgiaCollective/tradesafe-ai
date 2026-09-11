import test from 'node:test'
import assert from 'node:assert/strict'
import { documentKey } from '../lib/domain/document-key.ts'

test('server JSONB key ordering cannot keep a confirmed draft dirty', () => {
  const edited = { job: { address: 'Synthetic site', date: '2026-09-11' }, answers: { a: { state: 'attention', note: 'Concern', controls: '' } } }
  const confirmed = { answers: { a: { controls: '', note: 'Concern', state: 'attention' } }, job: { date: '2026-09-11', address: 'Synthetic site' } }
  assert.equal(documentKey(edited), documentKey(confirmed))
  const next = structuredClone(edited)
  next.answers.a.note = 'Edited while saving'
  assert.notEqual(documentKey(next), documentKey(confirmed), 'a queued edit must remain unsaved')
  assert.notEqual(documentKey({}), documentKey({ a: { state: 'meets' } }))
  assert.notEqual(documentKey(['a', 'b']), documentKey(['b', 'a']))
})
