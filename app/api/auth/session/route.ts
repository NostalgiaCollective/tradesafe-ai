import { authenticatedClient } from '@/lib/server/auth'
import { errorResponse } from '@/lib/domain/errors'

export async function GET() {
  try {
    await authenticatedClient()
    return Response.json({ authenticated: true }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) { return errorResponse(error) }
}
