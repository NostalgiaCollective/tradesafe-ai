'use client'
import {request} from './request.mjs'
export const siteCommand=(command,payload,actor)=>request('/api/sites',{method:'POST',headers:{'Content-Type':'application/json','X-Expected-Actor':actor},body:JSON.stringify({command,payload})})
