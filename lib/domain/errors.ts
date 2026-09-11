export const ERROR_MESSAGES = {
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
