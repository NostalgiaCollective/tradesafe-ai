import { loadStagingEnvironment, required, requireStaging } from './config.mjs'
const env = loadStagingEnvironment()
for (const name of required) console.log(name + ': ' + (env[name]?.trim() ? 'present' : 'missing'))
if (!requireStaging()) process.exitCode = 2
else console.log('PASS: configuration and recorded isolation attestation present. This is not a service connection test.')
