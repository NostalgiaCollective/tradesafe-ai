import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { safeRedirect } from '@/lib/domain/validation'
import { AppError } from '@/lib/domain/errors'
import { appOrigin } from '@/lib/server/config'
import { serviceUnavailableResponse } from '@/lib/server/service-response'

export async function GET(request) {
  const requested = new URL(request.url)
  const destination = safeRedirect(requested.searchParams.get('redirect'))
  let origin
  try {
    origin = appOrigin()
    const code = requested.searchParams.get('code')
    if (!code) throw new AppError('auth_failed')
    const supabase = await createClient()
    const exchange = await supabase.auth.exchangeCodeForSession(code)
    if (exchange.error) throw new AppError('auth_failed')
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) throw new AppError('auth_failed')
    const response = NextResponse.redirect(new URL(destination, origin))
    response.headers.set('Cache-Control', 'no-store')
    return response
  } catch (error) {
    const code = error instanceof AppError ? error.code : 'unavailable'
    console.error(JSON.stringify({ event: 'auth_callback_failed', code }))
    if (!origin) return serviceUnavailableResponse('configuration')
    const target = new URL('/auth/login', origin)
    target.searchParams.set('error', code)
    target.searchParams.set('redirect', destination)
    const response = NextResponse.redirect(target)
    response.headers.set('Cache-Control', 'no-store')
    return response
  }
}
