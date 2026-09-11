import { authenticatedClient } from '@/lib/server/auth'
import { AppError, errorResponse } from '@/lib/domain/errors'
export async function POST() {
 try { await authenticatedClient(); throw new AppError('deferred') }
 catch(error) { return errorResponse(error) }
}
