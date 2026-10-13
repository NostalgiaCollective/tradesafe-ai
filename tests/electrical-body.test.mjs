import test from 'node:test'
import assert from 'node:assert/strict'
import {readElectricalBody,ELECTRICAL_BODY_BYTES,ELECTRICAL_BODY_TIMEOUT_MS} from '../lib/domain/electrical-body.mjs'
function request(body,headers={}){return new Request('http://localhost/api/sites/synthetic/electrical',{method:'POST',headers:{'content-type':'application/json',...headers},body,duplex:'half'})}
test('electrical JSON reader preserves valid streamed Unicode and accepts exact byte boundary',async()=>{
 const body={command:'save',payload:{scope:'Synthetic café — panel A',revision:7}},bytes=Buffer.from(JSON.stringify(body));let cursor=0
 const stream=new ReadableStream({pull(controller){if(cursor===bytes.length)return controller.close();controller.enqueue(bytes.subarray(cursor,++cursor))}})
 assert.deepEqual(await readElectricalBody(request(stream)),body)
 const minimal='{"command":"save","payload":{}}',exact=Buffer.from(minimal+' '.repeat(ELECTRICAL_BODY_BYTES-Buffer.byteLength(minimal)))
 assert.equal(exact.byteLength,30000);assert.deepEqual(await readElectricalBody(request(exact)),JSON.parse(minimal))
})
test('electrical JSON reader cancels oversized actual stream despite a false Content-Length',async()=>{
 let cancelled=false,reads=0
 const stream=new ReadableStream({pull(controller){reads++;controller.enqueue(new Uint8Array(15001))},cancel(){cancelled=true}})
 await assert.rejects(readElectricalBody(request(stream,{'content-length':'2'})),{code:'invalid_request'})
 assert.equal(cancelled,true);assert.ok(reads<=3)
 await assert.rejects(readElectricalBody(request('{not json}')),{code:'invalid_request'})
 await assert.rejects(readElectricalBody(request('{}',{'content-type':'text/plain'})),{code:'invalid_request'})
})
test('electrical JSON reader five-second default deadline cancels stalled input without awaiting a stalled cancel callback',async()=>{
 let cancelled=false
 const stream=new ReadableStream({start(controller){controller.enqueue(Buffer.from('{"command":'))},cancel(){cancelled=true;return new Promise(()=>{})}})
 const started=Date.now();await assert.rejects(readElectricalBody(request(stream)),{code:'request_timeout'})
 assert.equal(cancelled,true);assert.ok(Date.now()-started>=ELECTRICAL_BODY_TIMEOUT_MS-100);assert.ok(Date.now()-started<ELECTRICAL_BODY_TIMEOUT_MS+2000)
})
