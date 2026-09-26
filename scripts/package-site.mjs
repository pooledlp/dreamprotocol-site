import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const out=path.join(root,'_site');
// Only this known generated directory is replaced; source and repository files stay outside it.
if(fs.existsSync(out))fs.rmSync(out,{recursive:true});
fs.mkdirSync(out);
const urls=[...fs.readFileSync(path.join(root,'sitemap.xml'),'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)].map(x=>new URL(x[1]).pathname);
const copy=(f)=>{const dest=path.join(out,f);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.cpSync(path.join(root,f),dest,{recursive:true});};
for(const route of urls)copy(path.join(route,'index.html'));
for(const f of ['404.html','CNAME','.nojekyll','favicon.svg','robots.txt','sitemap.xml','resources/feed.xml','assets','public','demo-audio','btc','client-login','app.js','attribution.js'])copy(f);
console.log('Packaged published site. Drafts, tooling, and editorial source excluded.');
