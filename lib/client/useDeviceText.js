'use client'
import {useEffect,useRef,useState} from 'react'
import {request} from './request.mjs'
import {draftKey,readDraft,writeDraft,equalText,applyText} from './device-store.mjs'
export function useDeviceText({kind,id,company,siteId,actor,document,serverDocument,revision,onRestore}){
 const scope={kind,id,company,siteId,actor},key=draftKey(scope),latest=useRef(null);latest.current={document,serverDocument,revision,onRestore,scope}
 const [enabled,setEnabled]=useState(false),[ready,setReady]=useState(false),[recovery,setRecovery]=useState(null),[error,setError]=useState(''),[savedAt,setSavedAt]=useState(null),[checking,setChecking]=useState(false)
 const token=useRef(null),baseline=useRef({document:serverDocument,revision}),active=useRef(false)
 function removeOwn(){const found=readDraft(localStorage,latest.current.scope);if(found&&found.token!==token.current)throw Error('Another tab changed the device copy. It has been retained; review Device drafts.');localStorage.removeItem(key);token.current=null}
 async function inspect(){setChecking(true);setError('');try{
  const {scope:s}=latest.current,r=await request('/api/device-drafts?'+new URLSearchParams({...s,siteId:s.siteId||''}),{headers:{'X-Expected-Actor':actor}})
  const local=readDraft(localStorage,s);token.current=local?.token||null
  if(local){setEnabled(true);active.current=true;setRecovery({local,server:r.record,editable:r.editable});setSavedAt(local.savedAt)}
  setReady(true)
 }catch(e){if(['denied','not_found','account_changed'].includes(e.code)){try{localStorage.removeItem(key)}catch{}setRecovery(null);active.current=false;setEnabled(false)}setError(e.code?e.message:'Device storage is unavailable. Keep this page open; your visible text has not been removed.');setReady(true)}finally{setChecking(false)}}
 useEffect(()=>{void inspect();return()=>{active.current=false}},[key]) // eslint-disable-line react-hooks/exhaustive-deps
 function persist(next){if(!active.current||recovery)return;try{const x=latest.current,v=writeDraft(localStorage,x.scope,{text:next,baseline:baseline.current.document,revision:baseline.current.revision},token.current);token.current=v.token;setSavedAt(v.savedAt);setError('')}catch(e){setError(e.name==='QuotaExceededError'?'Could not save on this device: browser storage is full. Keep this page open and save to the server.':e.name==='SecurityError'?'Device storage is blocked. Keep this page open and save to the server.':e.message||'Could not save on this device. Keep this page open.')}}
 function toggle(checked){if(!checked){if(!window.confirm('Remove this device draft? Unsent text will remain only on this open page.'))return;try{localStorage.removeItem(key);token.current=null;setEnabled(false);active.current=false;setSavedAt(null);setRecovery(null)}catch{setError('Could not remove the device draft. Check browser storage settings.')}return}active.current=true;setEnabled(true);baseline.current={document:latest.current.serverDocument,revision:latest.current.revision};persist(latest.current.document)}
 // Incremental writes are called directly by text edits, not browser-close events.
 useEffect(()=>{if(!enabled||recovery||!ready)return;const x=latest.current;if(equalText(kind,x.document,x.serverDocument)&&x.revision>0){try{removeOwn();setSavedAt(null);baseline.current={document:x.serverDocument,revision:x.revision}}catch{setError('Could not clear the server-confirmed device copy. Another tab may have changed it; review Device drafts.')}}},[serverDocument,revision,enabled,recovery,ready,key,kind]) // eslint-disable-line react-hooks/exhaustive-deps
 async function resolve(useLocal){setChecking(true);try{
  const x=latest.current,r=await request('/api/device-drafts?'+new URLSearchParams({...x.scope,siteId:siteId||''}),{headers:{'X-Expected-Actor':actor}})
  if(!r.editable){setRecovery(v=>({...v,server:r.record,editable:false}));setError('This record is no longer an editable draft. Device text is retained; no submission or revision is replayed.');return}
  if((r.record?.revision||0)!==(recovery.server?.revision||0)){setRecovery(v=>({...v,server:r.record}));setError('The server changed again. Review the updated comparison before choosing.');return}
  const base=r.record?.document||x.serverDocument,next=useLocal?applyText(kind,base,recovery.local.text):base
  if(!useLocal&&!window.confirm('Discard recovered device text and use the server version?'))return
  baseline.current={document:base,revision:r.record?.revision||0};x.onRestore(r.record,next);setRecovery(null);setError('');setSavedAt(useLocal?recovery.local.savedAt:null)
  if(!useLocal){localStorage.removeItem(key);token.current=null}else{const v=writeDraft(localStorage,x.scope,{text:next,baseline:base,revision:baseline.current.revision},token.current);token.current=v.token}
 }catch(e){setError(e.message);if(['denied','not_found','account_changed'].includes(e.code)){localStorage.removeItem(key);setRecovery(null);active.current=false;setEnabled(false)}}finally{setChecking(false)}}
 return {enabled,ready,recovery,error,savedAt,checking,toggle,persist,inspect,resolve,hold:!ready||Boolean(recovery),clear:()=>{try{removeOwn();setSavedAt(null)}catch{setError('Could not clear the device copy. Another tab may have changed it; review Device drafts.')}}}
}
