'use client'
import {useEffect,useState} from 'react'
import {entries,draftKey} from '@/lib/client/device-store.mjs'
import {TextFields} from '@/app/components/DeviceText'
import {request} from '@/lib/client/request.mjs'
export default function DeviceList({actor,company}){
 const [rows,setRows]=useState([]),[busy,setBusy]=useState(true),[error,setError]=useState('')
 async function load(){setBusy(true);setError('');setRows([]);try{
  const candidates=entries(localStorage).filter(v=>v.actor===actor&&v.company===company),allowed=[]
  for(const v of candidates){try{const r=await request('/api/device-drafts?'+new URLSearchParams({kind:v.kind,id:v.id,company,siteId:v.siteId||''}),{headers:{'X-Expected-Actor':actor}});allowed.push({...v,record:r.record,editable:r.editable})}catch(e){if(['denied','not_found','account_changed'].includes(e.code))localStorage.removeItem(draftKey(v));else throw e}}
  setRows(allowed)
 }catch(e){setError(e.code?e.message:'Device storage cannot be read. Check browser settings; no server records were changed.')}finally{setBusy(false)}}
 useEffect(()=>{void load()},[actor,company]) // eslint-disable-line react-hooks/exhaustive-deps
 function remove(row){if(!window.confirm('Remove this device draft? Unsent text will be lost from this browser. Server records remain unchanged.'))return;try{localStorage.removeItem(draftKey(row));setRows(r=>r.filter(v=>v.id!==row.id))}catch{setError('Could not remove the device draft. Check browser storage settings.')}}
 return <><button disabled={busy} onClick={load}>Check device drafts again</button>{busy?<p role="status">Checking device drafts and current access…</p>:error?<div role="alert"><p>{error}</p><button onClick={load}>Retry loading device drafts</button></div>:rows.length?<ul className="work-list">{rows.map(r=><li key={r.id}><strong>{r.kind==='brief'?'Daily brief':'Site concern'}</strong><p>{r.record?.document.site||r.record?.site_snapshot?.name||'Unsent concern for selected site'}</p><p>Last local save: {new Date(r.savedAt).toLocaleString()}. {r.editable?'Upload pending':'Server record is no longer editable'}</p><details><summary>Unsent text on this device</summary><TextFields kind={r.kind} value={r.text}/></details><a href={r.kind==='brief'?'/briefs/'+r.id:r.record?'/concerns/'+r.id:'/concerns/new?'+new URLSearchParams({site:r.siteId,device:r.id})}>Review device text</a><button onClick={()=>remove(r)}>Remove device draft</button></li>)}</ul>:<p>No recoverable device drafts for your account in this company.</p>}<p>7-day expiry, 10 drafts, 1 MiB total, 128 KiB per draft. Photos and commands are excluded. Sign out or switching accounts removes device copies. You can remove a copy without changing server records.</p></>
}
