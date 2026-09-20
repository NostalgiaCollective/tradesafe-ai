import {test,devices} from '@playwright/test'
import {createClient} from '@supabase/supabase-js'
import {randomBytes,randomUUID} from 'node:crypto'
import {API_ORIGIN,APP_ORIGIN,localEnvironment} from '../../scripts/ci/local-environment.mjs'
import {expectSuccess} from '../../scripts/staging/assertions.mjs'
import {followUpWorkflow} from '../fixtures/follow-up.mjs'

test('WebKit daily follow-up: scoped counts, progress recovery, supervisor verification and evidence integrity',async({browser})=>{
 localEnvironment({API_URL:process.env.NEXT_PUBLIC_SUPABASE_URL,ANON_KEY:process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,SERVICE_ROLE_KEY:process.env.SUPABASE_SERVICE_ROLE_KEY})
 const config={auth:{persistSession:false,autoRefreshToken:false}},admin=createClient(API_ORIGIN,process.env.SUPABASE_SERVICE_ROLE_KEY,config),actors={}
 // Provider-assisted disposable local actors, not delivered-email signup evidence.
 for(const role of ['OWNER','WORKER','SUPERVISOR']){
  const credentials={email:'follow-up-'+role.toLowerCase()+'-'+randomUUID()+'@example.test',password:randomBytes(24).toString('base64url')}
  const {user}=expectSuccess(await admin.auth.admin.createUser({...credentials,email_confirm:true})),client=createClient(API_ORIGIN,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,config)
  expectSuccess(await client.auth.signInWithPassword(credentials));actors[role]={...credentials,id:user.id,client,apiOrigin:API_ORIGIN}
 }
 await followUpWorkflow({browser,origin:APP_ORIGIN,actors,options:{...devices['iPhone 13'],localOnly:true}})
})
