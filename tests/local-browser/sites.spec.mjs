import {test,devices} from '@playwright/test'
import {createClient} from '@supabase/supabase-js'
import {randomBytes,randomUUID} from 'node:crypto'
import {API_ORIGIN,APP_ORIGIN,localEnvironment} from '../../scripts/ci/local-environment.mjs'
import {expectSuccess} from '../../scripts/staging/assertions.mjs'
import {siteWorkflow} from '../fixtures/sites.mjs'
test('WebKit site workspace: fresh days, retrieval, history, retries and access boundaries',async({browser})=>{
 localEnvironment({API_URL:process.env.NEXT_PUBLIC_SUPABASE_URL,ANON_KEY:process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,SERVICE_ROLE_KEY:process.env.SUPABASE_SERVICE_ROLE_KEY})
 const config={auth:{persistSession:false,autoRefreshToken:false}},admin=createClient(API_ORIGIN,process.env.SUPABASE_SERVICE_ROLE_KEY,config),actors={}
 for(const role of ['OWNER','WORKER','SUPERVISOR']){
  const credentials={email:'brief-'+role.toLowerCase()+'-'+randomUUID()+'@example.test',password:randomBytes(24).toString('base64url')}
  const {user}=expectSuccess(await admin.auth.admin.createUser({...credentials,email_confirm:true})),client=createClient(API_ORIGIN,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,config)
  expectSuccess(await client.auth.signInWithPassword(credentials));actors[role]={...credentials,id:user.id,client,apiOrigin:API_ORIGIN}
 }
 await siteWorkflow({browser,origin:APP_ORIGIN,actors,options:{...devices['iPhone 13'],localOnly:true}})
})
