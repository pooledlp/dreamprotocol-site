import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../analytics-worker/src/worker.mjs';

const req=(url,options={})=>new Request(url,options);
test('private command center refuses anonymous visitors and random JWTs',async()=>{
  assert.equal((await worker.fetch(req('https://command.dreamprotocol.ai/'),{})).status,403);
  const env={ACCESS_TEAM_DOMAIN:'example.cloudflareaccess.com',ACCESS_AUD:'exampleaud',ACCESS_ALLOWED_EMAIL:'owner@example.com'};
  assert.equal((await worker.fetch(req('https://command.dreamprotocol.ai/',{headers:{'Cf-Access-Jwt-Assertion':'fake.jwt.token'}}),env)).status,403);
});
test('collector refuses other websites and nonexistent routes',async()=>{
  assert.equal((await worker.fetch(req('https://metrics.dreamprotocol.ai/collect',{method:'POST',headers:{Origin:'https://other.example'}}),{})).status,403);
  assert.equal((await worker.fetch(req('https://metrics.dreamprotocol.ai/admin',{method:'POST',headers:{Origin:'https://dreamprotocol.ai'}}),{})).status,404);
  assert.equal((await worker.fetch(req('https://evil.example/collect',{method:'POST',headers:{Origin:'https://dreamprotocol.ai'}}),{})).status,404);
});
test('collector validates allowed event schema and stores no email/form contents/IP',async()=>{
  let inserted=null;
  const env={DB:{prepare(sql){return {bind(...args){inserted={sql,args};return {async run(){return {success:true}}};}}}}};
  const payload={event:'lead_success',session:'7e53d2ce-3a88-41c8-b77d-d00eac8f4fea',page:'/contact/',source:'google',label:'contact:/contact/',form_content:'PRIVATE',email:'private@example.com'};
  const good=req('https://metrics.dreamprotocol.ai/collect',{method:'POST',headers:{Origin:'https://dreamprotocol.ai','Content-Type':'text/plain','User-Agent':'Mozilla/5.0','CF-Connecting-IP':'192.0.2.1'},body:JSON.stringify(payload)});
  const out=await worker.fetch(good,env);
  assert.equal(out.status,204);
  assert.match(inserted.sql,/INSERT INTO analytics_events/);
  assert(!inserted.args.join(' ').includes('private@example.com'));
  assert(!inserted.args.join(' ').includes('192.0.2.1'));
  assert.equal(inserted.args[1],'lead_success');
  const bad=req('https://metrics.dreamprotocol.ai/collect',{method:'POST',headers:{Origin:'https://dreamprotocol.ai','Content-Type':'text/plain'},body:JSON.stringify({...payload,event:'password_dump'})});
  assert.equal((await worker.fetch(bad,env)).status,400);
});
test('preflight only permits the authorized public origin',async()=>{
  const result=await worker.fetch(req('https://metrics.dreamprotocol.ai/collect',{method:'OPTIONS',headers:{Origin:'https://www.dreamprotocol.ai'}}),{});
  assert.equal(result.status,204);
  assert.equal(result.headers.get('Access-Control-Allow-Origin'),'https://www.dreamprotocol.ai');
});

test('scheduled retention removes old analytics automatically',async()=>{
  let query='',cutoff='';
  const env={DB:{prepare(sql){query=sql;return {bind(value){cutoff=value;return {async run(){return {success:true}}};}}}}};
  await worker.scheduled({},env);
  assert.match(query,/DELETE FROM analytics_events WHERE created_at < \?/);
  assert.match(cutoff,/^\d{4}-\d{2}-\d{2}T/);
});

test('phone demo tap event is accepted without contact information',async()=>{
  let received;
  const env={DB:{prepare(){return {bind(...args){received=args;return {async run(){return {success:true}}}}}}}};
  const reqBody={event:'call_click',session:'7e53d2ce-3a88-41c8-b77d-d00eac8f4fea',page:'/',label:'hero'};
  const result=await worker.fetch(req('https://metrics.dreamprotocol.ai/collect',{method:'POST',headers:{Origin:'https://dreamprotocol.ai', 'Content-Type':'text/plain'},body:JSON.stringify(reqBody)}),env);
  assert.equal(result.status,204);
  assert.equal(received[1],'call_click');
  assert.equal(received[8],'hero');
});

test('Vapi phone report requires its own bearer key and ignores all client assistants',async()=>{
 const token='01234567890123456789012345678901';
 let inserted=[];
 const env={VAPI_WEBHOOK_TOKEN:token,DB:{prepare(sql){return {bind(...args){return {
 async run(){inserted.push({sql,args});return{success:true}},
 async first(){return null}
 };}}}}};
 const message={message:{type:'end-of-call-report',call:{id:'37dd1e60-7a44-45eb-8fd1-aa73e8faadd0',assistantId:'2dc04098-ce55-4aa9-a98b-f5d5d87484d4',phoneNumberId:'8b939452-5fda-4d5c-9c4f-231bcf1cafbb',customer:{number:'+14155550111'}},analysis:{summary:'Caller asks about AI phone receptionist pricing and would like a quote.'}}};
 const url='https://metrics.dreamprotocol.ai/vapi/end-call';
 const call=(payload,h={})=>worker.fetch(req(url,{method:'POST',headers:{'Content-Type':'application/json',...h},body:JSON.stringify(payload)}),env);
 assert.equal((await call(message)).status,401);
 const h={Authorization:'Bearer '+token};
 assert.equal((await call(message,h)).status,200);
 assert.equal(inserted.length,1);
 assert.equal(inserted[0].args[5],'sales');
 assert.equal(inserted[0].args[4],'+14155550111');
 const foreign=structuredClone(message);
 foreign.message.call.assistantId='0f76adec-0e0c-4839-849b-b575b2674ec5';
 assert.equal((await call(foreign,h)).status,200);
 assert.equal(inserted.length,1);
});
test('Vapi repeated webhook does not send a duplicate notification',async()=>{
 const token='01234567890123456789012345678901';
 let found=false,sends=0;
 const env={VAPI_WEBHOOK_TOKEN:token,CALL_MAIL:{async send(){sends++}},NOTIFY_EMAIL:'owner@example.com',NOTIFY_FROM:'alerts@myexample.com',DB:{prepare(sql){return{bind(){return{async run(){found=true},async first(){return found?{call_id:'x'}:null}}}}}}};
 const message={message:{type:'end-of-call-report',call:{id:'37dd1e60-7a44-45eb-8fd1-aa73e8faadd0',assistantId:'2dc04098-ce55-4aa9-a98b-f5d5d87484d4',phoneNumberId:'8b939452-5fda-4d5c-9c4f-231bcf1cafbb'}}};
 const endpoint='https://metrics.dreamprotocol.ai/vapi/end-call';
 for(let i=0;i<2;i++){const x=await worker.fetch(req(endpoint,{method:'POST',headers:{Authorization:'Bearer '+token},body:JSON.stringify(message)}),env);assert.equal(x.status,200)}
 assert.equal(sends,1);
});
