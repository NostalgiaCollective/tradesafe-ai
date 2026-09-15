import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { getTemplate } from '../lib/domain/templates.ts'
import { getCandidateTemplate, getContentReview } from '../lib/domain/content-review.ts'
import { photoReviewPrompt } from '../lib/domain/photo-instructions.ts'

test('all published templates still match immutable SQL, and candidates retain detached provenance', async () => {
  const sql = await readFile(new URL('../supabase/migrations/20260911000300_template_v1.sql', import.meta.url), 'utf8')
  const published = [...sql.matchAll(/'({"id":.*?})'::jsonb/g)].map(match => JSON.parse(match[1]))
  assert.equal(published.length, 3)
  for (const trade of ['electrical', 'plumbing', 'roofing'] as const) {
    const original = getTemplate(trade), candidate = getCandidateTemplate(trade)
    assert.deepEqual(original, published.find(t => t.trade === trade))
    assert.notEqual(candidate.id, original.id)
    assert.equal(candidate.basedOn, original.id)
    assert.equal(candidate.publicationStatus, 'candidate_only')
    assert.equal(candidate.reviewStatus, 'pending_qualified_review')
    assert.deepEqual(candidate.items.map(i => i.id), original.items.map(i => i.id))
    assert.equal(candidate.provenance.items.length, original.items.length)
    for (const row of candidate.provenance.items) {
      assert.equal(row.qualifiedReview.status, 'pending_qualified_review')
      assert.equal(row.qualifiedReview.reviewer, null)
      assert.equal(row.qualifiedReview.reviewedAt, null)
      assert.ok(row.applicability && row.uncertainty && row.sourceCheckDate)
      for (const id of row.sourceIds) assert.ok(id in candidate.provenance.sources)
      if (row.sourceVerification === 'selected_provision_verified') assert.ok(row.provision)
    }
    candidate.items[0].question = 'Mutated review copy'
    candidate.provenance.items[0].currentWording = 'Mutated evidence copy'
    assert.deepEqual(getTemplate(trade), original)
    assert.notEqual(getCandidateTemplate(trade).items[0].question, 'Mutated review copy')
    assert.equal(getContentReview(trade).items[0].currentWording, original.items[0].question)
  }
})

test('source verification does not imply approval; installation and workplace evidence stay distinct', () => {
  const electrical = getContentReview('electrical'), roofing = getContentReview('roofing')
  assert.equal(electrical.qualifiedApproval, false)
  assert.equal(electrical.sources.order.effectiveDate, '2026-07-06')
  assert.equal(electrical.sources.oesc.edition, '2024 OESC (29th edition)')
  assert.ok(electrical.items.some(row => row.sourceVerification === 'selected_provision_verified'))
  assert.ok(electrical.items.every(row => row.qualifiedReview.status === 'pending_qualified_review'))
  assert.equal(roofing.items.find(row => row.id === 'roofing-012')?.domain, 'workplace_safety')
  assert.equal(roofing.items.find(row => row.id === 'roofing-006')?.domain, 'installation')
  for (const trade of ['electrical', 'plumbing', 'roofing'] as const) {
    const prompt = photoReviewPrompt(trade)
    assert.ok(prompt.includes('do not provide rule numbers'))
    assert.ok(prompt.includes('No verified code text or project applicability'))
  }
})
