import { createBrowserClient } from '@supabase/ssr'
import { publicServicesReady } from '@/lib/domain/config'
import { AppError } from '@/lib/domain/errors'

export function createClient() {
  if (!publicServicesReady()) throw new AppError('configuration')
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
}
