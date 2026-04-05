import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY)
}

export async function POST(request) {
  const stripe = getStripe()
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { reportId } = await request.json()

  if (!reportId) {
    return NextResponse.json({ error: 'Missing reportId' }, { status: 400 })
  }

  // Verify the report exists and belongs to this user
  const { data: report } = await supabase
    .from('reports')
    .select('id, user_id, status, trade, job_address')
    .eq('id', reportId)
    .single()

  if (!report || report.user_id !== user.id) {
    return NextResponse.json({ error: 'Report not found' }, { status: 404 })
  }

  // Already paid
  if (report.status === 'completed') {
    return NextResponse.json({ error: 'Report already paid' }, { status: 400 })
  }

  const origin = new URL(request.url).origin

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    currency: 'cad',
    line_items: [
      {
        price_data: {
          currency: 'cad',
          unit_amount: 1000, // $10.00 CAD
          product_data: {
            name: `TradeSafe AI — ${report.trade.charAt(0).toUpperCase() + report.trade.slice(1)} Compliance Report`,
            description: report.job_address || 'Ontario compliance report',
          },
        },
        quantity: 1,
      },
    ],
    metadata: {
      report_id: reportId,
      user_id: user.id,
    },
    success_url: `${origin}/report/${reportId}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/report/${reportId}`,
  })

  return NextResponse.json({ url: session.url })
}
