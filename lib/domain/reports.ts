export type WorkStatus = 'draft' | 'finalized'
export type PaymentStatus = 'unpaid' | 'paid'
export type ReportStates = { work: WorkStatus; payment: PaymentStatus }

// Future transitions must not confuse paying with finalizing work.
// These pure functions do not migrate or reinterpret existing database records.
export function withPayment(states: ReportStates, payment: PaymentStatus): ReportStates {
  return { ...states, payment }
}
export function withWorkStatus(states: ReportStates, work: WorkStatus): ReportStates {
  return { ...states, work }
}
// Explicit compatibility boundary until trusted entitlements/lifecycle migrations are approved.
export function isLegacyPaid(status: unknown) { return status === 'completed' }
