// Prepare synthetic records only. No account creation/reset, email, deletion or reactivation.
import {existsSync,readFileSync,writeFileSync} from 'node:fs'
import {randomUUID} from 'node:crypto'
import assert from 'node:assert/strict'
import {createClient} from '@supabase/supabase-js'
import sharp from 'sharp'
import {requireStaging} from './config.mjs'
import {emptyElectricalJob} from '../../lib/domain/electrical-job.mjs'

const file='.staging/electrician-rehearsal-private.json'
let stage='configuration'
try{
 const config=requireStaging();assert.ok(config)
 const {env}=config,base=JSON.parse(readFileSync('.staging/first-workday-practice-private.json','utf8'))
 assert.equal(env.NEXT_PUBLIC_SUPABASE_URL,'https://yqkiizimbtlygovkscoh.supabase.co')
 assert.equal(base.origin,'https://tradesafe-staging-yqkiizimbtlygovkscoh.onrender.com')
 assert.notEqual(base.accounts.SUPERVISOR.id,base.accounts.WORKER.id)
 const clients={},ok=r=>{assert.equal(r.error,null,'Staging operation failed');return r.data}
 for(const role of ['SUPERVISOR','WORKER']){
  stage='authenticate '+role
  const a=base.accounts[role],client=createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}})
  assert.equal(ok(await client.auth.signInWithPassword({email:a.email,password:a.password})).user.id,a.id)
  const member=ok(await client.from('ts_members').select('active,role').eq('company_id',base.company).eq('user_id',a.id).single())
  assert.equal(member.active,true,'Membership needs coordinator review');assert.equal(member.role,role.toLowerCase())
  clients[role]=client
 }
 const company=ok(await clients.SUPERVISOR.from('ts_companies').select('id,name,practice').eq('id',base.company).single())
 assert.equal(company.practice,true)
 const state=existsSync(file)?JSON.parse(readFileSync(file,'utf8')):{company:base.company,site:randomUUID(),requests:{site:randomUUID(),job:randomUUID()}}
 assert.equal(state.company,base.company)
 const save=()=>writeFileSync(file,JSON.stringify(state,null,2)+'\n',{mode:0o600})
 save() // Stable IDs before a request: interrupted preparation reuses them.
 const command=(fn,command,p)=>clients.SUPERVISOR.rpc(fn,{command,p:{companyId:state.company,...p}}).then(ok)
 stage='synthetic site'
 let site=ok(await clients.SUPERVISOR.from('ts_sites').select('id,archived,document').eq('id',state.site).maybeSingle())
 if(!site)site=await command('ts_site_command','create',{id:state.site,requestId:state.requests.site,document:{name:'Electrician rehearsal - kitchen renovation',address:'SYNTHETIC Practice House 10, Training Lane (not a real address)',instructions:'PRACTICE ONLY. Synthetic customer: Training Household. No actual electrical work, compliance decision or safety approval. Keep participant results separate from automated preflight.'}})
 assert.equal(site.archived,false,'Do not reactivate an archived rehearsal automatically')
 stage='synthetic electrical context'
 let job=ok(await clients.SUPERVISOR.from('ts_electrical_jobs').select('revision').eq('site_id',state.site).maybeSingle())
 if(!job)job=await command('ts_electrical_command','save',{siteId:state.site,revision:0,requestId:state.requests.job,document:{...emptyElectricalJob(),workKind:'alteration',setting:'Ontario residential setting requiring applicability review',scope:'SYNTHETIC kitchen renovation: record and follow up a discrepancy between the training circuit label and the job notes.',equipment:'TRAINING PANEL A / CIRCUIT 4',business:'PRACTICE contractor - credentials not verified',handover:'Rehearsal only. Notification applicability, qualifications and inspection evidence remain unresolved. Do not use this exercise as work authorization.'}})
 stage='training image'
 const photoFile='.staging/electrician-rehearsal-photo.jpg'
 if(!existsSync(photoFile))await sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="720" height="540"><rect width="720" height="540" fill="#fff"/><rect x="80" y="100" width="560" height="260" fill="#ddd" stroke="#333" stroke-width="6"/><text x="115" y="180" font-size="36">TRAINING PANEL A</text><text x="115" y="250" font-size="32">CIRCUIT 4 - LABEL REVIEW</text><text x="70" y="440" font-size="30">SYNTHETIC REHEARSAL ONLY</text><text x="130" y="490" font-size="24">Not an actual electrical installation</text></svg>')).jpeg({quality:85}).toFile(photoFile)
 Object.assign(state,{origin:base.origin,companyName:company.name,accounts:{SUPERVISOR:base.accounts.SUPERVISOR,WORKER:base.accounts.WORKER},gateFile:base.gateFile,siteUrl:base.origin+'/sites/'+state.site,jobUrl:base.origin+'/sites/'+state.site+'/electrical',photoFile,preparedAt:new Date().toISOString(),participantStatus:'NOT OBSERVED',initialRevision:state.initialRevision||job.revision})
 save()
 console.log(JSON.stringify({status:'PREPARED_SYNTHETIC_ONLY',site:state.site,privateFile:file,accounts:'Existing distinct supervisor and worker; active memberships checked; no reset/email'}))
}catch{console.error(JSON.stringify({status:'PREPARATION_FAILED',stage,privateFile:file,action:'Inspect current state before retry; stable IDs retained. No credentials or provider errors printed.'}));process.exitCode=1}
