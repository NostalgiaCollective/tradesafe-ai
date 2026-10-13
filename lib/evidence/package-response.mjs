import {createReadStream} from 'node:fs'
import {Readable} from 'node:stream'

export function packageFileResponse(file,row,signal,release=()=>{},headers={}){
 const stream=createReadStream(file.path)
 const cleanup=()=>{void file.cleanup().catch(()=>console.error(JSON.stringify({event:'package_cleanup_failed'}))).finally(release)}
 stream.once('close',cleanup)
 const abort=()=>stream.destroy()
 signal?.addEventListener('abort',abort,{once:true})
 stream.once('close',()=>signal?.removeEventListener('abort',abort))
 if(signal?.aborted)stream.destroy()
 return new Response(Readable.toWeb(stream),{headers:{...headers,'Content-Type':'application/zip','Content-Length':String(row.byte_size),'Content-Disposition':`attachment; filename="site-evidence-${row.site_id}-${row.first_day}-${row.last_day}.zip"`,'X-Content-SHA256':row.sha256,'X-Package-ID':row.id}})
}
