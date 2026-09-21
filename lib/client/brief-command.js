'use client'
import {request} from './request.mjs'
export const briefCommand=(command,payload,actor)=>request('/api/briefs',{method:'POST',headers:{'Content-Type':'application/json','X-Expected-Actor':actor},body:JSON.stringify({command,payload})})
export const saveBrief=(_command,payload,actor)=>briefCommand('save',payload,actor)
