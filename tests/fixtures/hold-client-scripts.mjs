// Delay real Next client scripts while leaving streamed HTML and native controls
// available. No DOM state injection, request mocking or hydration sleeps.
export async function holdClientScripts(page,origin){
 let count=0,releaseGate,releasing=null
 const gate=new Promise(resolve=>{releaseGate=resolve}),pattern='**/_next/static/**',active=new Set(),failures=[]
 const handler=async route=>{
  if(new URL(route.request().url()).origin!==origin||route.request().resourceType()!=='script')return route.fallback()
  count++
  const pending=(async()=>{try{await gate;await route.continue()}catch(error){failures.push(error)}})()
  active.add(pending)
  try{await pending}finally{active.delete(pending)}
 }
 await page.route(pattern,handler)
 return {count:()=>count,release:()=>releasing||=(async()=>{
  releaseGate()
  // Playwright 1.63 removes a last page interceptor by automatically continuing
  // its in-flight routes. Our own continues must finish BEFORE unroute, or both
  // paths handle the same request. The client removes this handler synchronously
  // when unroute begins, so no new invocation can join after this drained set.
  while(active.size)await Promise.all([...active])
  try{await page.unroute(pattern,handler)}catch(error){failures.push(error)}
  if(failures.length)throw failures[0]
 })()}
}
