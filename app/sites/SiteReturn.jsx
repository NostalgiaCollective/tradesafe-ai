'use client'
import Link from 'next/link'
import {useEffect,useState} from 'react'
import {safeRedirect} from '@/lib/domain/validation'
// Session storage holds navigation position only, never draft or assessment data.
export default function SiteReturn({id,company,actor,from}){
 const fallback='/sites?company='+company,key='tradesafe:site-navigation:'+actor+':'+company+':'+id
 const [back,setBack]=useState(from||fallback)
 useEffect(()=>{
  let previous
  try{previous=JSON.parse(sessionStorage.getItem(key)||'null')}catch{}
  const valid=value=>typeof value==='string'&&safeRedirect(value).startsWith('/sites?')&&new URL(value,'https://internal.invalid').searchParams.get('company')===company
  const url=valid(from)?safeRedirect(from):valid(previous?.from)?safeRedirect(previous.from):fallback
  queueMicrotask(()=>setBack(url))
  if(!from&&Number.isFinite(previous?.scroll))requestAnimationFrame(()=>window.scrollTo(0,previous.scroll))
  const save=()=>{try{sessionStorage.setItem(key,JSON.stringify({from:url,scroll:window.scrollY}))}catch{}}
  document.addEventListener('click',save,true);window.addEventListener('pagehide',save)
  return()=>{document.removeEventListener('click',save,true);window.removeEventListener('pagehide',save)}
 },[key,company,from,fallback])
 return <Link href={back+'#site-'+id}>Back to sites</Link>
}
