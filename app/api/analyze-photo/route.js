import { authenticatedClient } from '@/lib/server/auth'
import { AppError, errorResponse } from '@/lib/domain/errors'

// The legacy endpoint has no supported pilot workflow. It must never send evidence
// to an AI provider or consume credits. Reintroduction requires a separate review.
export async function POST() {
  try {
    await authenticatedClient()
    throw new AppError('analysis_deferred')
  } catch (error) { return errorResponse(error) }
}
