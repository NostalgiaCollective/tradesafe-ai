import {readFileSync} from 'node:fs'
import {validateHostedEnvironment} from '@/lib/staging/hosted.mjs'
export const dynamic='force-dynamic'
export const runtime='nodejs'
export function GET(){
 const headers={'Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow'}
 if(process.env.HOSTED_STAGING!=='1')return new Response('Not found',{status:404,headers})
 try{
  const identity=validateHostedEnvironment(process.env)
  const built=JSON.parse(readFileSync('.next-hosted/staging-build.json','utf8'))
  if(JSON.stringify(built)!==JSON.stringify(identity))throw Error('Build/runtime mismatch')
  return Response.json(identity,{headers})
 }catch{return Response.json({error:'Staging identity unavailable'},{status:503,headers})}
}
