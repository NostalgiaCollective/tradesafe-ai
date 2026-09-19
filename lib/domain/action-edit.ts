import {canVerify,type Role} from './inspection.ts'
export function canUpdateAction(role:Role,actor:string,action:{responsible_id:string;state:string}){return canVerify(role)||(actor===action.responsible_id&&action.state!=='closed')}
export const needsResolution=(state:string)=>['closed','awaiting_verification'].includes(state)
export const definitiveActionFailure=(code:string)=>['account_changed','invalid_request','incomplete','denied','conflict','immutable','not_found'].includes(code)
export const ACTION_LABELS:Record<string,string>={open:'Open',in_progress:'In progress',awaiting_verification:'Awaiting verification',closed:'Closed — verified'}
