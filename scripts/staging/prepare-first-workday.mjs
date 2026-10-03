// Idempotent preparation in the existing isolated staging project only.
// No account creation, password resets, email or cleanup. Prepared actors stay private.
import {existsSync,readFileSync,writeFileSync} from 'node:fs'
import {randomUUID,randomBytes} from 'node:crypto'
import assert from 'node:assert/strict'
import {createClient} from '@supabase/supabase-js'
import {requireStaging} from './config.mjs'
import {expectSuccess} from './assertions.mjs'
const {env}=requireStaging(),file='.staging/first-workday-practice-private.json',actors={}
assert.equal(new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname,'yqkiizimbtlygovkscoh.supabase.co')
for(const role of ['OWNER','SUPERVISOR','WORKER']){const email=env['STAGING_'+role+'_EMAIL'],password=env['STAGING_'+role+'_PASSWORD'],client=createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}}),data=expectSuccess(await client.auth.signInWithPassword({email,password}));actors[role]={email,password,id:data.user.id,client}}
const state=existsSync(file)?JSON.parse(readFileSync(file)): {company:randomUUID(),site:randomUUID(),requests:{company:randomUUID(),practice:randomUUID(),site:randomUUID()},invitations:Object.fromEntries(['WORKER','SUPERVISOR'].map(r=>[r,{token:randomBytes(32).toString('hex'),requestId:randomUUID()}]))}
const save=()=>writeFileSync(file,JSON.stringify(state,null,2)+'\n');save()
const cmd=(role,fn,command,p)=>actors[role].client.rpc(fn,{command,p:{companyId:state.company,...p}}).then(expectSuccess)
await cmd('OWNER','ts_command','create_company',{id:state.company,name:'First workday practice',requestId:state.requests.company})
await cmd('OWNER','ts_pilot_command','practice',{requestId:state.requests.practice})
for(const role of ['WORKER','SUPERVISOR']){
 const m=expectSuccess(await actors.OWNER.client.from('ts_members').select('active,role').eq('company_id',state.company).eq('user_id',actors[role].id).maybeSingle())
 if(m&&!m.active)throw Error('Practice membership was revoked; coordinator review required')
 if(!m){const invite=state.invitations[role];await cmd('OWNER','ts_command','invite',{...invite,email:actors[role].email,role:role.toLowerCase()});await cmd(role,'ts_command','accept_invitation',{token:invite.token,requestId:invite.requestId})}
}
const site=expectSuccess(await actors.OWNER.client.from('ts_sites').select('id').eq('id',state.site).maybeSingle())
if(!site)await cmd('SUPERVISOR','ts_site_command','create',{id:state.site,requestId:state.requests.site,document:{name:'Training loading bay',address:'Synthetic location — not a real job',instructions:'PRACTICE only. Do not enter real site details. Use separate authenticated accounts; do not acknowledge for another person.'}})
state.accounts=Object.fromEntries(Object.entries(actors).map(([r,{email,password,id}])=>[r,{email,password,id}]))
state.origin='https://tradesafe-staging-yqkiizimbtlygovkscoh.onrender.com';state.gateFile='.staging/hosted-access.json';state.help=state.origin+'/help?company='+state.company;state.siteUrl=state.origin+'/sites/'+state.site;state.preparedAt=new Date().toISOString();save()
console.log(JSON.stringify({status:'Prepared without resets or emails',company:state.company,site:state.site,privateFile:file}))
