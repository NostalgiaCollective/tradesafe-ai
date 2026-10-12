// A sign-in timeout does not prove authentication failed; retry uses the same account.
export async function signInDemo(login, passphrase, {fetcher=fetch, timeoutMs=30000}={}) {
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs)
 try {
  const response=await fetcher('/api/demo',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({login,passphrase}),cache:'no-store',signal:controller.signal})
  let data;try{data=await response.json()}catch{throw Error('Demo sign-in returned an unreadable response. Keep your details here and retry.')}
  if(!response.ok)throw Error(typeof data?.error==='string'?data.error:'Demo sign-in was not completed. Retry or ask Daniel to check access.')
  if(typeof data?.next!=='string'||!/^\/sites\/[0-9a-f-]{36}\/electrical$/.test(data.next))throw Error('Demo sign-in did not return a valid job. Retry or ask Daniel to check access.')
  return data.next
 } catch(error) {
  if(controller.signal.aborted)throw Error('Demo sign-in took too long. Keep your details here and try again.')
  if(error instanceof TypeError)throw Error('Could not connect to the demo. Check your connection and try again.')
  throw error
 } finally {clearTimeout(timer)}
}
