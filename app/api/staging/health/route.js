export const dynamic='force-dynamic'
export function GET(){
 return new Response(process.env.HOSTED_STAGING==='1'?'ok':'Not found',{status:process.env.HOSTED_STAGING==='1'?200:404,headers:{'Cache-Control':'private, no-store'}})
}
