import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {weekKey,safeSource,responseText,validateArticle,generate,loadGenerated} from './editorial.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const sources=[{title:'Microsoft integration documentation',url:'https://learn.microsoft.com/power-automate/getting-started'},{title:'Google Workspace support documentation',url:'https://support.google.com/a/answer/12345'}];
// Deliberately synthetic fixture; never deployed or represented as researched content.
const section='A business can begin by identifying the owner of each incoming request and the information needed for the next decision. This hypothetical workflow illustrates a planning method rather than a promised product feature. Write down what should happen when information is missing, who reviews the exception, and how the team records the outcome. Test the process with sample requests before connecting live systems. The person responsible for the workflow should confirm access and routing with the administrator. Keep the first trial limited to a single process so the team can understand why a request reaches a particular person. Review the sample results together and revise the written handoff instructions before expanding the trial. ';
const fixture=()=>({slug:'shared-inbox-routing-ownership',title:'How to assign ownership in a shared business inbox',category:'Workflow planning',service:'workflow-automation',description:'Map shared inbox ownership, define exception handling, and prepare a small trial before connecting your business systems together.',takeaway:'Start with a named owner and a written handoff rule, then test the process using sample requests before connecting live customer information.',sections:Array.from({length:4},(_,i)=>({heading:'Planning step '+(i+1)+' for your team',body:section+section.slice(0,350),sourceIndexes:[i%2]})),checklist:['Name a person responsible for reviewing incoming requests.','Write down which details the next team member needs.','Test a small set of sample requests before launch.','Confirm how staff should handle missing information.'],sources:structuredClone(sources)});
const response=(value,withSources=false)=>({status:'completed',output:[...(withSources?[{type:'web_search_call',status:'completed',action:{sources:sources.map(s=>({url:s.url}))}}]:[]),{type:'message',content:[{type:'output_text',text:typeof value==='string'?value:JSON.stringify(value)}]}],usage:{input_tokens:1,output_tokens:1}});
test('Weekly boundaries and primary-source URL checks are strict',()=>{
 assert.equal(weekKey('2026-09-13'),'2026-09-07');assert.equal(weekKey('2026-09-14'),'2026-09-14');
 assert.throws(()=>weekKey('2026-02-30'));
 for(const url of ['javascript:alert(1)','https://openai.com.evil.test/page','https://openai.com/','http://openai.com/page','https://user@openai.com/page','https://openai.com:8443/page'])assert(!safeSource(url));
 assert(safeSource(sources[0].url));
});
test('Publication rejects malformed, duplicate, unsourced, and unsupported content',()=>{
 const a=fixture();validateArticle(a,[],sources.map(s=>s.url));
 assert.throws(()=>validateArticle({...a,slug:'../escape'}));
 assert.throws(()=>validateArticle(a,[{slug:a.slug,title:'Other article'}]));
 assert.throws(()=>validateArticle(a,[],[sources[0].url]));
 assert.throws(()=>validateArticle({...a,takeaway:a.takeaway+' Save 50% today.'}));
 assert.throws(()=>validateArticle({...a,sections:[{...a.sections[0],sourceIndexes:[99]},...a.sections.slice(1)]}));
 assert.throws(()=>responseText({...response(a),status:'incomplete'}));
});
test('Three-stage pipeline publishes only after independent sourced approval',async()=>{
 const requests=[];const results=[response('Research notes',true),response(fixture()),response({approved:true,reasons:[]},true)];
 const a=await generate({date:'2026-09-13',existing:[],request:async r=>{requests.push(r);return results.shift();}});
 assert.equal(requests.length,3);assert.equal(a.review.approved,true);assert.equal(a.publishOn,'2026-09-13');
 assert.equal(requests[0].tool_choice,'required');assert.equal(requests[2].tool_choice,'required');
 assert.equal(requests[1].text.format.strict,true);
 const openedReview=response({approved:true,reasons:[]});
 openedReview.output.unshift(...sources.map(s=>({type:'web_search_call',status:'completed',action:{type:'open_page',url:s.url}})));
 const opened=[response('Research notes',true),response(fixture()),openedReview];
 const openedArticle=await generate({date:'2026-09-13',existing:[],request:async()=>opened.shift()});
 assert.equal(openedArticle.review.approved,true,'Directly opened source pages count as reviewed evidence');
 const rejected=[response('Research notes',true),response(fixture()),response({approved:false,reasons:['Unsupported assertion']},true)];
 await assert.rejects(()=>generate({date:'2026-09-13',existing:[],request:async()=>rejected.shift()}),/did not approve/);
 const missing=[response('Research notes',true),response(fixture()),response({approved:true,reasons:[]})];
 await assert.rejects(()=>generate({date:'2026-09-13',existing:[],request:async()=>missing.shift()}),/every cited source/);
});
test('Approved JSON integrates into site, citations, service links, and discovery',()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'dream-researched-'));
 try{
  for(const p of ['content','assets','scripts'])fs.cpSync(path.join(root,p),path.join(temp,p),{recursive:true});
  fs.copyFileSync(path.join(root,'app.js'),path.join(temp,'app.js'));
  fs.rmSync(path.join(temp,'content/generated'),{recursive:true,force:true});fs.mkdirSync(path.join(temp,'content/generated'));
  const a={...fixture(),publishOn:'2026-09-14',week:'2026-09-14',status:'scheduled',review:{approved:true},generation:{sourceCheckedOn:'2026-09-14'}};
  fs.writeFileSync(path.join(temp,'content/generated/2026-09-14.json'),JSON.stringify(a));
  assert.equal(loadGenerated(temp).length,1);
  const build=date=>execFileSync(process.execPath,['scripts/build.mjs'],{cwd:temp,env:{...process.env,BUILD_DATE:date},stdio:'pipe'});
  build('2026-09-13');assert(!fs.existsSync(path.join(temp,'resources',a.slug,'index.html')));
  build('2026-09-14');
  for(const f of ['index.html','resources/index.html','resources/feed.xml','sitemap.xml','workflow-automation/index.html'])assert(fs.readFileSync(path.join(temp,f),'utf8').includes(a.slug),f);
  const html=fs.readFileSync(path.join(temp,'resources',a.slug,'index.html'),'utf8');assert(html.includes(sources[0].url));assert(html.includes('Researched and checked with AI'));
  a.review.approved=false;fs.writeFileSync(path.join(temp,'content/generated/2026-09-14.json'),JSON.stringify(a));assert.throws(()=>loadGenerated(temp));
 }finally{fs.rmSync(temp,{recursive:true,force:true});}
});
test('Reservation persists once and missing credentials never reserve paid work',()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'dream-reservation-'));
 try{
  for(const p of ['content','scripts'])fs.cpSync(path.join(root,p),path.join(temp,p),{recursive:true});
  fs.rmSync(path.join(temp,'content/runs'),{recursive:true,force:true});
  const env={...process.env,OPENAI_API_KEY:'',GITHUB_OUTPUT:path.join(temp,'outputs.txt')};
  assert.throws(()=>execFileSync(process.execPath,['scripts/editorial.mjs','reserve'],{cwd:temp,env,stdio:'pipe'}));
  assert(!fs.existsSync(path.join(temp,'content/runs')));
  env.OPENAI_API_KEY='fake-test-key-no-network';
  for(let i=0;i<2;i++)execFileSync(process.execPath,['scripts/editorial.mjs','reserve'],{cwd:temp,env,stdio:'pipe'});
  assert.equal(fs.readdirSync(path.join(temp,'content/runs')).length,1);
  assert.equal(fs.readFileSync(env.GITHUB_OUTPUT,'utf8'),'reserved=true\nreserved=false\n');
 }finally{fs.rmSync(temp,{recursive:true,force:true});}
});
