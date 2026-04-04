'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function SignOutButton() {
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
  }

  return (
    <button
      onClick={handleSignOut}
      className="text-sm text-gray-400 hover:text-white transition-colors cursor-pointer bg-transparent border-none min-h-[48px] px-3"
    >
      Sign Out
    </button>
  )
}
