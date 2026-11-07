import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
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

test('campaign tagging handles Outlook-corrupted and one-parameter email links',()=>{
  const js=fs.readFileSync(new URL('../assets/telemetry.js',import.meta.url),'utf8');
  for(const [search,campaign] of [
    ['?utm_source=outbound&utm;_medium=email&utm;_campaign=nov2026_blitz_a','nov2026_blitz_a'],
    ['?utm_campaign=nov2026_blitz_b','nov2026_blitz_b']
  ]){
    const events=[];
    const store=new Map();
    const fake={
      navigator:{doNotTrack:'0',globalPrivacyControl:false,sendBeacon:(_endpoint,blob)=>{events.push(JSON.parse(blob.parts[0]));return true}},
      location:{search,pathname:'/',hostname:'dreamprotocol.ai'},
      document:{referrer:'',addEventListener(){}},
      sessionStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)},
      crypto:{randomUUID:()=> '7e53d2ce-3a88-41c8-b77d-d00eac8f4fea'},
      Blob:class{constructor(parts){this.parts=parts}},
      URLSearchParams,URL,window:{},Date
    };
    vm.runInNewContext(js,fake);
    assert.equal(events[0].event,'page_view');
    assert.equal(events[0].campaign,campaign);
    assert.equal(events[0].source,'outbound');
    assert.equal(events[0].medium,'email');
  }
});
