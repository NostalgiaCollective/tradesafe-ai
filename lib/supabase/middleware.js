import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import { validateEnvironment } from '@/lib/domain/config'
import { isProtectedPath, isAnonymousError } from '@/lib/domain/authorization'
import { safeRedirect } from '@/lib/domain/validation'
import { serviceUnavailableResponse } from '@/lib/server/service-response'

export async function updateSession(request) {
  const protectedRoute = isProtectedPath(request.nextUrl.pathname)
  // APIs and callbacks enforce services/auth themselves; public pages need no auth request.
  if (!protectedRoute) return NextResponse.next()
  if (!validateEnvironment(process.env).services.supabase) return serviceUnavailableResponse('configuration')
  let response = NextResponse.next({ request })
  try {
    const client = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
      cookieOptions: { secure: new URL(process.env.NEXT_PUBLIC_APP_URL).protocol === 'https:' },
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookies) {
          cookies.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        },
      },
    })
    const { data: { user }, error } = await client.auth.getUser()
    if (error && !isAnonymousError(error)) return serviceUnavailableResponse('unavailable')
    if (!user) {
      const url = request.nextUrl.clone()
      url.pathname = '/auth/login'
      url.search = ''
      url.searchParams.set('redirect', safeRedirect(request.nextUrl.pathname + request.nextUrl.search))
      const redirected = NextResponse.redirect(url)
      response.cookies.getAll().forEach(cookie => redirected.cookies.set(cookie))
      redirected.headers.set('Cache-Control', 'no-store')
      return redirected
    }
    response.headers.set('Cache-Control', 'private, no-store')
    return response
  } catch { return serviceUnavailableResponse('unavailable') }
}
