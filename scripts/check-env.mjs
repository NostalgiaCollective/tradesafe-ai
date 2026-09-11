import nextEnv from '@next/env'
import { validateEnvironment } from '../lib/domain/config.ts'
nextEnv.loadEnvConfig(process.cwd())
const result = validateEnvironment(process.env)
console.log(JSON.stringify({ services: result.services, issues: result.issues }, null, 2))
process.exitCode = (process.argv.includes('--all-services')
  ? Object.values(result.services).every(Boolean) : result.services.supabase) ? 0 : 1
