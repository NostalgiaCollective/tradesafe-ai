import {cookies} from 'next/headers'
import {createClient} from '@supabase/supabase-js'
import {demoConfig,demoCredentials,demoLimiter,sealDemo,DEMO_COOKIE,demoBody} from '@/lib/staging/demo.mjs'
import {demoClient} from '@/lib/server/demo'
const admit=demoLimiter()
const headers={'Cache-Control':'private, no-store'}
function originOK(request){return request.headers.get('origin')===process.env.NEXT_PUBLIC_APP_URL}
export async function POST(request){
 const config=demoConfig();if(!config)return Response.json({error:'The demo is not available.'},{status:503,headers})
 if(!originOK(request))return Response.json({error:'Open the demo link directly.'},{status:403,headers})
 const release=admit();if(!release)return Response.json({error:'Too many demo sign-in attempts. Wait one minute and try again.'},{status:429,headers:{...headers,'Retry-After':'60'}})
 try{
  if(Number(request.headers.get('content-length'))>1024)throw Error('size')
  const body=await demoBody(request)
  if(!demoCredentials(config,body.login,body.passphrase))return Response.json({error:'Check the demo login and passphrase Daniel supplied, then try again.'},{status:401,headers})
  const client=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(url,init)=>fetch(url,{...init,signal:AbortSignal.timeout(15000)})}})
  const {data,error}=await client.auth.signInWithPassword({email:config.email,password:config.password})
  if(error||data.user.id!==config.user)throw Error('auth')
  await demoClient(config,{token:data.session.access_token}).auth.getUser()
  const store=await cookies()
  // No Supabase access/refresh token is exposed to browser JavaScript or returned in JSON.
  store.set(DEMO_COOKIE,sealDemo(config,data.session.access_token,data.session.expires_at*1000),{httpOnly:true,secure:process.env.NEXT_PUBLIC_APP_URL.startsWith('https:'),sameSite:'strict',path:'/',maxAge:3600})
  return Response.json({next:'/sites/'+config.site+'/electrical'},{headers})
 }catch{return Response.json({error:'Demo sign-in was not completed. Try again, or ask Daniel to check demo access.'},{status:503,headers})}
 finally{release()}
}
export async function DELETE(request){
 if(!originOK(request))return new Response(null,{status:403,headers})
 const store=await cookies();store.delete(DEMO_COOKIE);return Response.json({ok:true},{headers})
}
