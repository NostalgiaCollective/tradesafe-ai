'use client'

import { createClient } from '@/lib/supabase/client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function SignOutButton() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function handleSignOut() {
    setBusy(true)
    setError('')
    try {
      const { error } = await createClient().auth.signOut()
      if (error) throw error
      router.replace('/')
      router.refresh()
    } catch {
      setError('Sign out failed. Please try again.')
      setBusy(false)
    }
  }

  return (
    <div><button
      disabled={busy}
      onClick={handleSignOut}
      className="text-sm text-gray-400 hover:text-white transition-colors cursor-pointer bg-transparent border-none min-h-[48px] px-3"
    >
      {busy ? 'Signing out...' : 'Sign out'}
    </button>{error && <p role="alert">{error}</p>}</div>
  )
}
