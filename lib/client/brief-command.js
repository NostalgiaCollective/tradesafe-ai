'use client'
import {request} from './request.mjs'
export async function briefCommand(command,payload,actor){
 try{return await request('/api/briefs',{method:'POST',headers:{'Content-Type':'application/json','X-Expected-Actor':actor},body:JSON.stringify({command,payload})})}
 catch(error){
  if(error.code==='immutable')error.message='This briefing version has been recorded. Your entries remain on this page. Open the current brief and choose Revise brief to make a separate revision.'
  if(error.code==='not_found')error.message='This daily brief could not be found or is not available to your account.'
  throw error
 }
}
export const saveBrief=(_command,payload,actor)=>briefCommand('save',payload,actor)
