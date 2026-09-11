'use client'
import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'

export default function PaymentVerifier({ reportId }) {
  const sessionId = useSearchParams().get('session_id')
  const router = useRouter()
  const [result, setResult] = useState({ status: 'verifying', message: '' })
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    if (!sessionId) return
    const controller = new AbortController()
    async function verify() {
      try {
        const response = await fetch('/api/checkout/verify', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId }), signal: controller.signal,
        })
        const data = await response.json()
        if (!response.ok || !data.paid) throw new Error()
        setResult({ status: 'verified', message: 'Payment confirmed. You can now print.' })
        router.replace('/report/' + reportId)
        router.refresh()
      } catch {
        if (!controller.signal.aborted) setResult({ status: 'failed', message: 'We could not confirm payment. Retry verification before paying again.' })
      }
    }
    verify()
    return () => controller.abort()
  }, [sessionId, reportId, router, attempt])
  if (!sessionId) return null
  return <div className="no-print max-w-4xl mx-auto p-4">
    <div className="border border-amber/40 p-4 rounded-lg" role={result.status === 'failed' ? 'alert' : 'status'}>
      {result.status === 'verifying' ? 'Verifying payment...' : result.message}
      {result.status === 'failed' && <button className="block min-h-[48px] underline" onClick={() => { setResult({ status: 'verifying', message: '' }); setAttempt(attempt + 1) }}>Retry verification</button>}
    </div>
  </div>
}
