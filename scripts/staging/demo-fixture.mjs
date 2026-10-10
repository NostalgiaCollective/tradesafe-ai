import {randomUUID,randomBytes,randomInt,createHash} from 'node:crypto'
import {createClient} from '@supabase/supabase-js'
import sharp from 'sharp'
import {emptyElectricalJob} from '../../lib/domain/electrical-job.mjs'
import {demoDigest} from '../../lib/staging/demo.mjs'
const ok=r=>{if(r.error)throw Error('Demo fixture operation failed');return r.data}
export function newDemoState(){
 const words='amber apple apron atlas birch bison bloom boat brass brick brook brush cable cedar chair cherry clay cloud coast coral crane dawn delta drift elm fern field finch flame flint forest frost garden gate glass grove harbor hazel hill honey iris lake lamp leaf lemon maple meadow mint moon moss oak ocean olive orange otter pebble pine plum pond quartz reed ridge river robin rose sail silver snow sparrow spruce stone storm sun timber trail tulip valley willow wind wren'.split(' ')
 const passphrase=Array.from({length:6},()=>words[randomInt(words.length)]).join('-')+'-'+randomInt(100000,1000000)
 const salt=randomBytes(16).toString('hex')
 return {company:randomUUID(),site:randomUUID(),concern:randomUUID(),photo:randomUUID(),report:randomUUID(),request:randomUUID(),invite:randomBytes(32).toString('hex'),email:'demo-'+randomUUID()+'@example.test',password:randomBytes(32).toString('base64url'),login:'demo',passphrase,salt,digest:demoDigest(passphrase,salt),key:randomBytes(32).toString('hex'),enabled:true}
}
export async function prepareDemoFixture({env,owner,admin,state,save}){
 const options={auth:{persistSession:false,autoRefreshToken:false}},actor=createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.NEXT_PUBLIC_SUPABASE_ANON_KEY,options)
 save()
 if(!owner){
  state.coordinator??={email:'demo-coordinator-'+randomUUID()+'@example.test',password:randomBytes(32).toString('base64url')};save()
  owner=createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.NEXT_PUBLIC_SUPABASE_ANON_KEY,options)
  let r=await owner.auth.signInWithPassword(state.coordinator)
  if(r.error&&!state.coordinator.id){ok(await admin.auth.admin.createUser({...state.coordinator,email_confirm:true}));r=await owner.auth.signInWithPassword(state.coordinator)}
  state.coordinator.id=ok(r).user.id;save()
 }
 if(!state.user){
  // Reconcile a lost createUser response via sign-in; never reset an existing account.
  let r=await actor.auth.signInWithPassword({email:state.email,password:state.password})
  if(r.error){ok(await admin.auth.admin.createUser({email:state.email,password:state.password,email_confirm:true,user_metadata:{full_name:'DEMO shared visitor activity'}}));r=await actor.auth.signInWithPassword({email:state.email,password:state.password})}
  state.user=ok(r).user.id;save()
 }else if(ok(await actor.auth.signInWithPassword({email:state.email,password:state.password})).user.id!==state.user)throw Error('Demo identity mismatch')
 const cmd=(client,fn,command,p)=>client.rpc(fn,{command,p:{companyId:state.company,requestId:randomUUID(),...p}}).then(ok)
 if(!ok(await owner.from('ts_companies').select('id').eq('id',state.company).maybeSingle()))await cmd(owner,'ts_command','create_company',{id:state.company,name:'DEMO — SYNTHETIC DATA',requestId:state.request})
 if(!ok(await owner.from('ts_companies').select('practice').eq('id',state.company).single()).practice)await cmd(owner,'ts_pilot_command','practice',{})
 const membership=ok(await owner.from('ts_members').select('active,role').eq('company_id',state.company).eq('user_id',state.user).maybeSingle())
 if(membership&&(!membership.active||membership.role!=='supervisor'))throw Error('Demo membership changed; do not reactivate automatically')
 if(!membership){await cmd(owner,'ts_command','invite',{email:state.email,role:'supervisor',token:state.invite});await cmd(actor,'ts_command','accept_invitation',{token:state.invite})}
 if(!ok(await actor.from('ts_sites').select('id').eq('id',state.site).maybeSingle()))await cmd(actor,'ts_site_command','create',{id:state.site,document:{name:'DEMO — SYNTHETIC DATA — kitchen renovation',address:'Fictional Maple House, Ontario (not a real customer)',instructions:'Shared demonstration activity only. Use fictional text and photos. No verified individual acknowledgement or work authorization. No automatic resets.'}})
 if(!ok(await actor.from('ts_electrical_jobs').select('revision').eq('site_id',state.site).maybeSingle()))await cmd(actor,'ts_electrical_command','save',{siteId:state.site,revision:0,document:{...emptyElectricalJob(),workKind:'alteration',setting:'Ontario residential setting requiring applicability review',scope:'DEMO: kitchen renovation documentation. Inspect the fictional panel-label observation, record a concern and try follow-up progress.',equipment:'SYNTHETIC PANEL A / CIRCUIT 4',business:'DEMO contractor — not a licensed business',personnel:'Shared demo visitor activity; no qualifications verified',handover:'DEMO — SYNTHETIC DATA. Notification applicability, qualifications, review and inspection evidence remain unresolved.'}})
 let concern=ok(await actor.from('ts_concerns').select('*').eq('id',state.concern).maybeSingle())
 if(!concern)concern=await cmd(actor,'ts_concern_command','create',{id:state.concern,siteId:state.site,document:{observation:'DEMO: the fictional panel label and kitchen job notes use different circuit names.',location:'Fictional kitchen / training panel A',immediate:'DEMO note only; no physical work performed.',observedAt:''}})
 if(!state.photoReady&&concern.lifecycle==='draft'){
  const bytes=await sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="720" height="540"><rect width="720" height="540" fill="#fff"/><rect x="50" y="100" width="620" height="270" fill="#ddd" stroke="#333" stroke-width="6"/><text x="90" y="180" font-size="34">DEMO TRAINING PANEL A</text><text x="100" y="270" font-size="34">CIRCUIT 4 / KITCHEN</text><text x="95" y="440" font-size="28">SYNTHETIC DATA ONLY</text><text x="90" y="490" font-size="24">Not an actual electrical installation</text></svg>')).jpeg().toBuffer()
  const row=await cmd(actor,'ts_concern_photo','reserve',{concernId:state.concern,id:state.photo,caption:'DEMO training panel A / circuit 4. Fictional sample evidence.',sha256:createHash('sha256').update(bytes).digest('hex'),byteSize:bytes.length,width:720,height:540})
  if(row.state!=='ready'){
   const upload=await admin.storage.from('tradesafe-evidence').upload(row.object_path,bytes,{contentType:'image/jpeg',upsert:false})
   if(upload.error){const existing=ok(await admin.storage.from('tradesafe-evidence').download(row.object_path));if(createHash('sha256').update(Buffer.from(await existing.arrayBuffer())).digest('hex')!==row.sha256)throw Error('Existing demo photo differs')}
   ok(await admin.rpc('ts_complete_concern_photo',{evidence_id:row.id,actor_id:state.user}))
  }
  state.photoReady=true;save()
 }
 if(concern.lifecycle==='draft')concern=await cmd(actor,'ts_concern_command','submit',{id:concern.id,revision:concern.revision})
 state.action=ok(await actor.from('ts_actions').select('id').eq('concern_id',state.concern).single()).id
 save();return actor
}
