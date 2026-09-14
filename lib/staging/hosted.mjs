import {createHash,timingSafeEqual} from 'node:crypto'
import {validPublicKey} from '../domain/config.ts'

export const STAGING_PROJECT='yqkiizimbtlygovkscoh'
export const HOSTED_ORIGIN='https://tradesafe-staging-yqkiizimbtlygovkscoh.onrender.com'
export const HOSTED_BRANCH='astra/production-mvp'
export const accessDigest=value=>createHash('sha256').update(value).digest('hex')
const claims=value=>{try{return JSON.parse(Buffer.from(value.split('.')[1],'base64url').toString())}catch{return {}}}

export function validateHostedEnvironment(env,{runtime=true}={}){
 const errors=[]
 const check=(name,condition)=>{if(!condition)errors.push(name)}
 check('HOSTED_STAGING',env.HOSTED_STAGING==='1')
 check('APP_ENV',env.APP_ENV==='staging')
 check('NEXT_PUBLIC_APP_URL',env.NEXT_PUBLIC_APP_URL===HOSTED_ORIGIN)
 check('RENDER_EXTERNAL_URL',env.RENDER_EXTERNAL_URL===HOSTED_ORIGIN)
 check('RENDER_GIT_BRANCH',env.RENDER_GIT_BRANCH===HOSTED_BRANCH)
 check('RENDER_GIT_COMMIT',/^[a-f0-9]{40}$/.test(env.RENDER_GIT_COMMIT||''))
 check('NEXT_PUBLIC_SUPABASE_URL',env.NEXT_PUBLIC_SUPABASE_URL===`https://${STAGING_PROJECT}.supabase.co`)
 const publicClaims=claims(env.NEXT_PUBLIC_SUPABASE_ANON_KEY||'')
 check('NEXT_PUBLIC_SUPABASE_ANON_KEY',validPublicKey(env.NEXT_PUBLIC_SUPABASE_ANON_KEY)&&(/^sb_publishable_/.test(env.NEXT_PUBLIC_SUPABASE_ANON_KEY)||publicClaims.role==='anon'&&publicClaims.ref===STAGING_PROJECT))
 check('RECOVERY_EMAIL_ENABLED',env.RECOVERY_EMAIL_ENABLED==='yes')
 check('RECOVERY_ALLOWED_EMAILS',/^[^\s,@]+@[^\s,@]+\.[^\s,@]+$/.test(env.RECOVERY_ALLOWED_EMAILS||''))
 check('optional integrations disabled',!env.STRIPE_SECRET_KEY&&!env.ANTHROPIC_API_KEY)
 if(runtime){
  const service=claims(env.SUPABASE_SERVICE_ROLE_KEY||'')
  check('SUPABASE_SERVICE_ROLE_KEY',service.role==='service_role'&&service.ref===STAGING_PROJECT)
  check('STAGING_ACCESS_SHA256',/^[a-f0-9]{64}$/.test(env.STAGING_ACCESS_SHA256||''))
 }
 if(errors.length)throw Error('Hosted staging configuration rejected: '+errors.join(', '))
 return {commit:env.RENDER_GIT_COMMIT,branch:HOSTED_BRANCH,origin:HOSTED_ORIGIN,projectRef:STAGING_PROJECT,publicKeyDigest:accessDigest(env.NEXT_PUBLIC_SUPABASE_ANON_KEY)}
}

// An additional staging perimeter, never a substitute for Supabase authorization.
export function hostedStagingGate(request,env){
 if(env.HOSTED_STAGING!=='1')return null
 const url=new URL(request.url)
 const headers={'Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow','Referrer-Policy':'no-referrer'}
 const reply=(body,status,extra={})=>new Response(body,{status,headers:{...headers,...extra}})
 if(env.APP_ENV!=='staging'||env.NEXT_PUBLIC_APP_URL!==HOSTED_ORIGIN||!/^[a-f0-9]{64}$/.test(env.STAGING_ACCESS_SHA256||''))return reply('Staging unavailable.',503)
 // Render liveness probes receive no credentials, data, commit or project information.
 if(url.pathname==='/api/staging/health'&&!url.search&&['GET','HEAD'].includes(request.method))return null
 if(url.origin!==HOSTED_ORIGIN)return reply('Unapproved staging origin.',421)
 const origin=request.headers.get('origin')
 if(origin&&origin!==HOSTED_ORIGIN)return reply('Request not allowed.',403)
 const header=request.headers.get('authorization')||''
 if(header.length<=1024&&/^Basic [A-Za-z0-9+/]+={0,2}$/.test(header)){
  const supplied=Buffer.from(accessDigest(Buffer.from(header.slice(6),'base64').toString('utf8')),'hex')
  if(timingSafeEqual(supplied,Buffer.from(env.STAGING_ACCESS_SHA256,'hex')))return null
 }
 return reply('Staging access requires the separate test access credential.',401,{'WWW-Authenticate':'Basic realm="TradeSafe staging", charset="UTF-8"'})
}
