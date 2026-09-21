'use client'
import {useSyncExternalStore} from 'react'
const subscribe=()=>()=>{},clientReady=()=>true,serverReady=()=>false
// Server-rendered forms must not accept edits before their handlers are attached.
export function useClientReady(){return useSyncExternalStore(subscribe,clientReady,serverReady)}
