import { AppError } from './errors.ts'

export function safeRedirect(value: unknown): string {
  const fallback = '/dashboard'
  if (typeof value !== 'string' || !value || value.length > 2048 || value.trim() !== value) return fallback
  // Reject encoded/control/backslash/fragment inputs before URL normalization.
  if (/[\\\u0000-\u0020\u007f#]/.test(value) || !value.startsWith('/') || value.startsWith('//')) return fallback
  try {
    const url = new URL(value, 'https://internal.invalid')
    if (url.origin !== 'https://internal.invalid' || !/^\/[A-Za-z0-9/_-]*$/.test(url.pathname) || url.pathname.includes('//')) return fallback
    const originalPath = value.split('?')[0]
    if (originalPath !== url.pathname) return fallback
    const query = new URLSearchParams()
    // The report wizard's step is the only currently supported return-query field.
    const steps = url.searchParams.getAll('step')
    if (url.pathname.startsWith('/report/') && steps.length === 1 && /^[1-4]$/.test(steps[0])) query.set('step', steps[0])
    return url.pathname + (query.size ? `?${query}` : '')
  } catch { return fallback }
}

export async function readObject(request: Request): Promise<Record<string, unknown>> {
  try {
    const value = await request.json()
    if (!value || Array.isArray(value) || typeof value !== 'object') throw new Error()
    return value
  } catch { throw new AppError('invalid_request') }
}
export function requireString(value: unknown, pattern: RegExp): string {
  if (typeof value !== 'string' || value.length > 255 || !pattern.test(value)) throw new AppError('invalid_request')
  return value
}
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
