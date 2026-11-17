import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequester,retryDelay} from './editorial-request.mjs';


const response=(status,data={},headers={})=>new Response(JSON.stringify(data),{status,headers});
function mock(responses) {
 const requests=[], waits=[], logs=[];
 return {requests,waits,logs,options:{fetchImpl:async (url,init)=>{requests.push(JSON.parse(init.body));const r=responses.shift();if(r instanceof Error)throw r;assert(r,'Unexpected API request');return r;},sleep:async ms=>waits.push(ms),log:x=>logs.push(x),random:()=>0,now:()=>0}};
}
test('429 uses Retry-After and preserves request payload on recovery',async()=>{
 const m=mock([response(429,{error:{code:'rate_limit_exceeded'}},{'retry-after':'3','x-request-id':'req_test'}),response(200,{status:'completed'})]);
 const c=createRequester('secret',m.options);assert.equal((await c.request({input:'test'})).status,'completed');
 assert.deepEqual(m.waits,[3000]);assert.deepEqual(m.requests[0],m.requests[1]);assert.equal(c.calls,1);assert.equal(c.attempts,2);assert.match(m.logs[0],/req_test/);assert(!m.logs.join('').includes('secret'));
});
test('HTTP-date, malformed and excessive Retry-After',async()=>{
 assert.equal(retryDelay('Thu, 01 Jan 1970 00:00:05 GMT',1,0,()=>0),5000);
 assert.equal(retryDelay('invalid',2,0,()=>0),2000);
 const m=mock([response(429,{}, {'retry-after':'120'})]);await assert.rejects(createRequester('x',m.options).request({}),/exceeds 60/);assert.equal(m.waits.length,0);
});
for(const status of [429,500,502,503,504])test(`${status} bounded to three attempts`,async()=>{
 const m=mock(Array.from({length:3},()=>response(status)));await assert.rejects(createRequester('x',m.options).request({}),/attempt=3\/3/);assert.equal(m.requests.length,3);assert.deepEqual(m.waits,[1000,2000]);
});
for(const code of ['insufficient_quota','credit_balance_exhausted','billing_hard_limit_reached','organization_usage_limit_exceeded'])test(`${code} stops immediately`,async()=>{
 const m=mock([response(429,{error:{code,type:'insufficient_quota',message:'secret private data'}})]);await assert.rejects(createRequester('x',m.options).request({}),e=>/Account action required/.test(e.message)&&!e.message.includes('secret'));assert.equal(m.requests.length,1);
});
for(const status of [400,401,403,404,422])test(`${status} is not retried`,async()=>{
 const m=mock([response(status)]);await assert.rejects(createRequester('x',m.options).request({}),new RegExp(`HTTP ${status}`));assert.equal(m.requests.length,1);
});
test('malformed 429 can recover; transport and malformed success cannot repeat paid work',async()=>{
 let m=mock([new Response('bad',{status:429}),response(200,{ok:true})]);await createRequester('x',m.options).request({});assert.equal(m.requests.length,2);
 for(const r of [new Error('private'),new Response('bad',{status:200})]) {m=mock([r]);await assert.rejects(createRequester('x',m.options).request({}));assert.equal(m.requests.length,1);}
});
test('two logical request limit',async()=>{
 const m=mock([response(200,{}),response(200,{})]);const c=createRequester('x',{...m.options,maxCalls:2});await c.request({});await c.request({});await assert.rejects(c.request({}),/limit/);assert.equal(m.requests.length,2);
});

import {reservationDecision} from './editorial.mjs';
test('recovery requires explicit manual approval and first rejected call',()=>{
 const held={status:'held',calls:1,reason:'AI service returned HTTP 429'};
 const yes={manual:true,recover:true};
 assert.equal(reservationDecision(null).reserved,true);
 assert.equal(reservationDecision(held).reserved,false);
 assert.equal(reservationDecision(held,{manual:true}).reserved,false);
 assert.equal(reservationDecision(held,yes).retryRecovery,true);
 for(const altered of [{calls:2},{status:'approved'},{retryRecovery:true},{reason:'timeout'},{recovery:{}}])assert.equal(reservationDecision({...held,...altered},yes).reserved,false);
 assert.equal(reservationDecision(held,{...yes,hasArticle:true}).reserved,false);
 assert.equal(reservationDecision(null,{hasArticle:true}).reserved,false);
});
test('review continuation preserves logical call ceiling and model',async()=>{
 const m=mock([response(200,{status:'completed'})]);
 const c=createRequester('x',{...m.options,initialCalls:2});await c.request({});
 assert.equal(c.calls,3);assert.equal(m.requests[0].model,'gpt-5.4');
 await assert.rejects(c.request({}),/limit/);assert.equal(m.requests.length,1);
});
