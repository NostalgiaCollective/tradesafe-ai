import test from 'node:test'
import assert from 'node:assert/strict'
import {holdClientScripts} from './fixtures/hold-client-scripts.mjs'

function page(){let handler;return {route:async(_pattern,value)=>{handler=value},unrouteCalls:0,unroute:async function(){this.unrouteCalls++},send:route=>handler(route)}}
const request=()=>({url:()=> 'http://local.test/_next/static/chunk.js',resourceType:()=> 'script'})

test('delayed-script barrier releases once and drains continuing requests before cleanup',async()=>{
 const p=page(),barrier=await holdClientScripts(p,'http://local.test')
 let allowContinue,continued=false,released=false
 const finishing=new Promise(resolve=>{allowContinue=resolve})
 const handler=p.send({request,continue:async()=>{continued=true;await finishing}})
 assert.equal(barrier.count(),1);assert.equal(continued,false)
 const release=barrier.release();assert.equal(barrier.release(),release)
 void release.then(()=>{released=true})
 await Promise.resolve();await Promise.resolve()
 assert.equal(continued,true);assert.equal(released,false)
 // Removing the interceptor before this continuation settles causes Playwright
 // 1.63 to continue it again. This ordering regression failed the prior helper.
 assert.equal(p.unrouteCalls,0)
 allowContinue();await release;await handler
 assert.equal(released,true);assert.equal(p.unrouteCalls,1)
})

test('delayed-script continuation failure is returned by release, not thrown asynchronously',async()=>{
 const p=page(),barrier=await holdClientScripts(p,'http://local.test'),failure=new Error('synthetic continuation failure')
 const handler=p.send({request,continue:async()=>{throw failure}})
 const release=barrier.release()
 await assert.rejects(release,error=>error===failure);await handler
 await assert.rejects(barrier.release(),error=>error===failure)
 assert.equal(p.unrouteCalls,1)
})

test('delayed-script barrier does not hold HTML or another origin',async()=>{
 const p=page(),barrier=await holdClientScripts(p,'http://local.test')
 let fallbacks=0
 for(const [url,type] of [['http://local.test/_next/static/test','document'],['http://other.test/_next/static/test.js','script']])await p.send({request:()=>({url:()=>url,resourceType:()=>type}),fallback:async()=>{fallbacks++}})
 await barrier.release();assert.equal(fallbacks,2);assert.equal(barrier.count(),0)
})
