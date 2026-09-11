import { getTemplate, isTrade, type Trade } from './templates.ts'
export const ANSWERS = { unanswered: 'Unanswered', meets: 'Meets the stated check', attention: 'Needs attention', not_applicable: 'Not applicable', unable: 'Unable to verify' } as const
export type AnswerState = keyof typeof ANSWERS
export type Answer = { state: AnswerState; note: string; controls: string }
export type InspectionDocument = { job: { address: string; client: string; date: string }; answers: Record<string, Answer> }
export function answerState(value: unknown): AnswerState {
  return typeof value === 'string' && Object.hasOwn(ANSWERS, value) ? value as AnswerState : 'unanswered'
}
export function finalizationIssues(doc: InspectionDocument, template: ReturnType<typeof getTemplate>): string[] {
  const errors: string[] = []
  if (!doc.job?.address?.trim()) errors.push('Enter the job address.')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(doc.job?.date || '')) errors.push('Enter the work date.')
  for (const item of template.items) {
    const answer = doc.answers?.[item.id]
    const state = answerState(answer?.state)
    if (state === 'unanswered') errors.push(item.question + ': record an observation.')
    else if (state !== 'meets' && !answer?.note?.trim()) errors.push(item.question + ': add an explanation.')
  }
  return errors
}
export function validDraft(value: unknown, source: Trade | ReturnType<typeof getTemplate>): value is InspectionDocument {
  if (!value || typeof value !== 'object' || JSON.stringify(value).length > 100000) return false
  const doc = value as InspectionDocument
  if (!doc.job || !doc.answers || typeof doc.answers !== 'object' || Array.isArray(doc.answers)) return false
  if (!['address','client','date'].every(k => typeof doc.job[k as keyof typeof doc.job] === 'string' && doc.job[k as keyof typeof doc.job].length <= 1000)) return false
  if (typeof source==='string' && !isTrade(source)) return false
  const ids = new Set((typeof source==='string'?getTemplate(source):source).items.map(i => i.id))
  return Object.entries(doc.answers).every(([id,a]) => ids.has(id) && a && Object.hasOwn(ANSWERS,a.state) && typeof a.note === 'string' && a.note.length <= 4000 && typeof a.controls === 'string' && a.controls.length <= 4000)
}
export const ACTION_STATES = ['open', 'in_progress', 'awaiting_verification', 'closed'] as const
export type Role = 'owner' | 'supervisor' | 'worker'
export function canEditReport(role: Role, actor: string, author: string) { return role === 'owner' || role === 'supervisor' || (role === 'worker' && actor === author) }
export function canVerify(role: Role) { return role === 'owner' || role === 'supervisor' }
export function hasConcerns(doc: InspectionDocument) { return Object.values(doc.answers).filter(a => ['attention','unable'].includes(answerState(a?.state))).length }
