import {createServer} from 'node:http'
import {readFileSync} from 'node:fs'
import next from 'next'
import {hostedStagingGate,validateHostedEnvironment,HOSTED_ORIGIN} from '../../lib/staging/hosted.mjs'
const identity=validateHostedEnvironment(process.env)
if(process.env.NODE_ENV!=='production')throw Error('Only a production Next build may be hosted')
if(JSON.stringify(JSON.parse(readFileSync('.next-hosted/staging-build.json','utf8')))!==JSON.stringify(identity))throw Error('Build/runtime identity mismatch')
const canonical=new URL(HOSTED_ORIGIN)
// Advertise the canonical HTTPS origin to Next independently of Render's internal port.
const app=next({dev:false,hostname:canonical.hostname,port:443})
await app.prepare()
const handle=app.getRequestHandler()
const server=createServer(async(req,res)=>{
 try{
  const health=req.url==='/api/staging/health'&&['GET','HEAD'].includes(req.method)
  if(!health&&(req.headers.host!==canonical.host||req.headers['x-forwarded-proto']!=='https')){
   res.writeHead(421,{'Cache-Control':'no-store'});res.end('Unapproved staging origin.');return
  }
  const headers=new Headers()
  for(const [key,value] of Object.entries(req.headers))if(value!==undefined)headers.set(key,Array.isArray(value)?value.join(','):value)
  const blocked=hostedStagingGate(new Request(HOSTED_ORIGIN+req.url,{method:req.method,headers}),process.env)
  if(blocked){res.writeHead(blocked.status,Object.fromEntries(blocked.headers));res.end(await blocked.text());return}
  if(health){res.writeHead(200,{'Cache-Control':'no-store'});res.end(req.method==='HEAD'?'':'ok');return}
  // Do not forward the perimeter credential into the app or a downstream provider.
  delete req.headers.authorization
  req.headers['x-forwarded-host']=canonical.host
  req.headers['x-forwarded-proto']='https'
  res.setHeader('Cache-Control','private, no-store')
  res.setHeader('Referrer-Policy','no-referrer')
  res.setHeader('X-Robots-Tag','noindex, nofollow')
  await handle(req,res)
 }catch{if(!res.headersSent)res.writeHead(503,{'Cache-Control':'no-store'});res.end('Staging unavailable.')}
})
const port=Number(process.env.PORT||10000)
if(!Number.isInteger(port)||port<1024||port>65535)throw Error('Invalid hosted port')
server.listen(port,process.argv.includes('--loopback-preflight')?'127.0.0.1':'0.0.0.0',()=>console.log('Hosted production staging ready'))
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>{server.close(()=>{void app.close().finally(()=>process.exit(0))});server.closeIdleConnections();setTimeout(()=>process.exit(0),5000).unref()})
