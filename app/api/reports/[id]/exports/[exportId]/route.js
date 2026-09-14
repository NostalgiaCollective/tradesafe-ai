import { reportAccess,storageServer,PHOTO_BUCKET,PDF_BUCKET,objectBytes,privateHeaders } from '@/lib/server/evidence'
import { UUID } from '@/lib/domain/validation'
import { AppError,errorResponse } from '@/lib/domain/errors'
export const runtime='nodejs'
export async function GET(_request,{params}){try{
 const {id,exportId}=await params,access=await reportAccess(id)
 if(!UUID.test(exportId))throw new AppError('not_found')
 const r=await access.supabase.from('ts_exports').select('*').eq('id',exportId).eq('report_id',id).maybeSingle()
 if(r.error)throw new AppError('query_failed');if(!r.data||r.data.state!=='ready')throw new AppError('not_found')
 const server=storageServer()
 // Recheck retained photo integrity even when serving an already-generated export.
 for(const e of r.data.snapshot.report.evidence_snapshot||[])await objectBytes(server,PHOTO_BUCKET,e.object_path,e.sha256,e.byte_size)
 const bytes=await objectBytes(server,PDF_BUCKET,r.data.object_path,r.data.sha256,r.data.byte_size)
 await reportAccess(id)
 return new Response(bytes,{headers:{...privateHeaders,'Content-Type':'application/pdf','Content-Disposition':'attachment; filename="tradesafe-'+id+'-v1.pdf"'}})
}catch(e){return errorResponse(e)}}
