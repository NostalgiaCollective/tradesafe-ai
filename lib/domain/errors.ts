export const ERROR_MESSAGES = {
  image_invalid: 'Use a valid JPEG, PNG or WebP image up to 3 MiB and 20 megapixels. Animated images are not supported.',
  evidence_pending: 'A photo upload is incomplete. Retry or remove it before finalizing.',
  evidence_limit: 'This report already has 10 photos or pending uploads. Remove a draft photo before adding another.',
  evidence_missing: 'Retained evidence is unavailable or failed its integrity check. No incomplete PDF will be issued. Retry or contact support.',
  export_busy: 'PDF generation is in progress. Retry in two minutes if it was interrupted.',
  denied: 'You do not have access to this company or permission for this action.',
  conflict: 'A newer version was saved. Your changes are still here. Open the latest record before trying again.',
  immutable: 'This record is finalized. Create an amendment to correct an observation.',
  incomplete: 'Complete the required observations and explanations, then acknowledge their accuracy.',
  invitation: 'This invitation is unavailable, expired, or belongs to a different verified email address.',
  last_owner: 'Add another owner before removing or changing the last owner.',
  deferred: 'Payments and paid access are unavailable while billing reconciliation is being rebuilt. No payment has been taken here.',
  configuration: 'This service is not configured yet. Please try again after setup is complete.',
  unavailable: 'We could not connect to the service. Please try again.',
  unauthorized: 'Please sign in to continue.',
  not_found: 'This report could not be found or is not available to your account.',
  invalid_request: 'Please check the information and try again.',
  auth_failed: 'We could not complete sign-in. Request a new link or try signing in again.',
  payment_failed: 'We could not start payment. No payment was confirmed here. Please try again.',
  verification_failed: 'We could not confirm your payment. Retry verification before starting another payment.',
  query_failed: 'We could not load your records. Please try again.',
} as const
export type ErrorCode = keyof typeof ERROR_MESSAGES
const statuses: Record<ErrorCode, number> = {
  image_invalid: 422, evidence_pending: 409, evidence_limit: 409, evidence_missing: 503, export_busy: 409,
  denied: 403, conflict: 409, immutable: 409, incomplete: 422, invitation: 400, last_owner: 409, deferred: 503,
  configuration: 503, unavailable: 503, unauthorized: 401, not_found: 404,
  invalid_request: 400, auth_failed: 400, payment_failed: 502,
  verification_failed: 502, query_failed: 503,
}
export class AppError extends Error {
  code: ErrorCode
  status: number
  constructor(code: ErrorCode) {
    super(ERROR_MESSAGES[code])
    this.name = 'AppError'
    this.code = code
    this.status = statuses[code]
  }
}
export function errorResponse(error: unknown, fallback: ErrorCode = 'unavailable') {
  const safe = error instanceof AppError ? error : new AppError(fallback)
  // No provider errors, URLs, request bodies or credentials in logs.
  console.error(JSON.stringify({ event: 'request_failed', code: safe.code }))
  return Response.json({ error: safe.message, code: safe.code }, {
    status: safe.status, headers: { 'Cache-Control': 'no-store' },
  })
}
