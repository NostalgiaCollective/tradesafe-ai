import { validateEnvironment } from './lib/domain/config'

export function register() {
  const result = validateEnvironment(process.env)
  // Nonfatal by design: marketing remains available; service entry points fail closed.
  if (result.issues.length) console.warn(JSON.stringify({ event: 'configuration_incomplete', issues: result.issues }))
}
