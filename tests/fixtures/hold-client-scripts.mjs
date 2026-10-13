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
  try{await page.unroute(pattern,handler)}catch(error){failures.push(error)}
  // unroute removes the handler but does not wait for invocations already in
  // flight. Drain them before a test closes the page/context. Surface failure
  // here once, rather than as a late unhandled route error during cleanup.
  while(active.size)await Promise.all([...active])
  if(failures.length)throw failures[0]
 })()}
}
