// Only fixed categories leave the runner. Never include raw messages, URLs,
// request payloads, field values, tokens or screenshots in failure receipts.
export function browserFailure(error){
 const message=error?.message||''
 return ['Clicking the checkbox did not change its state','intercepts pointer events','strict mode violation','interrupted by another navigation','Navigation is interrupted','WebKit encountered an internal error','Target crashed','Target page, context or browser has been closed','Browser context closed','Page closed','Route is already handled','Invalid InterceptionId','Protocol error','NSURLErrorDomain','ERR_CONNECTION','cancelled','Timeout'].find(value=>message.includes(value))||'assertion or other error'
}
