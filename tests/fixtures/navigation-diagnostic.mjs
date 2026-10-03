// Synthetic test diagnostics only: never log field values, page text, query strings,
// cookies, storage, credentials, photos or raw browser/provider error messages.
export async function navigationDiagnostic(contexts,error){
 const pages=[]
 for(const context of contexts)for(const page of context.pages()){
  try{pages.push(await page.evaluate(()=>({
   path:location.pathname.replace(/[a-f0-9]{8}-[a-f0-9-]{27}/gi,':record'),ready:document.readyState,
   loading:!!document.querySelector('[aria-busy="true"]'),
   reportStatus:!!document.querySelector('#report-status'),
   siteField:!!document.querySelector('#brief-site'),
   siteFieldDisabled:document.querySelector('#brief-site')?.disabled??null,
   saveState:['Saved','Saved to server','Saving','Unsaved changes','Not saved'].find(s=>document.querySelector('.save-state')?.textContent===s)||'other-or-absent',
   alerts:document.querySelectorAll('[role="alert"]').length,
   errorBoundary:!!Array.from(document.querySelectorAll('h1')).find(e=>['Something went wrong','Your sign-in session changed','Company access unavailable','Page or report not found','Loading your workspace'].includes(e.textContent)),
  }))) }catch{pages.push({unavailable:true})}
 }
 return {operation:(error.message||'').match(/^(?:page|locator)\.[A-Za-z]+/)?.[0]||'assertion',pages}
}
