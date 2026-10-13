import 'server-only'
import {storageLease} from '../operations/storage-lease.mjs'
import {rpc} from './evidence'
export function beginStorageOperation(server,kind,id,actor,signal){
 return storageLease((command,args)=>rpc(server,'ts_storage_lease',{command,...args}),{kind,object_id:id,actor_id:actor},signal)
}
export async function endStorageOperation(lease){
 try{await lease?.close()}catch{
  // Expiry remains authoritative if the release response is unavailable.
  console.error(JSON.stringify({event:'storage_lease_release_failed'}))
 }
}
