'use client'
import { request } from './request.mjs'
export class CommandError extends Error {
 code: string
 constructor(message: string,code: string){super(message);this.code=code}
}
export async function command(name: string,payload: object,actor?:string) {
 return request('/api/workspace',{method:'POST',headers:{'Content-Type':'application/json',...(actor?{'X-Expected-Actor':actor}:{})},body:JSON.stringify({command:name,payload})})
}
