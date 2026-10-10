'use client'

import { createClient } from '@/lib/supabase/client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {entries,removeAll} from '@/lib/client/device-store.mjs'

export default function SignOutButton({demo=false}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function handleSignOut() {
    try{if(entries(localStorage).length&&!window.confirm('Sign out and remove device drafts? Unsent text kept only on this device will be removed.'))return}catch{}
    setBusy(true)
    setError('')
    try {
      if(demo){const r=await fetch('/api/demo',{method:'DELETE'});if(!r.ok)throw Error('Sign out failed')}
      else{const { error } = await createClient().auth.signOut();if (error) throw error}
      try{removeAll(localStorage)}catch{}
      router.replace(demo?'/demo':'/')
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
