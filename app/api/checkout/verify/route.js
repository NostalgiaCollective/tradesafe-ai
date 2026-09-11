import Stripe from 'stripe'
import { authenticatedClient } from '@/lib/server/auth'
import { requireService } from '@/lib/server/config'
import { requireOwner } from '@/lib/domain/authorization'
import { readObject, requireString, UUID } from '@/lib/domain/validation'
import { isLegacyPaid } from '@/lib/domain/reports'
import { AppError, errorResponse } from '@/lib/domain/errors'

export async function POST(request) {
  try {
    const { supabase, user } = await authenticatedClient()
    requireService('stripe')
    const { sessionId: value } = await readObject(request)
    const sessionId = requireString(value, /^cs_(test_|live_)?[A-Za-z0-9]+$/)
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
    const session = await stripe.checkout.sessions.retrieve(sessionId)
    if (session.payment_status !== 'paid' || session.mode !== 'payment' || session.currency !== 'cad' || session.amount_total !== 1000) throw new AppError('verification_failed')
    if (session.metadata?.user_id !== user.id) throw new AppError('not_found')
    const reportId = requireString(session.metadata?.report_id, UUID)
    const { data: report, error } = await supabase.from('reports').select('id, user_id, status').eq('id', reportId).maybeSingle()
    if (error) throw new AppError('query_failed')
    requireOwner(user.id, report)
    if (!isLegacyPaid(report.status)) {
      // Legacy compatibility ONLY. Trusted billing storage/webhooks are a later P0 slice.
      const updated = await supabase.from('reports').update({ status: 'completed', completed_at: new Date().toISOString(), stripe_session_id: session.id }).eq('id', reportId).eq('user_id', user.id).select('id').maybeSingle()
      if (updated.error || !updated.data) throw new AppError('verification_failed')
    }
    return Response.json({ paid: true }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) { return errorResponse(error, 'verification_failed') }
}
