// Prepare one explicitly authorized recipient. This script never sends email.
import { existsSync,readFileSync,writeFileSync } from 'node:fs'
import { parseEnv } from 'node:util'
import { randomBytes,randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { requireStaging } from './config.mjs'
import { gitIdentity } from './evidence.mjs'

const config=requireStaging();if(!config)process.exit(2)
const {env}=config,setup=parseEnv(readFileSync('.staging/recovery-email.env','utf8'))
const recipient=setup.RECOVERY_TEST_EMAIL?.trim().toLowerCase()
if(!recipient||!recipient.includes('@'))throw Error('An explicitly authorized RECOVERY_TEST_EMAIL is required')
const key=parseEnv(readFileSync('.staging/server.env','utf8')).SUPABASE_SERVICE_ROLE_KEY
const claims=JSON.parse(Buffer.from(key.split('.')[1],'base64url').toString('utf8'))
if(claims.ref!==env.STAGING_ISOLATED_PROJECT_REF||claims.role!=='service_role')throw Error('Wrong staging credential')
const make=(key=env.NEXT_PUBLIC_SUPABASE_ANON_KEY)=>createClient(env.NEXT_PUBLIC_SUPABASE_URL,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}})
const admin=make(key),owner=make(),ordinary=make(),path='.staging/recovery-email-account.json'
let state=existsSync(path)?JSON.parse(readFileSync(path,'utf8')):null
if(state&&(state.email!==recipient||state.projectRef!==env.STAGING_ISOLATED_PROJECT_REF))throw Error('Existing recovery identity must be reconciled; refusing overwrite')
const ok=r=>{if(r.error)throw Error('Provider or database operation failed; inspect only sanitized status');return r.data}
const save=()=>writeFileSync(path,JSON.stringify(state,null,2))
const record={...gitIdentity(),at:new Date().toISOString(),projectRef:env.STAGING_ISOLATED_PROJECT_REF,emailSent:false}
try{
 // Check exact email before creating anything; never reset or repurpose an unknown existing account.
 let existing
 for(let page=1;page<=20;page++){
  const batch=ok(await admin.auth.admin.listUsers({page,perPage:100}))
  existing=batch.users.find(u=>u.email?.toLowerCase()===recipient)
  if(existing||batch.users.length<100)break
  if(page===20)throw Error('User inventory exceeds bounded scan; manual reconciliation required')
 }
 if(existing&&(!state||existing.user_metadata?.tradesafe_recovery_fixture!==state.marker))throw Error('Recipient already has an unrelated staging identity; no changes made')
 if(!state){state={email:recipient,password:randomBytes(32).toString('base64url'),marker:randomUUID(),projectRef:env.STAGING_ISOLATED_PROJECT_REF,createdAt:new Date().toISOString(),status:'prepared-before-create'};save()}
 if(!existing)existing=ok(await admin.auth.admin.createUser({email:recipient,password:state.password,email_confirm:true,user_metadata:{tradesafe_recovery_fixture:state.marker,full_name:'SYNTHETIC recovery email test'}})).user
 state.userId=existing.id;state.status='identity-created';save()
 const signed=ok(await ordinary.auth.signInWithPassword({email:recipient,password:state.password}))
 if(signed.user.id!==state.userId)throw Error('Identity mismatch')
 const phase3=JSON.parse(readFileSync('.staging/phase3-verification.json','utf8'))
 state.companyId=phase3.ids.company;state.reportId=phase3.ids.report;state.photoId=phase3.ids.photo;state.exportId=phase3.ids.export;save()
 const members=ok(await ordinary.from('ts_members').select('user_id,active').eq('company_id',state.companyId).eq('user_id',state.userId))
 if(!members.some(m=>m.active)){
  ok(await owner.auth.signInWithPassword({email:env.STAGING_OWNER_EMAIL,password:env.STAGING_OWNER_PASSWORD}))
  state.invitationToken??=randomBytes(32).toString('hex');save()
  ok(await owner.rpc('ts_command',{command:'invite',p:{companyId:state.companyId,requestId:randomUUID(),email:recipient,role:'worker',token:state.invitationToken}}))
  ok(await ordinary.rpc('ts_command',{command:'accept_invitation',p:{requestId:randomUUID(),token:state.invitationToken}}))
 }
 const report=ok(await ordinary.from('ts_reports').select('id,lifecycle').eq('id',state.reportId).single())
 const photo=ok(await ordinary.from('ts_evidence').select('id,state').eq('id',state.photoId).single())
 const pdf=ok(await ordinary.from('ts_exports').select('id,state').eq('id',state.exportId).single())
 if(report.lifecycle!=='finalized'||photo.state!=='ready'||pdf.state!=='ready')throw Error('Existing evidence fixture state differs; preserve and reconcile')
 state.status='ready-for-real-recovery-email';save()
 const serverPath='.staging/server.env',serverText=readFileSync(serverPath,'utf8'),serverEnv=parseEnv(serverText)
 if(serverEnv.RECOVERY_ALLOWED_EMAILS&&serverEnv.RECOVERY_ALLOWED_EMAILS!==recipient)throw Error('Existing recipient allowlist differs; no overwrite')
 if(!serverEnv.RECOVERY_ALLOWED_EMAILS)writeFileSync(serverPath,serverText.trimEnd()+'\nRECOVERY_ALLOWED_EMAILS='+recipient+'\n')
 record.status='PASS';record.userId=state.userId;record.provider=setup.SMTP_PROVIDER;record.smtpCredentialPresent=Boolean(setup.SMTP_PASSWORD);record.nextStep='Create/sign in to the free Resend account using the authorized recipient; save API key as SMTP_PASSWORD in ignored .staging/recovery-email.env. Then configure staging SMTP/template/exact redirect and verify actual delivered email.'
 console.log('PASS: dedicated authorized recovery account and retained-evidence access prepared; SMTP dispatch remains disabled; no email sent.')
}catch(error){record.status='BLOCKED';record.reason=error.message;process.exitCode=1;console.error('BLOCKED: preparation stopped safely; sanitized checkpoint saved.')}
finally{writeFileSync('.staging/recovery-email-preparation.json',JSON.stringify(record,null,2))}
