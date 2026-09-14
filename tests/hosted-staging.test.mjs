import test from 'node:test'
import assert from 'node:assert/strict'
import {accessDigest,hostedStagingGate,validateHostedEnvironment,HOSTED_ORIGIN,HOSTED_BRANCH,STAGING_PROJECT} from '../lib/staging/hosted.mjs'

const token=role=>'test.'+Buffer.from(JSON.stringify({role,ref:STAGING_PROJECT})).toString('base64url')+'.synthetic'
const env={HOSTED_STAGING:'1',APP_ENV:'staging',NEXT_PUBLIC_APP_URL:HOSTED_ORIGIN,RENDER_EXTERNAL_URL:HOSTED_ORIGIN,RENDER_GIT_BRANCH:HOSTED_BRANCH,RENDER_GIT_COMMIT:'a'.repeat(40),NEXT_PUBLIC_SUPABASE_URL:`https://${STAGING_PROJECT}.supabase.co`,NEXT_PUBLIC_SUPABASE_ANON_KEY:token('anon'),SUPABASE_SERVICE_ROLE_KEY:token('service_role'),STAGING_ACCESS_SHA256:accessDigest('staging:synthetic-gate-secret'),RECOVERY_EMAIL_ENABLED:'yes',RECOVERY_ALLOWED_EMAILS:'authorized@example.test'}
const auth='Basic '+Buffer.from('staging:synthetic-gate-secret').toString('base64')
test('hosted startup rejects wrong projects, origins, branch, privileges and enabled optional integrations',()=>{
 assert.equal(validateHostedEnvironment(env).projectRef,STAGING_PROJECT)
 for(const [key,value] of Object.entries({APP_ENV:'production',HOSTED_STAGING:'',NEXT_PUBLIC_APP_URL:'https://evil.test',RENDER_EXTERNAL_URL:'https://another.onrender.com',RENDER_GIT_BRANCH:'main',RENDER_GIT_COMMIT:'unknown',NEXT_PUBLIC_SUPABASE_URL:'https://flhsdtshwwuddzyguyhf.supabase.co',NEXT_PUBLIC_SUPABASE_ANON_KEY:token('service_role'),SUPABASE_SERVICE_ROLE_KEY:token('anon'),STAGING_ACCESS_SHA256:'short',RECOVERY_ALLOWED_EMAILS:'one@example.test,two@example.test',RECOVERY_EMAIL_ENABLED:'no',STRIPE_SECRET_KEY:'enabled',ANTHROPIC_API_KEY:'enabled'}))assert.throws(()=>validateHostedEnvironment({...env,[key]:value}),/rejected/)
 assert.throws(()=>validateHostedEnvironment({...env,SUPABASE_SERVICE_ROLE_KEY:token('service_role').replace('test.','broken.').split('.')[0]}),/rejected/)
 assert.doesNotThrow(()=>validateHostedEnvironment({...env,SUPABASE_SERVICE_ROLE_KEY:'',STAGING_ACCESS_SHA256:''},{runtime:false}))
})
test('staging perimeter protects APIs, fragments, assets and encoded paths without granting account authorization',()=>{
 for(const path of ['/auth/recovery','/api/staging/identity','/api/reports/guessed/evidence/guessed','/_next/static/chunk.js','/photo.png','/%61pi/staging/identity']){
  const blocked=hostedStagingGate(new Request(HOSTED_ORIGIN+path),env)
  assert.equal(blocked.status,401);assert.match(blocked.headers.get('www-authenticate'),/^Basic/);assert.match(blocked.headers.get('cache-control'),/no-store/)
  assert.equal(hostedStagingGate(new Request(HOSTED_ORIGIN+path,{headers:{authorization:auth}}),env),null)
 }
 for(const authorization of ['Bearer x','Basic !!!','Basic '+Buffer.from('staging:wrong').toString('base64'),'Basic '+'A'.repeat(1025)])assert.equal(hostedStagingGate(new Request(HOSTED_ORIGIN+'/auth/recovery',{headers:{authorization}}),env).status,401)
 assert.equal(hostedStagingGate(new Request(HOSTED_ORIGIN+'/auth/recovery'),{...env,STAGING_ACCESS_SHA256:''}).status,503)
 assert.equal(hostedStagingGate(new Request('https://evil.test/auth/recovery',{headers:{authorization:auth}}),env).status,421)
 assert.equal(hostedStagingGate(new Request(HOSTED_ORIGIN+'/api/auth/recovery/password',{method:'POST',headers:{authorization:auth,origin:'https://evil.test'}}),env).status,403)
 assert.equal(hostedStagingGate(new Request(HOSTED_ORIGIN+'/api/staging/health'),env),null)
 assert.equal(hostedStagingGate(new Request(HOSTED_ORIGIN+'/api/staging/health?next=/auth/recovery'),env).status,401)
 assert.equal(hostedStagingGate(new Request(HOSTED_ORIGIN+'/api/staging/health',{method:'POST'}),env).status,401)
 assert.equal(hostedStagingGate(new Request('http://localhost:3000/auth/recovery'),{}),null)
})
