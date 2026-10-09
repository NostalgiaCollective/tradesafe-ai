'use client'
import {useRef,useState} from 'react'
import {request} from '@/lib/client/request.mjs'
export function useElectricalSecondary(url,actor){
 const [data,setData]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),lock=useRef(false),loaded=useRef(false)
 async function load(force=false){
  if(lock.current||loaded.current&&!force)return
  lock.current=true;setBusy(true);setError('')
  try{setData(await request(url+'?view=secondary',{headers:{'X-Expected-Actor':actor}}));loaded.current=true}
  catch(e){setError(e.message)}finally{lock.current=false;setBusy(false)}
 }
 return {data,busy,error,load}
}
