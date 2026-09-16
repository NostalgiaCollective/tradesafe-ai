// Offline, read-only validation. Does not connect, restore, delete or change permissions.
import {readFile} from 'node:fs/promises'
import {resolve,dirname} from 'node:path'
import {verifyRecoverySet,validateRestoreTarget} from '../../lib/operations/recovery-set.mjs'
try{
 const manifestPath=process.argv[2],targetPath=process.argv[3]
 if(!manifestPath)throw Error('Provide a private recovery-set manifest path; optionally an isolated-target descriptor')
 const path=resolve(manifestPath),manifest=JSON.parse(await readFile(path,'utf8'))
 const result=await verifyRecoverySet(dirname(path),manifest)
 if(targetPath){validateRestoreTarget(JSON.parse(await readFile(targetPath,'utf8')));result.targetDescriptor='VALIDATED; live emptiness/compatibility must still be checked by operator'}
 console.log(JSON.stringify(result))
}catch{console.error('Recovery validation failed. Check required coverage, target authorization, artifact paths, lengths, hashes and inventories. No restoration was performed.');process.exitCode=1}
