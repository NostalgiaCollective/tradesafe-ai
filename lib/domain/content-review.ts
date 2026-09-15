import { getTemplate, type Trade } from './templates.ts'
import matrix from './safety-review.json' with { type: 'json' }

// A source check is evidence, never an approval. Candidates have no publication path.
// Report creation continues to select the frozen, database-published v1 template.
export const CONTENT_REVIEW_VERSION = '2026-09-15-provenance-v1'
export const CANDIDATE_VERSION = '2026-09-15-candidate-v2'
export function getContentReview(trade: Trade) {
  return structuredClone({ ...matrix, items: matrix.items.filter(item => item.trade === trade) })
}
export function getCandidateTemplate(trade: Trade) {
  const original = getTemplate(trade)
  const review = getContentReview(trade)
  return {
    id: `${trade}:${CANDIDATE_VERSION}`, trade, version: CANDIDATE_VERSION,
    basedOn: original.id, publicationStatus: 'candidate_only' as const,
    reviewStatus: 'pending_qualified_review' as const,
    provenanceVersion: CONTENT_REVIEW_VERSION,
    // Retained as part of the candidate, not a mutable link to current sources.
    provenance: review,
    items: original.items.map(item => {
      const row = review.items.find(row => row.id === item.id)
      if (!row || row.currentWording !== item.question) throw Error('Content review does not match historical template')
      return { ...item, question: row.candidateWording }
    }),
  }
}
