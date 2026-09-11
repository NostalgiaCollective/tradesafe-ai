import Stripe from 'stripe'
import { authenticatedClient } from '@/lib/server/auth'
import { requireService, appOrigin } from '@/lib/server/config'
import { requireOwner } from '@/lib/domain/authorization'
import { readObject, requireString, UUID } from '@/lib/domain/validation'
import { isLegacyPaid } from '@/lib/domain/reports'
import { AppError, errorResponse } from '@/lib/domain/errors'

export async function POST(request) {
  try {
    const { supabase, user } = await authenticatedClient()
    requireService('stripe')
    const { reportId: value } = await readObject(request)
    const reportId = requireString(value, UUID)
    const { data: report, error } = await supabase.from('reports')
      .select('id, user_id, status, trade, job_address').eq('id', reportId).maybeSingle()
    if (error) throw new AppError('query_failed')
    requireOwner(user.id, report)
    if (isLegacyPaid(report.status)) throw new AppError('invalid_request')
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
    const origin = appOrigin()
    const session = await stripe.checkout.sessions.create({
      mode: 'payment', currency: 'cad',
      line_items: [{ price_data: { currency: 'cad', unit_amount: 1000,
        product_data: { name: 'TradeSafe AI - ' + report.trade + ' Compliance Report', description: report.job_address || 'Ontario compliance report' },
      }, quantity: 1 }],
      metadata: { report_id: reportId, user_id: user.id },
      success_url: origin + '/report/' + reportId + '?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: origin + '/report/' + reportId,
    })
    if (!session.url) throw new AppError('payment_failed')
    return Response.json({ url: session.url }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) { return errorResponse(error, 'payment_failed') }
}
