import 'server-only'
import { redirect } from 'next/navigation'
import { connection } from 'next/server'
import { authenticatedClient } from './auth'
import { AppError } from '../domain/errors.ts'
import { safeRedirect } from '../domain/validation.ts'

export async function pageClient(returnTo: string) {
  // Do not contact auth or validate runtime services during static generation.
  await connection()
  try { return await authenticatedClient() }
  catch (error) {
    if (error instanceof AppError && error.code === 'unauthorized') {
      redirect('/auth/login?' + new URLSearchParams({ redirect: safeRedirect(returnTo), error: 'session_missing' }))
    }
    throw error
  }
}
