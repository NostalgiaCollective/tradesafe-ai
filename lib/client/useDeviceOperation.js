'use client'
import {useEffect,useRef,useState} from 'react'
import {createRecoveryScope} from './recovery-scope.mjs'
import {request} from './request.mjs'
import {draftKey,readDraft,writeDraft,textOnly} from './device-store.mjs'
// Extends the existing device store. Operation metadata is a recovery pointer,
// never a queue: only the explicit resume callback may reconcile it with the server.
export function useDeviceOperation({kind,id,company,siteId,actor,value,baseline={},revision=0,onRestore,dirty=true,engaged=true}){
 const scope={kind,id,company,siteId,actor},key=draftKey(scope),latest=useRef(null)
 latest.current={scope,value,baseline,revision,onRestore,dirty}
 const [enabled,setEnabled]=useState(false),[ready,setReady]=useState(false),[recovery,setRecovery]=useState(null),[error,setError]=useState(''),[savedAt,setSavedAt]=useState(null),[checking,setChecking]=useState(false)
 const active=useRef(false),token=useRef(null),last=useRef(''),blocked=useRef(false),scopeGate=useRef(null),authorizedKey=useRef(null)
 scopeGate.current||=createRecoveryScope(()=>draftKey(latest.current.scope))
 const serialized=JSON.stringify(textOnly(kind,value))
 const access=scope=>request('/api/device-drafts?'+new URLSearchParams({...scope,siteId:scope.siteId||''}),{headers:{'X-Expected-Actor':scope.actor}})
 function fail(e){setError(e.code?e.message:e.name==='QuotaExceededError'?'Device storage is full. Keep this page open; your visible input remains here.':e.name==='SecurityError'?'Device storage is blocked. Keep this page open; your visible input remains here.':e.message||'Could not save device work. Keep this page open.')}
 function remove(){const existing=readDraft(localStorage,latest.current.scope);if(existing&&existing.token!==token.current)throw Error('Another tab changed this device copy. It was retained; review Device drafts.');localStorage.removeItem(key);token.current=null;last.current='';setSavedAt(null)}
 async function inspect(){const selected=latest.current.scope,requestKey=draftKey(selected),isCurrent=scopeGate.current.begin();setChecking(true);setReady(false);setRecovery(null);setError('');let authorized=false;try{
  const server=await access(selected);if(!isCurrent())return;authorized=true;authorizedKey.current=requestKey;const local=readDraft(localStorage,selected);token.current=local?.token||null
  if(local){active.current=true;setEnabled(true);setSavedAt(local.savedAt);setRecovery({local,server:server.record,editable:server.editable});last.current=JSON.stringify(local.text)}
  if(!local)active.current=enabled
  blocked.current=false;setReady(true)
 }catch(e){if(!isCurrent())return;blocked.current=!authorized;if(['denied','not_found','account_changed'].includes(e.code)){try{localStorage.removeItem(key)}catch{}setRecovery(null);active.current=false;setEnabled(false);setSavedAt(null)}fail(e);setReady(true)}finally{if(isCurrent())setChecking(false)}}
 useEffect(()=>{if(engaged)void inspect();return()=>{scopeGate.current.invalidate();active.current=false;blocked.current=true}},[key,engaged]) // eslint-disable-line react-hooks/exhaustive-deps
 function persist(next=value){if(!active.current||blocked.current||recovery)return;try{const x=latest.current,projected=JSON.stringify(textOnly(kind,next));if(projected===last.current)return;const written=writeDraft(localStorage,x.scope,{text:next,baseline:x.baseline,revision:x.revision},token.current);token.current=written.token;last.current=projected;setSavedAt(written.savedAt);setError('')}catch(e){fail(e)}}
 useEffect(()=>{if(enabled&&ready&&!recovery&&dirty)persist(latest.current.value)},[serialized,enabled,ready,recovery,dirty]) // eslint-disable-line react-hooks/exhaustive-deps
 function toggle(checked){if(!checked){if(!window.confirm('Remove this device copy? Unsent work will remain only on this open page.'))return;try{remove();active.current=false;setEnabled(false);setRecovery(null)}catch(e){fail(e)}return}active.current=true;setEnabled(true);persist(latest.current.value)}
 async function resume(){const selected=latest.current,isCurrent=scopeGate.current.begin();setChecking(true);setError('');try{
  const server=await access(selected.scope);if(!isCurrent())return;const current=readDraft(localStorage,selected.scope)
  if(!current||current.token!==token.current)throw Error('Another tab changed this device copy. Check device work again before choosing.')
  if(!server.editable){setRecovery(r=>({...r,server:server.record,editable:false}));throw Error('This record is no longer editable. No saved operation was replayed; device text remains available for review.')}
  if(kind==='electrical'&&(server.record?.revision||0)!==(recovery.server?.revision||0)){setRecovery(r=>({...r,server:server.record,editable:server.editable}));throw Error('The server changed again. Review the latest text before choosing.')}
  const result=await selected.onRestore(current.text,server.record,current,isCurrent);if(!isCurrent())return
  if(result?.resolved){remove();setRecovery(null);return}
  setRecovery(null);last.current='';blocked.current=false
 }catch(e){if(!isCurrent())return;if(['denied','not_found','account_changed'].includes(e.code)){try{localStorage.removeItem(key)}catch{}setRecovery(null);active.current=false;setEnabled(false)}fail(e)}finally{if(isCurrent())setChecking(false)}}
 function clear(){try{remove()}catch(e){fail(e)}}
 function discard(){if(!window.confirm('Discard this device copy? Unsent text and retry identifiers will be removed from this browser. Server records stay unchanged.'))return;try{remove();setRecovery(null)}catch(e){fail(e)}}
 return {enabled,ready,recovery:recovery&&draftKey(recovery.local)===key?recovery:null,error,savedAt,checking,toggle,persist,inspect,resume,discard,clear,hold:!ready||authorizedKey.current!==key||Boolean(recovery)||blocked.current}
}
