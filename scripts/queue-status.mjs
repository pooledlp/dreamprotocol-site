import fs from 'node:fs';
import {guides} from '../content/guides.mjs';
const today=new Date().toISOString().slice(0,10);
const future=guides.filter(g=>g.status==='scheduled'&&g.publishOn>today).sort((a,b)=>a.publishOn.localeCompare(b.publishOn));
const report=`## Editorial queue\n\n${future.length} guides remain scheduled.\n\n${future.map(g=>`- ${g.publishOn}: ${g.title}`).join('\n')}\n\n${future.length<2?'The prepared queue needs replenishing. Add useful, reviewed guides; the system does not invent or recycle articles.':'Scheduled guides publish on the first successful build on or after their date.'}\n`;
console.log(report);
if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,report);
if(future.length<2)console.log('::warning title=Editorial queue needs attention::Fewer than two future guides remain. Add reviewed content to content/guides.mjs.');
