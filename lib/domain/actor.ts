import {AppError} from './errors.ts'
// Additional form-identity check, never a replacement for session, membership or role checks.
export function assertExpectedActor(actual:string,expected:string|null){
 if(expected!==null&&expected!==actual)throw new AppError('account_changed')
}
