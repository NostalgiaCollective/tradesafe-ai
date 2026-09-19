import {request} from './request.mjs'
export const reportState=(id,actor)=>request('/api/reports/'+id+'/state',{headers:actor?{'X-Expected-Actor':actor}:{}})
