// Delay real Next client scripts while leaving streamed HTML and native controls
// available. No DOM state injection, request mocking or hydration sleeps.
export async function holdClientScripts(page,origin){
 let count=0,release
 const gate=new Promise(resolve=>{release=resolve}),pattern='**/_next/static/**'
 const handler=async route=>{
  if(new URL(route.request().url()).origin!==origin||route.request().resourceType()!=='script')return route.fallback()
  count++;await gate;await route.continue()
 }
 await page.route(pattern,handler)
 return {count:()=>count,release:async()=>{release();await page.unroute(pattern,handler)}}
}
