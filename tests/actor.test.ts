import test from 'node:test'
import assert from 'node:assert/strict'
import {assertExpectedActor} from '../lib/domain/actor.ts'
import {AppError} from '../lib/domain/errors.ts'
test('form actor binding rejects changed accounts without replacing ordinary authorization',()=>{
 assert.doesNotThrow(()=>assertExpectedActor('original','original'))
 assert.doesNotThrow(()=>assertExpectedActor('ordinary-session',null))
 for(const value of ['other','', ' original'])assert.throws(()=>assertExpectedActor('original',value),(e:unknown)=>e instanceof AppError&&e.code==='account_changed')
})
