export const ERROR_MESSAGES = {
  content_retired: 'These task prompts have been retired. Your draft text is retained. In Task prompts and sources, choose current content or Continue without task prompts before recording a new briefing version.',
  analysis_deferred: 'AI photo analysis is not available in this pilot. Record your own observation and attach evidence through the report or concern workflow.',
  electrical_limit: 'This electrical job has reached its limit of 1,000 retained revisions. Existing records remain available. Contact support before recording further revisions; do not overwrite historical records.',
  package_retention_limit: 'A retained handover must fit the existing 50 MiB storage limit. Narrow the date range and prepare a new generation. No partial package was issued.',
  package_generation_limit: 'This site has reached 20 retained package preparations in the last 24 hours. Download an existing generation or wait before preparing another. No existing package was changed.',
  package_pending: 'This package has not completed. Retry its preparation; if source records changed, start a new generation.',
  package_abandoned: 'This unfinished package generation expired and was retired by maintenance. No retained package was removed. Start a new package generation after checking the current records.',
  package_limit: 'This package exceeds its limits: 31 days, 200 activity records, 100 files or 64 MiB. Narrow the date range and try again. No partial package was issued.',
  package_changed: 'Site records or your access changed while the package was being prepared. No package was issued. Refresh the site and retry.',
  package_missing: 'A retained PDF or photo is missing or failed its integrity check. No partial package was issued. Open the original report to generate its PDF if none exists, then retry; contact support if retained evidence is unavailable.',
  summary_limit: 'This handover exceeds the complete-summary limit (200 records per section, 2,000 acknowledgements or 2 MiB). No partial handover was produced. Use the original site lists and contact support to arrange a complete export.',
  site_archived: 'This site is archived. Open the site to view existing work, or ask a supervisor or owner to restore it before starting new activity.',
  account_changed: 'The signed-in account has changed. These entries have not been submitted by the new account. Sign back in as the original account, or open a fresh page before making changes.',
  request_timeout: 'The operation did not finish within the time limit. Its server outcome may not be confirmed. Check the saved record or retry the same operation; keep this page open to preserve your text and file selection.',
  storage_busy: 'This evidence operation is already being processed. An interrupted operation can take up to two minutes to release. Then check its outcome or retry the same operation. Your current text remains here.',
  resource_limited: 'The photo or PDF request limit has been reached. Wait 10 minutes, then retry the same operation. Existing saved photos and PDFs remain available.',
  resource_busy: 'Photo or PDF processing is busy. Wait a few seconds, then retry the same operation. Keep this page open to preserve your input.',
  image_invalid: 'Use a valid JPEG, PNG or WebP image up to 5 MiB (5,242,880 bytes) and 20 megapixels. Animated images are not supported. The normalized JPEG must fit the 3 MiB storage limit.',
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
  session_missing: 'This page needs a current sign-in session. Sign in below. If you just signed in, check that cookies are allowed for this site, then try again. Your saved records have not been changed.',
  not_found: 'This report could not be found or is not available to your account.',
  invalid_request: 'Please check the information and try again.',
  auth_failed: 'We could not complete sign-in. Request a new link or try signing in again.',
  payment_failed: 'We could not start payment. No payment was confirmed here. Please try again.',
  verification_failed: 'We could not confirm your payment. Retry verification before starting another payment.',
  query_failed: 'We could not load your records. Please try again.',
} as const
export type ErrorCode = keyof typeof ERROR_MESSAGES
const statuses: Record<ErrorCode, number> = {
  content_retired: 409, analysis_deferred: 503,
  electrical_limit: 422,
  package_abandoned: 409, package_retention_limit: 422, package_generation_limit: 429, package_pending: 409, package_limit: 422, package_changed: 409, package_missing: 503,
  summary_limit: 422,
  site_archived: 409,
  account_changed: 409,
  request_timeout: 408, storage_busy: 503,
  resource_limited: 429, resource_busy: 503,
  image_invalid: 422, evidence_pending: 409, evidence_limit: 409, evidence_missing: 503, export_busy: 409,
  denied: 403, conflict: 409, immutable: 409, incomplete: 422, invitation: 400, last_owner: 409, deferred: 503,
  configuration: 503, unavailable: 503, unauthorized: 401, session_missing: 401, not_found: 404,
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
    status: safe.status, headers: { 'Cache-Control': 'no-store', ...(safe.code==='resource_limited'?{'Retry-After':'600'}:['resource_busy','storage_busy'].includes(safe.code)?{'Retry-After':'5'}:{}) },
  })
}
