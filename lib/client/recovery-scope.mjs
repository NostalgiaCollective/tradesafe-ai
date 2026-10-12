// Authorizing one scope must never unlock another after navigation, account
// switching, or a newer check. Consumers check again after every asynchronous step.
export function createRecoveryScope(currentKey){
 let epoch=0
 return {
  begin(){const key=currentKey(),version=++epoch;return ()=>version===epoch&&key===currentKey()},
  invalidate(){epoch++},
 }
}
