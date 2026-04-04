'use client'

import { Suspense, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState('login') // login | signup | magic
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const searchParams = useSearchParams()
  const redirect = searchParams.get('redirect') || '/dashboard'

  const supabase = createClient()

  async function handleGoogleLogin() {
    setLoading(true)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?redirect=${redirect}`,
      },
    })
    if (error) setError(error.message)
    setLoading(false)
  }

  async function handleEmailLogin(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')

    if (mode === 'magic') {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback?redirect=${redirect}` },
      })
      if (error) setError(error.message)
      else setMessage('Check your email for a login link.')
      setLoading(false)
      return
    }

    if (mode === 'signup') {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback?redirect=${redirect}` },
      })
      if (error) setError(error.message)
      else setMessage('Check your email to confirm your account.')
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
      else window.location.href = redirect
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <Link href="/" className="flex items-center justify-center gap-3 mb-8">
          <div className="w-10 h-10 bg-amber rounded-lg flex items-center justify-center">
            <svg className="w-6 h-6 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <span className="text-2xl font-heading font-bold text-white">TradeSafe AI</span>
        </Link>

        {/* Card */}
        <div className="bg-[#1a1a1a] rounded-2xl p-8 border border-white/10">
          <h1 className="text-2xl font-heading font-bold text-white text-center mb-2">
            {mode === 'signup' ? 'Create Account' : 'Welcome Back'}
          </h1>
          <p className="text-gray-400 text-center mb-6 text-sm">
            {mode === 'signup'
              ? 'Start generating compliance reports'
              : 'Sign in to your TradeSafe account'}
          </p>

          {/* Google */}
          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full h-12 bg-white text-black rounded-xl font-semibold flex items-center justify-center gap-3 hover:bg-gray-100 transition mb-4"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Continue with Google
          </button>

          <div className="flex items-center gap-4 my-6">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-gray-500 text-sm">or</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          {/* Email form */}
          <form onSubmit={handleEmailLogin} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-12 bg-[#0f0f0f] border border-white/10 rounded-xl px-4 text-white placeholder-gray-600 focus:outline-none focus:border-amber transition"
                placeholder="you@company.com"
              />
            </div>

            {mode !== 'magic' && (
              <div>
                <label className="block text-sm text-gray-400 mb-1">Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-12 bg-[#0f0f0f] border border-white/10 rounded-xl px-4 text-white placeholder-gray-600 focus:outline-none focus:border-amber transition"
                  placeholder="••••••••"
                  minLength={6}
                />
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 bg-amber hover:bg-amber-dark text-black rounded-xl font-bold transition disabled:opacity-50"
            >
              {loading ? 'Please wait...' : mode === 'signup' ? 'Create Account' : mode === 'magic' ? 'Send Magic Link' : 'Sign In'}
            </button>
          </form>

          {error && (
            <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}
          {message && (
            <div className="mt-4 p-3 bg-green-500/10 border border-green-500/30 rounded-lg text-green-400 text-sm">
              {message}
            </div>
          )}

          {/* Mode switchers */}
          <div className="mt-6 text-center space-y-2">
            {mode === 'login' && (
              <>
                <button onClick={() => setMode('magic')} className="text-amber text-sm hover:underline block mx-auto">
                  Use magic link instead
                </button>
                <p className="text-gray-500 text-sm">
                  No account?{' '}
                  <button onClick={() => setMode('signup')} className="text-amber hover:underline">
                    Sign up
                  </button>
                </p>
              </>
            )}
            {mode === 'signup' && (
              <p className="text-gray-500 text-sm">
                Already have an account?{' '}
                <button onClick={() => setMode('login')} className="text-amber hover:underline">
                  Sign in
                </button>
              </p>
            )}
            {mode === 'magic' && (
              <button onClick={() => setMode('login')} className="text-amber text-sm hover:underline">
                Use password instead
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  )
}
