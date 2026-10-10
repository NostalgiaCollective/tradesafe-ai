import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { requireService } from '@/lib/server/config'
import {demoConfig,openDemo,DEMO_COOKIE} from '../staging/demo.mjs'
import {demoClient} from '../server/demo'
import {AppError} from '../domain/errors'

export async function createClient() {
  requireService('supabase')
  const cookieStore = await cookies()
  const demo=cookieStore.get(DEMO_COOKIE)
  if(demo){const config=demoConfig(),session=openDemo(config,demo.value);if(!session)throw new AppError('unauthorized');return demoClient(config,session)}

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookieOptions: { secure: new URL(process.env.NEXT_PUBLIC_APP_URL).protocol === 'https:' },
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // setAll is called from Server Components where cookies
            // can't be set — this is safe to ignore.
          }
        },
      },
    }
  )
}
