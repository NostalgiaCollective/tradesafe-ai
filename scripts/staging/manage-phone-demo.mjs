// Deliberate operator actions only. No record cleanup or existing account password reset.
import {readFileSync,writeFileSync} from 'node:fs'
import {createClient} from '@supabase/supabase-js'
import {requireStaging} from './config.mjs'
import {newDemoState} from './demo-fixture.mjs'
try{
 const command=process.argv[2];if(!['revoke','rotate'].includes(command))throw Error('Expected revoke or rotate')
 const {env}=requireStaging(),file='.staging/phone-demo-private.json',f=JSON.parse(readFileSync(file,'utf8'))
 if(!f.coordinator?.id||!f.user||!f.company)throw Error('Missing dedicated fixture')
 if(command==='revoke'){
  const client=createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}})
  const auth=await client.auth.signInWithPassword({email:f.coordinator.email,password:f.coordinator.password});if(auth.error||auth.data.user.id!==f.coordinator.id)throw Error('identity')
  const r=await client.rpc('ts_command',{command:'member',p:{companyId:f.company,userId:f.user,role:'remove'}});if(r.error)throw Error('revoke')
  f.status='REVOKED';f.revokedAt=new Date().toISOString()
 }else{
  // Pending config is not active until the operator applies it to existing Render.
  const next=newDemoState(),runtime={...f,passphrase:next.passphrase,salt:next.salt,digest:next.digest,key:next.key}
  writeFileSync('.staging/phone-demo-rotation-private.json',JSON.stringify(runtime,null,2)+'\n',{mode:0o600})
  for(const key of ['coordinator','passphrase','invite'])delete runtime[key]
  writeFileSync('.staging/phone-demo-rotation.env','PHONE_DEMO_CONFIG='+Buffer.from(JSON.stringify(runtime)).toString('base64')+'\n',{mode:0o600})
  f.rotationPending=true
 }
 writeFileSync(file,JSON.stringify(f,null,2)+'\n',{mode:0o600})
 console.log(command==='revoke'?'Demo membership revoked. Existing data preserved. Verify denial; no automatic reactivation.':'Rotation prepared privately, not active. Apply the single config key to existing staging after exact CI; verify before sharing. Revoked membership stays revoked.')
}catch{console.error('Demo management stopped. Inspect private state; no credentials or provider errors printed.');process.exitCode=1}
