export type EnvironmentVariable = 'APP_ENV' | 'NEXT_PUBLIC_APP_URL' | 'NEXT_PUBLIC_SUPABASE_URL' |
  'NEXT_PUBLIC_SUPABASE_ANON_KEY' | 'STRIPE_SECRET_KEY' | 'ANTHROPIC_API_KEY'
export type Environment = Partial<Record<EnvironmentVariable, string>> & Record<string, string | undefined>
export type Service = 'supabase' | 'stripe' | 'anthropic'
export type EnvironmentIssue = { variable: EnvironmentVariable; reason: 'missing' | 'invalid' }

const supplied = (value?: string) => Boolean(value?.trim())
const loopback = (host: string) => ['localhost', '127.0.0.1', '[::1]'].includes(host)

export function validOrigin(value: unknown, allowLocal = true): value is string {
  if (typeof value !== 'string' || value.trim() !== value) return false
  try {
    const url = new URL(value)
    return !url.username && !url.password && !url.search && !url.hash &&
      url.pathname === '/' && (url.protocol === 'https:' ||
        (allowLocal && url.protocol === 'http:' && loopback(url.hostname)))
  } catch { return false }
}

// Never accept a privileged key in a browser-exposed variable.
export function validPublicKey(value?: string): boolean {
  if (!value || value.trim() !== value) return false
  if (/^sb_publishable_[A-Za-z0-9_-]+$/.test(value)) return true
  try {
    const parts = value.split('.')
    if (parts.length !== 3) return false
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))
    return payload.role === 'anon'
  } catch { return false }
}

export function validateEnvironment(env: Environment) {
  const mode = env.APP_ENV || 'local'
  const issues: EnvironmentIssue[] = []
  const issue = (variable: EnvironmentVariable, valid: boolean) => {
    if (!valid) issues.push({ variable, reason: supplied(env[variable]) ? 'invalid' : 'missing' })
  }
  issue('APP_ENV', ['local', 'staging', 'production'].includes(mode))
  issue('NEXT_PUBLIC_APP_URL', validOrigin(env.NEXT_PUBLIC_APP_URL, mode === 'local'))
  issue('NEXT_PUBLIC_SUPABASE_URL', validOrigin(env.NEXT_PUBLIC_SUPABASE_URL, mode === 'local'))
  issue('NEXT_PUBLIC_SUPABASE_ANON_KEY', validPublicKey(env.NEXT_PUBLIC_SUPABASE_ANON_KEY))
  const supabase = !issues.length
  // Optional integrations fail closed independently. Staging/local must use Stripe test mode.
  const stripeKey = (mode === 'production'
    ? /^sk_(test|live)_[A-Za-z0-9]+$/.test(env.STRIPE_SECRET_KEY || '')
    : /^sk_test_[A-Za-z0-9]+$/.test(env.STRIPE_SECRET_KEY || ''))
  const anthropicKey = /^sk-ant-[A-Za-z0-9_-]+$/.test(env.ANTHROPIC_API_KEY || '')
  if (!stripeKey) issue('STRIPE_SECRET_KEY', false)
  if (!anthropicKey) issue('ANTHROPIC_API_KEY', false)
  return { mode, services: { supabase, stripe: supabase && stripeKey, anthropic: supabase && anthropicKey }, issues }
}

// Explicit property access is required for Next.js browser substitution.
// Server secrets are deliberately never read by this function.
export function publicEnvironment(): Environment {
  return {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  }
}

export function publicServicesReady() {
  return validateEnvironment(publicEnvironment()).services.supabase
}
