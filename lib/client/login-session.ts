export const SESSION_MESSAGES = {
  missing: 'Your credentials were accepted, but this browser did not retain a usable session. Check that cookies are allowed for this site, then try Sign In again.',
  gate: 'Your credentials were accepted, but staging access could not be confirmed. Reopen the staging site and complete its separate access prompt, then try Sign In again.',
  unavailable: 'Your credentials were accepted, but we could not confirm your session with the site. Check your connection and try Sign In again.',
} as const

// Provider success alone does not establish that the next server request has a session.
// No token, identity or credential is sent in the body or returned by this check.
export async function confirmBrowserSession(fetcher: typeof fetch = fetch): Promise<string | null> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15000)
  try {
    const response = await fetcher('/api/auth/session', {
      method: 'GET', credentials: 'same-origin', cache: 'no-store', redirect: 'error', signal: controller.signal,
    })
    if (response.status === 401 && response.headers.has('www-authenticate')) return SESSION_MESSAGES.gate
    if (response.status === 401) return SESSION_MESSAGES.missing
    if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) return SESSION_MESSAGES.unavailable
    const result = await response.json()
    return result?.authenticated === true ? null : SESSION_MESSAGES.unavailable
  } catch { return SESSION_MESSAGES.unavailable }
  finally { clearTimeout(timeout) }
}
