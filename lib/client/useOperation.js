'use client'
import {useRef,useState,useSyncExternalStore} from 'react'
const subscribe=()=>()=>{},clientReady=()=>true,serverReady=()=>false
export function useOperation(){
 const ready=useSyncExternalStore(subscribe,clientReady,serverReady),lock=useRef(false)
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('')
 async function run(pending,fn){
  if(lock.current||!ready)return
  lock.current=true;setBusy(true);setError('');setMessage(pending)
  try{setMessage(await fn()||'Completed.')}catch(e){setMessage('');setError(e.message||'No completion was confirmed. Keep this page open and retry.')}
  finally{lock.current=false;setBusy(false)}
 }
 return {ready,busy,error,message,run}
}
