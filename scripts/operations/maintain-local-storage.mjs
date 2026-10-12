// Deliberately restricted to the existing disposable CI target, never hosted data.
import assert from 'node:assert/strict'
import {execFile} from 'node:child_process'
import {promisify} from 'node:util'
import {pathToFileURL} from 'node:url'
import {createClient} from '@supabase/supabase-js'
import {maintainStorage} from '../../lib/operations/storage-maintenance.mjs'
import {localEnvironment,API_ORIGIN} from '../ci/local-environment.mjs'
const exec=promisify(execFile)
export async function localMaintenance(env,options={}){
 assert.equal(process.platform,'linux');assert.equal(process.env.GITHUB_ACTIONS,'true');assert.equal(process.env.GITHUB_REPOSITORY,'NostalgiaCollective/tradesafe-ai')
 localEnvironment({API_URL:env.NEXT_PUBLIC_SUPABASE_URL,ANON_KEY:env.NEXT_PUBLIC_SUPABASE_ANON_KEY,SERVICE_ROLE_KEY:env.SUPABASE_SERVICE_ROLE_KEY})
 const inspect=async signal=>{
  const {stdout}=await exec('docker',['inspect','supabase_db_tradesafe-ci'],{signal,timeout:5000,maxBuffer:1024*1024})
  const c=JSON.parse(stdout)[0]
  assert.equal(c.Name,'/supabase_db_tradesafe-ci');assert.equal(c.State.Running,true)
  const volumes=c.Mounts.filter(m=>m.Type==='volume').map(m=>m.Name).sort()
  assert.ok(volumes.length&&volumes.every(v=>v.endsWith('_tradesafe-ci')))
  const system=await exec('docker',['exec',c.Id,'psql','-X','-U','postgres','-d','postgres','-Atc','select system_identifier from pg_control_system()'],{signal,timeout:5000,maxBuffer:1024})
  return {id:c.Id,volumes,system:system.stdout.trim()}
 }
 const expected=await inspect(AbortSignal.timeout(10000))
 const client=signal=>createClient(API_ORIGIN,env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(url,init={})=>fetch(url,{...init,signal:AbortSignal.any([signal,init.signal,AbortSignal.timeout(10000)].filter(Boolean))})}})
 return maintainStorage({
  ...options,
  verifyTarget:async signal=>assert.deepEqual(await inspect(signal),expected),
  call:async(name,args,signal)=>{const r=await client(signal).rpc(name,args);if(r.error)throw new Error(r.error.message);return r.data},
  remove:async(bucket,path,signal)=>{const r=await client(signal).storage.from(bucket).remove([path]);if(r.error)throw Error('Storage removal failed')}
 })
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{
  const args=process.argv.slice(2)
  if(args.some(a=>!['--apply','--dry-run'].includes(a)))throw Error('Use --dry-run or --apply only')
  const {stdout}=await exec('supabase',['status','--workdir','.ci-local','-o','env'],{timeout:10000,maxBuffer:65536})
  const status=Object.fromEntries(stdout.split(/\r?\n/).filter(s=>/^[A-Z_]+=/.test(s)).map(s=>{const at=s.indexOf('=');return [s.slice(0,at),s.slice(at+1).replace(/^"|"$/g,'')]}))
  const result=await localMaintenance(localEnvironment(status),{apply:args.includes('--apply')})
  console.log(JSON.stringify(result))
  if(['completed_with_failures','time_limit'].includes(result.status))process.exitCode=1
 }catch{console.error(JSON.stringify({status:'maintenance_failed',reason:'Disposable target verification or bounded operation failed; inspect private operator context.'}));process.exitCode=1}
}
