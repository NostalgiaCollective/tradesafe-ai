// Operator inventory/cleanup only. Never use this privileged tool as user-authorization evidence.
import { readFileSync,writeFileSync,mkdirSync } from 'node:fs'
import { parseEnv } from 'node:util'
import { createClient } from '@supabase/supabase-js'
import { requireStaging } from './config.mjs'
import { gitIdentity } from './evidence.mjs'
const config=requireStaging();if(!config)process.exit(2)
const apply=process.argv.slice(2).includes('--apply')
if(process.argv.slice(2).some(a=>a!=='--apply'))throw Error('Only --apply is supported')
const key=parseEnv(readFileSync('.staging/server.env','utf8')).SUPABASE_SERVICE_ROLE_KEY
const claims=JSON.parse(Buffer.from(key.split('.')[1],'base64url').toString())
if(claims.role!=='service_role'||claims.ref!==config.env.STAGING_ISOLATED_PROJECT_REF)throw Error('Wrong server credential')
const server=createClient(config.env.NEXT_PUBLIC_SUPABASE_URL,key,{auth:{persistSession:false,autoRefreshToken:false}})
const evidence={...gitIdentity(),at:new Date().toISOString(),mode:apply?'cleanup-removed':'inventory',status:'running',rows:[]}
const save=()=>{mkdirSync('test-results/staging-runs',{recursive:true});writeFileSync('test-results/staging-runs/reconcile-'+evidence.at.replaceAll(':','-')+'.json',JSON.stringify(evidence,null,2))}
try{
 // Exact metadata tombstones only; no bucket listing, guessed prefix or recursive object removal.
 const result=await server.from('ts_evidence').select('id,report_id,object_path').eq('state','removed').order('id')
 if(result.error){evidence.failureCode=result.error.code;throw Error('Inventory unavailable')}
 for(const row of result.data){
  const current=await server.rpc('ts_evidence_cleanup_candidate',{evidence_id:row.id})
  if(current.error){evidence.failureCode=current.error.code;throw Error('Candidate unavailable')}
  if(current.data.object_path!==row.object_path||current.data.report_id!==row.report_id)throw Error('Unsafe cleanup candidate')
  if(apply){const removed=await server.storage.from('tradesafe-evidence').remove([row.object_path]);if(removed.error)throw Error('Cleanup unavailable')}
  evidence.rows.push({id:row.id,reportId:row.report_id,status:apply?'tombstone-object-removal-confirmed':'safe-tombstone-candidate'});save()
 }
 evidence.status='PASS';console.log('PASS: '+evidence.rows.length+' removed metadata rows '+(apply?'reconciled':'inventoried')+'; pending/ready/unknown objects untouched.')
}catch{evidence.status='FAIL';console.error('FAIL: cleanup stopped; inspect durable sanitized evidence before retry.');process.exitCode=1}
finally{save()}
