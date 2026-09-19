'use client'
import {useEffect} from 'react'
const confirmedNavigation=Symbol('unsaved navigation confirmed')
export function useUnsavedWarning(unsaved,native=true){
 useEffect(()=>{
  const warn=e=>{if(unsaved){e.preventDefault();e.returnValue=''}}
  const navigate=e=>{
   if(e[confirmedNavigation]||!unsaved||e.defaultPrevented||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return
   const a=e.target.closest?.('a[href]');if(!a||a.target==='_blank'||a.hasAttribute('download'))return
   const url=new URL(a.href,location.href)
   if(url.origin===location.origin&&url.pathname===location.pathname)return
   if(!confirm('This page has unsaved work or an unconfirmed operation. Stay here to save or check it. Leave anyway?')){e.preventDefault();e.stopPropagation()}else e[confirmedNavigation]=true
  }
  if(native)window.addEventListener('beforeunload',warn);document.addEventListener('click',navigate,true)
  return()=>{window.removeEventListener('beforeunload',warn);document.removeEventListener('click',navigate,true)}
 },[unsaved,native])
}
