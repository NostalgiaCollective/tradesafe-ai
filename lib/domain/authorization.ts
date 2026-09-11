import { AppError } from './errors.ts'

export function isProtectedPath(path: string) {
  return ['/dashboard', '/report', '/reports', '/settings'].some(root => path === root || path.startsWith(`${root}/`))
}
export function ownsRecord(userId: string | undefined, ownerId: string | undefined) {
  return Boolean(userId && ownerId && userId === ownerId)
}
export function requireOwner(userId: string, record: { user_id: string } | null) {
  if (!record || !ownsRecord(userId, record.user_id)) throw new AppError('not_found')
}
export function isAnonymousError(error: { name?: string; status?: number; code?: string } | null) {
  return !error || error.name === 'AuthSessionMissingError' ||
    ['refresh_token_not_found', 'refresh_token_already_used', 'session_not_found', 'bad_jwt'].includes(error.code || '')
}
