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
    // Authentication and API endpoints are never post-login destinations.
    if (!['/dashboard','/reports','/actions','/settings','/join','/briefs','/brief-content'].includes(url.pathname) && !/^\/report\/[A-Za-z0-9_-]+$/.test(url.pathname) && !(/^\/briefs\//.test(url.pathname)&&UUID.test(url.pathname.slice(8)))) return fallback
    const query = new URLSearchParams()
    const one = (key:string) => url.searchParams.getAll(key).length===1 ? url.searchParams.get(key) : null
    const company=one('company')
    if(company&&UUID.test(company)&&['/dashboard','/reports','/actions','/settings','/report/new','/briefs','/brief-content'].includes(url.pathname))query.set('company',company)
    if(url.pathname==='/dashboard'||url.pathname==='/reports'){
      const q=one('q'),status=one('status'),page=one('page'),trade=one('trade'),sort=one('sort')
      if(trade&&['electrical','plumbing','roofing'].includes(trade))query.set('trade',trade)
      if(sort&&['oldest','work_date'].includes(sort))query.set('sort',sort)
      if(q?.trim()&&q.length<=120&&!/[\u0000-\u001f\u007f]/.test(q))query.set('q',q.trim())
      if(status==='draft'||status==='finalized'||status==='amended')query.set('status',status)
      if(page&&/^\d{1,5}$/.test(page)&&Number(page)<=10000)query.set('page',String(Number(page)))
    }
    if(url.pathname==='/actions'){
      if(one('mine')==='0')query.set('mine','0')
      if(one('closed')==='1')query.set('closed','1')
      const status=one('status'),page=one('page'),focus=one('focus')
      if(status&&['outstanding','attention','awaiting_verification','closed','all'].includes(status))query.set('status',status)
      if(page&&/^\d{1,5}$/.test(page)&&Number(page)<=10000)query.set('page',String(Number(page)))
      if(focus&&UUID.test(focus))query.set('focus',focus)
    }
    if(url.pathname==='/brief-content'){const version=one('version');if(version&&/^[a-z0-9-]{1,100}$/.test(version))query.set('version',version)}
    if(url.pathname.startsWith('/briefs/')){
      const step=one('step'),version=one('version')
      if(step&&/^[1-4]$/.test(step))query.set('step',step)
      if(version&&/^[1-9]\d{0,8}$/.test(version))query.set('version',version)
    }
    const action=one('action');if(url.pathname.startsWith('/report/')&&action&&UUID.test(action))query.set('action',action)
    const steps = url.searchParams.getAll('step')
    if (url.pathname.startsWith('/report/') && steps.length === 1 && /^[1-5]$/.test(steps[0])) query.set('step', steps[0])
    const from=one('from')
    if(url.pathname.startsWith('/report/')&&from&&/^\/(dashboard|reports|actions)\?/.test(from)){
      const list=safeRedirect(from)
      if(new URL(list,'https://internal.invalid').searchParams.has('company'))query.set('from',list)
    }
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
