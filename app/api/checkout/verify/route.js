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

  const { sessionId } = await request.json()

  if (!sessionId) {
    return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 })
  }

  const session = await stripe.checkout.sessions.retrieve(sessionId)

  if (session.payment_status !== 'paid') {
    return NextResponse.json({ error: 'Payment not completed' }, { status: 400 })
  }

  const reportId = session.metadata.report_id

  // Verify report belongs to this user
  const { data: report } = await supabase
    .from('reports')
    .select('id, user_id, status')
    .eq('id', reportId)
    .single()

  if (!report || report.user_id !== user.id) {
    return NextResponse.json({ error: 'Report not found' }, { status: 404 })
  }

  if (report.status === 'completed') {
    return NextResponse.json({ paid: true })
  }

  // Update report status to completed
  const { error } = await supabase
    .from('reports')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      stripe_session_id: session.id,
    })
    .eq('id', reportId)

  if (error) {
    return NextResponse.json({ error: 'Failed to update report' }, { status: 500 })
  }

  return NextResponse.json({ paid: true })
}
