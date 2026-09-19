// Tab-scoped progress only; no tokens in URLs, diagnostics, analytics or persistent localStorage.
export function readProgress(key){try{return JSON.parse(sessionStorage.getItem(key)||'null')}catch{return null}}
export function writeProgress(key,value){try{sessionStorage.setItem(key,JSON.stringify(value));return true}catch{return false}}
export function clearProgress(key){try{sessionStorage.removeItem(key)}catch{/* In-memory retry still works. */}}
