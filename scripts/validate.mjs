import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const sitemap=fs.readFileSync(path.join(root,'sitemap.xml'),'utf8');
const urls=[...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(x=>x[1]);
assert(urls.length>=20,'Expected a complete multipage site');
const titles=new Set(),descriptions=new Set(),seen=new Set();
let links=0;
for(const url of urls){
 const route=new URL(url).pathname;
 const file=path.join(root,route,'index.html');
 const html=fs.readFileSync(file,'utf8');
 assert.equal((html.match(/<h1(?:>|\s)/g)||[]).length,1,`${route}: one H1`);
 assert(html.includes(`<link rel="canonical" href="${url}">`),`${route}: canonical`);
 assert(!html.includes('content="noindex"'),`${route}: indexable`);
 const title=html.match(/<title>(.*?)<\/title>/s)?.[1];
 const description=html.match(/<meta name="description" content="([^"]+)"/)?.[1];
 assert(title&&description,`${route}: metadata`);
 assert(!titles.has(title),`${route}: duplicate title`);titles.add(title);
 assert(!descriptions.has(description),`${route}: duplicate description`);descriptions.add(description);
 assert(!seen.has(url),'Duplicate sitemap URL');seen.add(url);
 const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]);
 assert.equal(new Set(ids).size,ids.length,`${route}: duplicate IDs`);
 for(const match of html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs))JSON.parse(match[1]);
 for(const match of html.matchAll(/(?:href|src)="([^"]+)"/g)){
  const raw=match[1].replace(/&amp;/g,'&');
  if(!raw.startsWith('/')&&!raw.startsWith('#'))continue;
  const target=new URL(raw,url);
  let local=path.join(root,target.pathname);
  if(fs.existsSync(local)&&fs.statSync(local).isDirectory())local=path.join(local,'index.html');
  assert(fs.existsSync(local),`${route}: missing ${raw}`);
  if(target.hash&&path.extname(local)==='.html'){
   const targetHTML=fs.readFileSync(local,'utf8');
   assert(targetHTML.includes(`id="${decodeURIComponent(target.hash.slice(1))}"`),`${route}: missing fragment ${raw}`);
  }
  links++;
 }
}
assert.equal(sitemap,fs.readFileSync(path.join(root,'public/sitemap.xml'),'utf8'),'Sitemap copies disagree');
assert(fs.readFileSync(path.join(root,'robots.txt'),'utf8').includes('https://dreamprotocol.ai/sitemap.xml'));
const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
for(const id of ['website-form','business-url','analysis-view','employee-view','alex-start-button','lead-form','form-status','industry-panel'])assert(index.includes(`id="${id}"`),'Missing original integration ID '+id);
console.log(`Validated ${urls.length} pages and ${links} internal links/assets: metadata, headings, schema, fragments, and original integration hooks.`);
