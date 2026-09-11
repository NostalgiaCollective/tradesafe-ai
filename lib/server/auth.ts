import 'server-only'
import { createClient } from '../supabase/server'
import { isAnonymousError } from '../domain/authorization.ts'
import { AppError } from '../domain/errors.ts'

export async function authenticatedClient() {
  const supabase = await createClient()
  try {
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error && !isAnonymousError(error)) throw new AppError('unavailable')
    if (!user) throw new AppError('unauthorized')
    return { supabase, user }
  } catch (error) {
    if (error instanceof AppError) throw error
    throw new AppError('unavailable')
  }
}
