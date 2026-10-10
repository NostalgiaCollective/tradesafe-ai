import {readFileSync,writeFileSync,existsSync} from 'node:fs'
import {parseEnv} from 'node:util'
import {createClient} from '@supabase/supabase-js'
import {requireStaging} from './config.mjs'
import {newDemoState,prepareDemoFixture} from './demo-fixture.mjs'
const file='.staging/phone-demo-private.json'
try{
 const {env}=requireStaging(),key=parseEnv(readFileSync('.staging/server.env','utf8')).SUPABASE_SERVICE_ROLE_KEY
 const claim=JSON.parse(Buffer.from(key.split('.')[1],'base64url').toString());if(claim.ref!=='yqkiizimbtlygovkscoh'||claim.role!=='service_role')throw Error('identity')
 const options={auth:{persistSession:false,autoRefreshToken:false}},admin=createClient(env.NEXT_PUBLIC_SUPABASE_URL,key,options)
 const state=existsSync(file)?JSON.parse(readFileSync(file,'utf8')):newDemoState()
 const save=()=>writeFileSync(file,JSON.stringify(state,null,2)+'\n',{mode:0o600})
 await prepareDemoFixture({env,admin,state,save})
 state.url='https://tradesafe-staging-yqkiizimbtlygovkscoh.onrender.com/demo';state.status='PREPARED_NOT_HOSTED_VERIFIED';save()
 const {passphrase}=state,runtime={...state};for(const key of ['coordinator','passphrase','invite'])delete runtime[key]
 writeFileSync('.staging/phone-demo-runtime.env','PHONE_DEMO_CONFIG='+Buffer.from(JSON.stringify(runtime)).toString('base64')+'\n',{mode:0o600})
 writeFileSync('.staging/phone-demo-share.txt','TradeSafe phone demo (synthetic data only)\n'+state.url+'\nDemo login: '+state.login+'\nDemo passphrase: '+passphrase+'\nOpen the electrical job, expand Try this and explore. Anything entered is shared with other visitors; use fictional information only.\nNOT READY TO SHARE UNTIL HOSTED VERIFICATION PASSES.\n',{mode:0o600})
 console.log(JSON.stringify({status:'PREPARED_NOT_HOSTED_VERIFIED',privateFile:file,company:state.company,site:state.site,credentials:'Only in ignored private files; no emails sent'}))
}catch{console.error('Phone demo preparation stopped. Private journal retained; inspect before retry. No credentials or provider errors printed.');process.exitCode=1}
