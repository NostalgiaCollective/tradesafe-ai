'use client'
import {useEffect,useState} from 'react'
import {createClient} from '@/lib/supabase/client'
import {entries,draftKey,removeAll} from '@/lib/client/device-store.mjs'
export default function DeviceAccount({actor,children,demo=false}){const [ended,setEnded]=useState('');useEffect(()=>{
 if(!actor||demo)return
 try{for(const v of entries(localStorage))if(v.actor!==actor)localStorage.removeItem(draftKey(v))}catch{}
 const {data}=createClient().auth.onAuthStateChange((event,session)=>{if(session?.user?.id&&session.user.id!==actor){try{removeAll(localStorage)}catch{}setEnded('account')}else if(event==='SIGNED_OUT')setEnded('session')})
 const check=e=>{if(e.persisted)window.location.reload()};window.addEventListener('pageshow',check)
 return()=>{data.subscription.unsubscribe();window.removeEventListener('pageshow',check)}
 },[actor,demo]);return ended?<main className="work-main"><h1>Your sign-in session changed</h1><p role="alert">This account’s editing screen is closed. {ended==='account'?'Previous-account device text copies have been removed where browser storage permits.':'Sign in as the same account to check any retained device text. Choosing Sign out explicitly removes device copies.'}</p><a href="/auth/login">Continue to sign in</a></main>:children}
