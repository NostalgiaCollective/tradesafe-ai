'use client'
import { useCallback,useEffect,useRef,useState } from 'react'
import {useUnsavedWarning} from './useUnsavedWarning'
import { command } from './commands'
import { createClient } from '../supabase/client'
import { documentKey } from '../domain/document-key'

export function useDraft(initial,actor) {
 const [document,setDocument]=useState(initial.document),[status,setStatus]=useState('Saved'),[error,setError]=useState(''),[tick,setTick]=useState(0)
 const current=useRef(initial.document), confirmed=useRef(documentKey(initial.document)), revision=useRef(initial.revision)
 const pending=useRef(null), running=useRef(null), blocked=useRef(false)
 useUnsavedWarning(status!=='Saved',false)
 const change=useCallback(next=>{current.current=next;setDocument(next);setStatus('Not saved')},[])
 const save=useCallback(async()=>{
  if(running.current)return running.current
  if(blocked.current)return false
  if(!pending.current&&documentKey(current.current)===confirmed.current){setStatus('Saved');return true}
  const payload=pending.current||{id:initial.id,companyId:initial.company_id,revision:revision.current,requestId:crypto.randomUUID(),document:current.current}
  pending.current=payload;setStatus('Saving');setError('')
  running.current=(async()=>{
   try{
    const r=await command('save_report',payload,actor);revision.current=r.revision;confirmed.current=documentKey(r.document);pending.current=null
    setStatus(documentKey(current.current)===confirmed.current?'Saved':'Not saved');setTick(t=>t+1);return true
   }catch(e){setStatus('Not saved');setError(e.message);if(['conflict','immutable','denied'].includes(e.code))blocked.current=true;return false}
   finally{running.current=null}
  })()
  return running.current
 },[initial.id,initial.company_id,actor])
 useEffect(()=>{
  if(initial.lifecycle!=='draft'||error||blocked.current)return
  const timer=setTimeout(()=>{void save()},900);return()=>clearTimeout(timer)
 },[document,tick,error,save,initial.lifecycle])
 useEffect(()=>{
  const warn=e=>{if(pending.current||documentKey(current.current)!==confirmed.current){e.preventDefault();e.returnValue=''}}
  window.addEventListener('beforeunload',warn)
  const client=createClient()
  const {data}=client.auth.onAuthStateChange((_event,session)=>{
   // A different signed-in account must not inherit this page's in-memory draft.
   if(session?.user?.id&&session.user.id!==actor){window.removeEventListener('beforeunload',warn);window.location.replace('/dashboard')}
  })
  return()=>{window.removeEventListener('beforeunload',warn);data.subscription.unsubscribe()}
 },[actor])
 async function flush(){for(let n=0;n<3;n++){if(!await save())return false;if(documentKey(current.current)===confirmed.current)return true}return false}
 return {document,change,status,error,save,flush,revision,blocked}
}
