// Local preparation only: no publishing, networking, email, schema or provider changes.
import {existsSync,readFileSync,writeFileSync} from 'node:fs'
import {parseEnv} from 'node:util'
import {randomBytes} from 'node:crypto'
import {requireStaging} from './config.mjs'
import {gitIdentity} from './evidence.mjs'
import {accessDigest,validateHostedEnvironment,HOSTED_ORIGIN,HOSTED_BRANCH} from '../../lib/staging/hosted.mjs'
const config=requireStaging();if(!config)process.exit(2)
const {env}=config,server=parseEnv(readFileSync('.staging/server.env','utf8')),email=parseEnv(readFileSync('.staging/recovery-email.env','utf8'))
if(server.RECOVERY_ALLOWED_EMAILS!==email.RECOVERY_TEST_EMAIL)throw Error('Authorized recipient differs; no configuration overwritten')
const privateFile='.staging/hosted-access.json'
const access=existsSync(privateFile)?JSON.parse(readFileSync(privateFile,'utf8')):{username:'staging',password:randomBytes(32).toString('base64url'),phonePassword:randomBytes(24).toString('base64url')}
const hosted={NODE_VERSION:'24.14.0',HOSTED_STAGING:'1',APP_ENV:'staging',NEXT_PUBLIC_APP_URL:HOSTED_ORIGIN,NEXT_PUBLIC_SUPABASE_URL:env.NEXT_PUBLIC_SUPABASE_URL,NEXT_PUBLIC_SUPABASE_ANON_KEY:env.NEXT_PUBLIC_SUPABASE_ANON_KEY,SUPABASE_SERVICE_ROLE_KEY:server.SUPABASE_SERVICE_ROLE_KEY,STAGING_ACCESS_SHA256:accessDigest(access.username+':'+access.password),RECOVERY_EMAIL_ENABLED:'yes',RECOVERY_ALLOWED_EMAILS:server.RECOVERY_ALLOWED_EMAILS,STRIPE_SECRET_KEY:'',ANTHROPIC_API_KEY:''}
validateHostedEnvironment({...hosted,RENDER_EXTERNAL_URL:HOSTED_ORIGIN,RENDER_GIT_BRANCH:HOSTED_BRANCH,RENDER_GIT_COMMIT:gitIdentity().commit})
const target='.staging/hosted.env',contents=Object.entries(hosted).map(([k,v])=>k+'='+v).join('\n')+'\n'
if(existsSync(target)&&readFileSync(target,'utf8')!==contents)throw Error('Existing hosted configuration differs; reconcile without overwrite')
if(!existsSync(privateFile))writeFileSync(privateFile,JSON.stringify(access,null,2))
if(!existsSync(target))writeFileSync(target,contents)
const checkpoint='.staging/physical-phone-checkpoint.json'
if(!existsSync(checkpoint))writeFileSync(checkpoint,JSON.stringify({...gitIdentity(),status:'PREPARING; publication not approved',projectRef:env.STAGING_ISOLATED_PROJECT_REF,proposedOrigin:HOSTED_ORIGIN,createdAt:new Date().toISOString(),migrationsChanged:false,emailsSent:0,published:false,nextStep:'Finish local build/perimeter checks, then request exact Render publication and branch-only Vercel auto-preview suppression approval. Render login and no-payment-method eligibility remain unverified.'},null,2))
console.log('Prepared private hosting environment and separate access/phone credentials; nothing published or sent.')
