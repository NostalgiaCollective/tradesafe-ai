'use client'

import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'

export default function PaymentVerifier({ reportId }) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [verifying, setVerifying] = useState(false)
  const [verified, setVerified] = useState(false)

  const sessionId = searchParams.get('session_id')

  useEffect(() => {
    if (!sessionId) return

    setVerifying(true)

    fetch('/api/checkout/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.paid) {
          setVerified(true)
          // Refresh the page without query params so the server component re-fetches the updated status
          router.replace(`/report/${reportId}`)
        }
      })
      .catch(() => {})
      .finally(() => setVerifying(false))
  }, [sessionId, reportId, router])

  if (!sessionId) return null

  if (verifying) {
    return (
      <div className="no-print max-w-4xl mx-auto px-4 pt-4">
        <div className="bg-amber/10 border border-amber/30 rounded-xl px-5 py-3 text-center">
          <span className="text-sm font-heading tracking-widest text-amber">VERIFYING PAYMENT...</span>
        </div>
      </div>
    )
  }

  if (verified) {
    return (
      <div className="no-print max-w-4xl mx-auto px-4 pt-4">
        <div className="bg-success/10 border border-success/30 rounded-xl px-5 py-3 text-center">
          <span className="text-sm font-heading tracking-widest text-success">PAYMENT CONFIRMED — YOU CAN NOW PRINT</span>
        </div>
      </div>
    )
  }

  return null
}
