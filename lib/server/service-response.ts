import { ERROR_MESSAGES } from '../domain/errors.ts'

// A direct response retains HTTP 503. Rewriting to an App Router page can normalize it to 200.
// All markup is static: never interpolate request URLs, credentials or provider error text.
export function serviceUnavailableResponse(code: 'configuration' | 'unavailable') {
  return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Account services unavailable | TradeSafe AI</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#111;color:#eee;font:18px/1.6 system-ui,sans-serif}
main{min-height:100vh;display:grid;place-items:center;padding:24px}section{width:100%;max-width:520px;padding:32px;border:1px solid #444;border-radius:12px;background:#1a1a1a}
h1{font-size:30px;line-height:1.2;margin:16px 0}p{margin:0 0 24px}.brand{color:#ffb800}
nav{display:flex;gap:16px;flex-wrap:wrap}a{display:inline-flex;align-items:center;min-height:48px;padding:10px 16px;color:#eee}a:first-child{background:#ffb800;color:#111;border-radius:8px;text-decoration:none}a:focus-visible{outline:3px solid #fff;outline-offset:4px}
</style></head><body><main><section aria-labelledby="title"><p class="brand">TradeSafe AI</p>
<h1 id="title">Account services are unavailable</h1><p role="alert">${ERROR_MESSAGES[code]}</p>
<nav aria-label="Recovery"><a href="">Try again</a><a href="/">Back to home</a></nav>
</section></main></body></html>`, { status: 503, headers: {
    'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store',
    'Retry-After': '60', 'X-Content-Type-Options': 'nosniff',
  } })
}
