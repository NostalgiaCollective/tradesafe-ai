'use client'
import {useEffect,useRef} from 'react'
export default function OperationFeedback({operation,returnTo}){
 const ref=useRef(null)
 useEffect(()=>{if(operation.error)ref.current?.scrollIntoView({block:'nearest'})},[operation.error])
 return <div ref={ref} aria-busy={operation.busy}>{operation.message&&<p role="status">{operation.message}</p>}{operation.error&&<div role="alert"><p>{operation.error}</p><a href={returnTo?'/auth/login?'+new URLSearchParams({redirect:returnTo}):'/auth/login'} target="_blank" rel="noopener noreferrer">Sign in in another tab</a><p>Return here to retry. Unsaved input is kept only while this page stays open.</p></div>}</div>
}
