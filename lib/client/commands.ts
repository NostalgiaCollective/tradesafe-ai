'use client'
export class CommandError extends Error {
 code: string
 constructor(message: string,code: string){super(message);this.code=code}
}
export async function command(name: string,payload: object) {
 let response: Response
 try { response=await fetch('/api/workspace',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({command:name,payload})}) }
 catch {throw new CommandError('Not saved. Check your connection and retry. Keep this page open to preserve your changes.','network')}
 let data
 try {data=await response.json()}catch{throw new CommandError('The service is unavailable. Your changes are still here.','unavailable')}
 if(!response.ok)throw new CommandError(data.error||'The action could not be completed.',data.code||'unavailable')
 return data
}
