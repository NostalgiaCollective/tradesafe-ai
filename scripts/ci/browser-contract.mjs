// Deliberate execution gates, shared by the reporter and orchestration.
// Update with an added/removed scenario; test discovery alone is not execution.
export const LOCAL_WORKFLOW_COUNT=19
export const RESTORED_WORKFLOW_COUNT=1
export function browserRunPassed(result,rows,recovery=false){
 return result.status==='passed'&&rows.length===(recovery?RESTORED_WORKFLOW_COUNT:LOCAL_WORKFLOW_COUNT)&&rows.every(r=>r.status==='passed')
}
