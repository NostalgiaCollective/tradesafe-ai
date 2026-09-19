import 'server-only'
import { createClient } from '@supabase/supabase-js'
import { authenticatedClient } from './auth'
import { databaseError } from './workspace'
import { appOrigin } from './config'
import { AppError } from '../domain/errors'
import {assertExpectedActor} from '../domain/actor'
import { UUID } from '../domain/validation'
import { digest } from '../evidence/images.mjs'

export const PHOTO_BUCKET='tradesafe-evidence', PDF_BUCKET='tradesafe-exports'
export const privateHeaders={'Cache-Control':'private, no-store, max-age=0','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'}
export function storageServer() {
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY
 if(!url||!key||url.includes('flhsdtshwwuddzyguyhf'))throw new AppError('configuration')
 // No cookie adapter: this isolated client must never acquire an ordinary user's session.
 return createClient(url,key,{global:{fetch:(url,options={})=>fetch(url,{...options,signal:options.signal?AbortSignal.any([options.signal,AbortSignal.timeout(30000)]):AbortSignal.timeout(30000)})},auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}})
}
export function mutation(request){if(request.headers.get('origin')!==new URL(appOrigin()).origin)throw new AppError('denied')}
export async function reportAccess(id,edit=false,request){
 if(!UUID.test(id))throw new AppError('not_found')
 const {supabase,user}=await authenticatedClient()
 assertExpectedActor(user.id,request?.headers.get('x-expected-actor')??null)
 const result=await supabase.from('ts_reports').select('*').eq('id',id).maybeSingle()
 if(result.error)throw databaseError(result.error)
 const report=result.data;if(!report)throw new AppError('not_found')
 const member=await supabase.from('ts_members').select('role').eq('company_id',report.company_id).eq('user_id',user.id).eq('active',true).maybeSingle()
 if(member.error)throw databaseError(member.error)
 if(!member.data)throw new AppError('denied')
 if(edit){if(report.lifecycle!=='draft')throw new AppError('immutable');if(member.data.role==='worker'&&report.author_id!==user.id)throw new AppError('denied')}
 return {supabase,user,report}
}
export async function rpc(client,name,args){const r=await client.rpc(name,args);if(r.error)throw databaseError(r.error);return r.data}
export async function photoRow(access,id){
 if(!UUID.test(id))throw new AppError('not_found')
 const r=await access.supabase.from('ts_evidence').select('*').eq('report_id',access.report.id).eq('id',id).maybeSingle()
 if(r.error)throw databaseError(r.error);if(!r.data)throw new AppError('not_found');return r.data
}
export async function objectBytes(server,bucket,path,hash,size){
 const result=await server.storage.from(bucket).download(path)
 if(result.error||!result.data)throw new AppError('evidence_missing')
 const bytes=Buffer.from(await result.data.arrayBuffer())
 if(bytes.length!==size||digest(bytes)!==hash)throw new AppError('evidence_missing')
 return bytes
}
export async function retainObject(server,bucket,path,bytes,hash,type){
 const saved=await server.storage.from(bucket).upload(path,bytes,{contentType:type,cacheControl:'0',upsert:false})
 // A failed response can follow a committed upload. Read and verify the exact immutable object.
 if(saved.error){await objectBytes(server,bucket,path,hash,bytes.length)}
}
export async function cleanRemoved(server,row){
 // Always re-read the tombstone; unknown/ready/pending objects are never swept or deleted.
 const current=await server.rpc('ts_evidence_cleanup_candidate',{evidence_id:row.id})
 if(current.error||current.data.object_path!==row.object_path)throw new AppError('conflict')
 const result=await server.storage.from(PHOTO_BUCKET).remove([row.object_path])
 if(result.error)throw new AppError('unavailable')
}
