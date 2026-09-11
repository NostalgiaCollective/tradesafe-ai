import 'server-only'
import { validateEnvironment, type Service } from '../domain/config.ts'
import { AppError } from '../domain/errors.ts'

export function requireService(service: Service) {
  if (!validateEnvironment(process.env).services[service]) throw new AppError('configuration')
}
export function appOrigin() {
  requireService('supabase')
  return new URL(process.env.NEXT_PUBLIC_APP_URL!).origin
}
