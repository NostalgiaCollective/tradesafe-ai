'use client'
import {useEffect} from 'react'

// Position/open panels only. Entered text is never put in navigation storage.
export function useJobPosition(actor,company,site){
 useEffect(()=>{
  const key='tradesafe:electrical-position:'+actor+':'+company+':'+site
  try{
   const previous=JSON.parse(sessionStorage.getItem(key)||'null')
   if(previous&&Array.isArray(previous.open))for(const id of previous.open){const panel=document.getElementById(id);if(panel?.matches('.electrical-job details'))panel.open=true}
   if(Number.isFinite(previous?.scroll)&&!location.hash)requestAnimationFrame(()=>window.scrollTo(0,previous.scroll))
  }catch{}
  const save=e=>{
   if(e?.type==='click'&&(e.defaultPrevented||!e.target.closest?.('a[href]')))return
   try{sessionStorage.setItem(key,JSON.stringify({scroll:window.scrollY,open:[...document.querySelectorAll('.electrical-job details[id][open]')].map(d=>d.id)}))}catch{}
  }
  document.addEventListener('click',save,true);window.addEventListener('pagehide',save)
  return()=>{document.removeEventListener('click',save,true);window.removeEventListener('pagehide',save)}
 },[actor,company,site])
}
