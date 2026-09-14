import PDFDocument from 'pdfkit'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ANSWERS,answerState } from '../domain/inspection.ts'

export async function renderExport(job,photos) {
 const report=job.snapshot.report, expected=report.evidence_snapshot||[]
 if(photos.length!==expected.length||expected.some(e=>!photos.some(p=>p.id===e.id)))throw Error('Missing evidence')
 const doc=new PDFDocument({size:'A4',margin:48,bufferPages:true,info:{Title:'TradeSafe recorded observations',Author:'TradeSafe AI',Subject:'Finalized observation snapshot; content pending qualified review'}})
 const chunks=[],finished=new Promise((resolve,reject)=>{doc.on('data',chunk=>chunks.push(chunk));doc.on('end',()=>resolve(Buffer.concat(chunks)));doc.on('error',reject)})
 doc.font(readFileSync(join(process.cwd(),'assets/fonts/NotoSans-Regular.ttf')))
 // Preserve otherwise unsupported codepoints visibly instead of emitting invisible glyphs.
 const text=value=>Array.from(String(value??'')).map(c=>c==='\n'||doc._font.font.hasGlyphForCodePoint(c.codePointAt(0))?c:'[U+'+c.codePointAt(0).toString(16).toUpperCase()+']').join('')
 const line=(value,size=10)=>{doc.fontSize(size).text(text(value),{lineGap:3});doc.moveDown(0.4)}
 const heading=value=>{if(doc.y>680)doc.addPage();line(value,15)}
 try{
  line('Recorded job observations',22)
  line('Report '+report.id)
  line('Export '+job.id+' | Version '+job.export_version+' | Snapshot '+report.snapshot_version)
  line('Business: '+report.business_snapshot.name,13)
  for(const [key,value] of Object.entries(report.business_snapshot.details||{}))if(value)line(key.replaceAll('_',' ')+': '+value)
  line('Job: '+report.document.job.address,13)
  line('Client/reference: '+(report.document.job.client||'Not recorded'))
  line('Work date (entered by user): '+report.document.job.date)
  line('Server record creation time: '+report.created_at)
  line('Author: '+(report.identity_snapshot?.author||'Name not captured at finalization')+' | '+report.author_id)
  line('Finalized by: '+(report.identity_snapshot?.finalizer||'Name not captured at finalization')+' | '+report.finalized_by)
  line('Server finalization time: '+report.finalized_at)
  line('Template: '+report.template_id+' | '+report.template_snapshot.version)
  line('Export relationship cutoff (server): '+job.cutoff_at)
  heading('Limitations')
  line('Checklist content is pending qualified review. This document records observations; it does not certify legal compliance, authorize work, or resolve hazards. An account attribution or typed name is not a digital signature.')
  line('Photos are retained, normalized visual records. Upload time is server recorded; capture time, client clocks, EXIF, location and depicted conditions are not independently verified. EXIF is removed. Unsupported characters are shown using their Unicode codepoint.')
  line('Later corrective-action status and history are excluded from this snapshot export. Review the authorized Actions view for subsequent work; closing an action does not change the original findings.')
  if(report.amendment_of){heading('Amendment');line('Original report: '+report.amendment_of);line('Reason: '+report.amendment_reason)}
  heading('Related amendments at export cutoff')
  if(!job.snapshot.amendments.length)line('No amendments recorded at this cutoff. Later amendments are separate records and do not alter this PDF.')
  for(const a of job.snapshot.amendments)line(a.id+' | '+a.lifecycle+' | '+a.reason)
  doc.addPage();heading('Explicit observations and findings')
  for(const item of report.template_snapshot.items){
   if(doc.y>650)doc.addPage()
   const answer=report.document.answers[item.id]
   line(item.category+' | '+item.question,12)
   line('Recorded answer: '+ANSWERS[answerState(answer?.state)])
   if(answer?.note)line('Explanation: '+answer.note)
   if(answer?.controls)line('Immediate controls: '+answer.controls)
   doc.moveDown(0.6)
  }
  if(!photos.length){heading('Photographic evidence');line(report.evidence_snapshot===null?'This record predates retained photographic evidence. No retained photo snapshot was recorded.':'No photographs attached at finalization.')}
  for(const [index,e] of expected.entries()){
   const photo=photos.find(p=>p.id===e.id)
   doc.addPage();heading('Photographic evidence '+(index+1)+' of '+photos.length)
   line(e.caption,12)
   const y=doc.y, available=Math.max(160,Math.min(380,600-y))
   doc.image(photo.bytes,48,y,{fit:[499,available],align:'center',valign:'top'})
   doc.y=y+available+12
   line('Evidence ID: '+e.id)
   line('Uploaded by: '+e.uploader_label+' | '+e.uploader_id)
   line('Server upload time: '+e.uploaded_at)
   line('SHA-256: '+e.sha256,8)
   line('Caption is user supplied. Capture time and EXIF are unverified; metadata was removed.',9)
  }
  const pages=doc.bufferedPageRange()
  for(let p=0;p<pages.count;p++){doc.switchToPage(p);doc.fontSize(8).text('TradeSafe | '+report.id+' | '+(p+1)+' / '+pages.count,48,doc.page.height-32,{lineBreak:false})}
  doc.end()
  const result=await finished
  if(result.length>32*1024*1024)throw Error('Export size limit')
  return result
 }catch(error){doc.destroy();throw error}
}
