'use client'
import {request} from './request.mjs'
export const concernCommand=(command,payload,actor)=>request('/api/concerns',{method:'POST',headers:{'Content-Type':'application/json','X-Expected-Actor':actor},body:JSON.stringify({command,payload})})
