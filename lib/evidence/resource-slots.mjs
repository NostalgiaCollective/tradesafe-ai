import {AppError} from '../domain/errors.ts'
const active={upload:0,pdf:0},maximum={upload:2,pdf:1}
export function acquireSlot(kind){
 if(!Object.hasOwn(active,kind))throw new AppError('invalid_request')
 if(active[kind]>=maximum[kind])throw new AppError('resource_busy')
 active[kind]++;let released=false
 return ()=>{if(!released){released=true;active[kind]--}}
}
