import 'server-only'
import {createClient} from '@supabase/supabase-js'
import {demoRpcAllowed} from '../staging/demo.mjs'
import {AppError} from '../domain/errors'

export function demoClient(config,session){
 const client=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:'Bearer '+session.token},fetch:(url,init)=>fetch(url,{...init,signal:AbortSignal.timeout(15000)})}})
 const rpc=client.rpc.bind(client)
 client.rpc=(name,args,...rest)=>name==='ts_invitation_context'?Promise.resolve({data:[],error:null}):demoRpcAllowed(name,args,config)?rpc(name,args,...rest):Promise.resolve({data:null,error:{message:'TS_denied'}})
 client.auth.getUser=async()=>{
  // A fresh Auth check plus live membership checks on every request: no cached revocation.
  const auth=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(url,init)=>fetch(url,{...init,signal:AbortSignal.timeout(15000)})}})
  const result=await auth.auth.getUser(session.token)
  if(result.error||result.data.user?.id!==config.user)throw new AppError('unauthorized')
  const memberships=await client.from('ts_members').select('company_id,role').eq('user_id',config.user).eq('active',true)
  if(memberships.error)throw new AppError('unavailable')
  if(memberships.data.length!==1||memberships.data[0].company_id!==config.company||memberships.data[0].role!=='supervisor')throw new AppError('denied')
  const company=await client.from('ts_companies').select('practice,name').eq('id',config.company).single()
  if(company.error||!company.data.practice||!company.data.name.includes('DEMO'))throw new AppError('denied')
  return {data:{user:{...result.data.user,app_metadata:{...result.data.user.app_metadata,phone_demo:true,demo_site:config.site}}},error:null}
 }
 return client
}
