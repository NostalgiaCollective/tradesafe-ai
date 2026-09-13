import { resolve } from 'node:path'
process.env.PLAYWRIGHT_BROWSERS_PATH = resolve('.staging/browsers')
const { chromium, expect } = await import('@playwright/test')
import { createClient } from '@supabase/supabase-js'
import { requireStaging } from './config.mjs'
import { gitIdentity } from './evidence.mjs'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { setTimeout as delay } from 'node:timers/promises'
const configuration = requireStaging()
if (!configuration || configuration.env.STAGING_ISOLATED_PROJECT_REF === 'flhsdtshwwuddzyguyhf') process.exit(2)
const { env } = configuration
let previous
if (existsSync('.staging/natural-expiry-evidence.json')) {
  previous = JSON.parse(readFileSync('.staging/natural-expiry-evidence.json', 'utf8'))
  if (previous.status === 'running') {
    console.error('BLOCKED: an unfinished expiry checkpoint exists. Inspect its process, saved report and expiry before starting another session.')
    process.exit(2)
  }
  mkdirSync('test-results/staging-runs', { recursive: true })
  writeFileSync('test-results/staging-runs/expiry-' + previous.startedAt.replaceAll(':','-') + '.json', JSON.stringify(previous,null,2))
}
const evidence = { ...gitIdentity(), startedAt: new Date().toISOString(), projectFingerprint: createHash('sha256').update(env.STAGING_ISOLATED_PROJECT_REF).digest('hex'), status: 'running', checks: [], refreshUnavailable: 'Deliberate browser refresh transport failure and invalid synthetic refresh credential; issued access JWT and its expiry are unchanged.' }
const save = () => {
  mkdirSync('test-results/staging-runs', { recursive: true })
  const serialized = JSON.stringify(evidence,null,2)
  writeFileSync('.staging/natural-expiry-evidence.json', serialized)
  writeFileSync('test-results/staging-runs/expiry-' + evidence.startedAt.replaceAll(':','-') + '.json', serialized)
}
const check = name => { evidence.checks.push(name); save(); console.log('PASS: '+name) }
let browser, context, client
try {
  browser = await chromium.launch({headless:true})
  context = await browser.newContext({baseURL:env.NEXT_PUBLIC_APP_URL, viewport:{width:1440,height:1000}, serviceWorkers:'block'})
  const page = await context.newPage()
  async function login(target) {
    await target.goto('/auth/login')
    await target.getByLabel('Email',{exact:true}).fill(env.STAGING_WORKER_EMAIL)
    await target.getByLabel('Password',{exact:true}).fill(env.STAGING_WORKER_PASSWORD)
    const response = target.waitForResponse(r => r.url().includes('/auth/v1/token?grant_type=password'))
    await target.getByRole('button',{name:'Sign In',exact:true}).click()
    const session = await (await response).json()
    await target.waitForURL('**/dashboard')
    return session
  }
  const session = await login(page)
  evidence.expiresAt = new Date(session.expires_at*1000).toISOString()
  evidence.issuedLifetimeSeconds = session.expires_in
  const claims = JSON.parse(Buffer.from(session.access_token.split('.')[1], 'base64url').toString('utf8'))
  if (claims.exp !== session.expires_at) throw Error('Issued expiry mismatch')
  client = createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}})
  const auth = await client.auth.signInWithPassword({email:env.STAGING_WORKER_EMAIL,password:env.STAGING_WORKER_PASSWORD})
  if (auth.error) throw Error('Auth')
  const memberships = await client.from('ts_members').select('company_id').eq('user_id',auth.data.user.id).eq('active',true)
  if (memberships.error || !memberships.data.length) throw Error('No preserved company')
  // Use an existing synthetic membership; do not create another company.
  let companyId = memberships.data[0].company_id
  let id
  if (previous?.reportId) {
    const retained = await client.from('ts_reports').select('id,company_id,lifecycle,author_id').eq('id',previous.reportId).single()
    if (retained.error || retained.data.lifecycle !== 'draft' || retained.data.author_id !== auth.data.user.id || !memberships.data.some(m=>m.company_id===retained.data.company_id)) throw Error('Preserved draft unavailable')
    id = retained.data.id; companyId = retained.data.company_id
    await page.goto('/report/'+id)
    evidence.reusedPreservedDraft = true
  } else {
    await page.goto('/report/new?company='+companyId)
    await page.getByRole('button',{name:'Create saved draft',exact:true}).click()
    await page.waitForURL(/\/report\/[a-f0-9-]{36}$/)
    id = new URL(page.url()).pathname.split('/').at(-1)
  }
  evidence.reportId=id; evidence.companyId=companyId
  await page.getByLabel('Job address',{exact:true}).fill('SYNTHETIC saved before natural expiry')
  await expect(page.locator('.save-state')).toHaveText('Saved')
  check('Ordinary worker browser sign-in and persisted draft before elapsed expiry')
  const cookies = await context.cookies()
  const cookieName = 'sb-'+env.STAGING_ISOLATED_PROJECT_REF+'-auth-token'
  const authCookies = cookies.filter(c=>c.name===cookieName||c.name.startsWith(cookieName+'.')).sort((a,b)=>a.name.localeCompare(b.name))
  const encoded = authCookies.map(c=>c.value).join('')
  if (!encoded.startsWith('base64-')) throw Error('Unsupported cookie encoding')
  const stored=JSON.parse(Buffer.from(encoded.slice(7),'base64url').toString('utf8'))
  if (stored.access_token!==session.access_token) throw Error('Session mismatch')
  stored.refresh_token='synthetic-refresh-unavailable'
  const replacement='base64-'+Buffer.from(JSON.stringify(stored)).toString('base64url')
  let offset=0
  await context.addCookies(authCookies.map((cookie,index)=>{
    const length=index===authCookies.length-1?replacement.length-offset:cookie.value.length
    const value=replacement.slice(offset,offset+length);offset+=length
    return {...cookie,value}
  }))
  await context.route('**/auth/v1/token?grant_type=refresh_token',route=>route.abort('failed'))
  await page.reload()
  await expect(page.getByLabel('Job address',{exact:true})).toHaveValue('SYNTHETIC saved before natural expiry')
  check('Original issued JWT preserved; refresh deliberately unavailable')
  evidence.clockSkewWaitSeconds=45
  evidence.nextStep='Wait until expiresAt plus 45 seconds (beyond PostgREST clock-skew allowance); assert real Data API token rejection, retained editor input, then re-login/retry.';save()
  while(Date.now()<session.expires_at*1000+45000) await delay(Math.min(30000,session.expires_at*1000+45000-Date.now()))
  const expired=await fetch(env.NEXT_PUBLIC_SUPABASE_URL+'/rest/v1/ts_reports?select=id&id=eq.'+id,{headers:{apikey:env.NEXT_PUBLIC_SUPABASE_ANON_KEY,Authorization:'Bearer '+session.access_token}})
  evidence.expiredHttpStatus=expired.status;save()
  if(expired.status!==401) throw Error('Expected expired JWT rejection')
  const body=await expired.json()
  evidence.expiredErrorCode=/^[A-Z0-9_]+$/.test(body.code||'') ? body.code : 'unclassified';save()
  if(!/expir/i.test(body.message||'')) throw Error('Not an expiry rejection')
  check('Unmodified server-issued access JWT naturally expired and Data API rejected it')
  await page.getByLabel('Job address',{exact:true}).fill('SYNTHETIC edit retained after natural expiry')
  await expect(page.locator('main').getByRole('alert')).toContainText(/sign in|unavailable/i)
  await expect(page.getByLabel('Job address',{exact:true})).toHaveValue('SYNTHETIC edit retained after natural expiry')
  await expect(page.locator('.save-state')).toHaveText('Not saved')
  check('Expired session save fails safely and preserves in-memory input')
  await context.unrouteAll({behavior:'wait'})
  const signIn=await context.newPage();await login(signIn)
  await page.getByRole('button',{name:'Retry saving',exact:true}).click()
  await expect(page.locator('.save-state')).toHaveText('Saved')
  await page.reload()
  await expect(page.getByLabel('Job address',{exact:true})).toHaveValue('SYNTHETIC edit retained after natural expiry')
  check('Re-login and retry persist the same retained edit, confirmed after reload')
  evidence.status='PASS';evidence.nextStep='Timed expiry verification complete; retain the synthetic report.'
} catch(error) {
  evidence.status='FAIL';evidence.nextStep='Inspect source locations and preserve current fixture before retry.'
  evidence.failureLines=[...(error.stack||'').matchAll(/natural-expiry\.mjs:(\d+)/g)].map(m=>Number(m[1]))
  console.error('FAIL: natural expiry verification; see sanitized local evidence.');process.exitCode=1
} finally { evidence.finishedAt=new Date().toISOString();save();await context?.close();await browser?.close();await client?.auth.signOut({scope:'local'}).catch(()=>{}) }
