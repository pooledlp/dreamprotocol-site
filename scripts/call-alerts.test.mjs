import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../calls-worker/src/worker.mjs';
const env={CALLS_HOST:'calls.dreamprotocol.ai',VAPI_ASSISTANT_ID:'2dc04098-ce55-4aa9-a98b-f5d5d87484d4',VAPI_PHONE_ID:'8b939452-5fda-4d5c-9c4f-231bcf1cafbb',VAPI_WEBHOOK_SECRET:'test-only-secret'};
const request=(data,secret='test-only-secret')=>new Request('https://calls.dreamprotocol.ai/vapi',{method:'POST',headers:{Authorization:'Bearer '+secret},body:JSON.stringify(data)});
test('call webhook refuses anonymous and incorrect credentials',async()=>{
 assert.equal((await worker.fetch(request({},'wrong'),env,{})).status,403);
 assert.equal((await worker.fetch(new Request('https://calls.dreamprotocol.ai/vapi',{method:'POST'}),env,{})).status,403);
});
test('health reveals no secret or owner contact data',async()=>{
 const result=await worker.fetch(new Request('https://calls.dreamprotocol.ai/health'),env,{});
 assert.equal(result.status,200);
 const d=await result.json();
 assert.equal(d.email,false);assert.equal(d.sms,false);
 assert(!JSON.stringify(d).includes('test-only-secret'));
});
test('irrelevant Vapi events are acknowledged but ignored',async()=>{
 const result=await worker.fetch(request({message:{type:'status-update'}}),env,{});
 assert.equal(result.status,200);
 assert.equal((await result.json()).ignored,true);
});
test('other clients are not recorded',async()=>{
 const result=await worker.fetch(request({message:{type:'end-of-call-report',call:{id:'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',assistantId:'client-different-id'}}}),env,{});
 assert.equal(result.status,503);
});
