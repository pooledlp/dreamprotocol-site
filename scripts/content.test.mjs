import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
test('Scheduled publishing excludes future content, updates discovery, and is repeatable',()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'dream-content-'));
 try{
  for(const p of ['content','assets','scripts'])fs.cpSync(path.join(root,p),path.join(temp,p),{recursive:true});
  fs.copyFileSync(path.join(root,'app.js'),path.join(temp,'app.js'));
  // Test the fixed prepared queue independently of future generated articles.
  fs.rmSync(path.join(temp,'content/generated'),{recursive:true,force:true});
  const build=date=>execFileSync(process.execPath,['scripts/build.mjs'],{cwd:temp,env:{...process.env,BUILD_DATE:date},stdio:'pipe'});
  const read=p=>fs.readFileSync(path.join(temp,p),'utf8');
  build('2026-09-13');
  assert.equal(JSON.parse(read('content/published.json')).length,2);
  assert(!fs.existsSync(path.join(temp,'resources/first-ai-workshop/index.html')));
  assert(!read('sitemap.xml').includes('/resources/first-ai-workshop/'));
  assert(!read('resources/feed.xml').includes('first-ai-workshop'));
  assert(!read('resources/index.html').includes('/resources/first-ai-workshop/'));
  const before=read('index.html')+read('resources/feed.xml')+read('sitemap.xml');
  build('2026-09-13');assert.equal(read('index.html')+read('resources/feed.xml')+read('sitemap.xml'),before);
  build('2026-09-21');
  assert.equal(JSON.parse(read('content/published.json')).length,3);
  for(const f of ['sitemap.xml','resources/feed.xml','resources/index.html','ai-training/index.html'])assert(read(f).includes('/resources/first-ai-workshop/'),f+' missing published guide');
  build('2026-09-13');assert(!fs.existsSync(path.join(temp,'resources/first-ai-workshop/index.html')),'A future guide leaked into an earlier build');
  build('2026-11-01');assert.equal(JSON.parse(read('content/published.json')).length,8);
  assert(read('resources/ai-receptionist-cost/index.html').includes('datePublished":"2026-09-13"'));
 }finally{fs.rmSync(temp,{recursive:true,force:true});}
});
