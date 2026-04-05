'use client'

import { useState } from 'react'

export default function PrintButton({ variant = 'primary', reportId, isPaid }) {
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    // Already paid — just print
    if (isPaid) {
      window.print()
      return
    }

    // Not paid — create Stripe checkout session
    setLoading(true)
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportId }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        alert(data.error || 'Something went wrong. Please try again.')
        setLoading(false)
      }
    } catch {
      alert('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  const label = loading ? 'REDIRECTING...' : isPaid ? 'PRINT REPORT' : 'PAY & PRINT — $10'

  const icon = (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
    </svg>
  )

  if (variant === 'secondary') {
    return (
      <button
        onClick={handleClick}
        disabled={loading}
        className="text-xs font-heading tracking-widest text-gray-400 hover:text-white transition min-h-[48px] flex items-center gap-2 cursor-pointer bg-transparent border-none disabled:opacity-50"
      >
        {icon}
        {label}
      </button>
    )
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="min-h-[48px] px-5 bg-amber hover:bg-amber-dark text-black font-heading font-bold text-xs tracking-widest rounded-xl transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
    >
      {icon}
      {label}
    </button>
  )
}
