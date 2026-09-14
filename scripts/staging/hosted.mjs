import {spawn} from 'node:child_process'
import {existsSync,readFileSync,writeFileSync} from 'node:fs'
import {validateHostedEnvironment} from '../../lib/staging/hosted.mjs'
const command=process.argv[2]
if(!['build','start'].includes(command))throw Error('Expected build or start')
// Never let an ignored workstation .env silently configure a hosted deployment.
if(command==='start'&&existsSync('.env.local'))throw Error('Hosted staging refuses workstation .env.local')
const identity=validateHostedEnvironment(process.env,{runtime:command==='start'})
const env={...process.env,NODE_ENV:'production',NEXT_TELEMETRY_DISABLED:'1',STRIPE_SECRET_KEY:'',ANTHROPIC_API_KEY:''}
for(const key of Object.keys(env))if(key.startsWith('STAGING_')||/SMTP|PASSWORD|TOKEN/.test(key))delete env[key]
if(command==='build')env.SUPABASE_SERVICE_ROLE_KEY=''
else env.STAGING_ACCESS_SHA256=process.env.STAGING_ACCESS_SHA256
if(command==='start'){
 const built=JSON.parse(readFileSync('.next-hosted/staging-build.json','utf8'))
 if(JSON.stringify(built)!==JSON.stringify(identity))throw Error('Refusing build/runtime identity mismatch')
}
const port=process.env.PORT||'10000'
if(!/^\d{2,5}$/.test(port)||Number(port)>65535)throw Error('Invalid listening port')
const args=command==='build'?['node_modules/next/dist/bin/next','build']:['scripts/staging/hosted-server.mjs']
const child=spawn(process.execPath,args,{env,stdio:'inherit',windowsHide:true})
child.on('error',()=>{console.error('Hosted staging process failed');process.exitCode=1})
child.on('exit',code=>{
 if(command==='build'&&code===0)writeFileSync('.next-hosted/staging-build.json',JSON.stringify(identity))
 process.exitCode=code??1
})
