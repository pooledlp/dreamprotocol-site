import fs from 'node:fs';
import {guides} from '../content/guides.mjs';
const today=new Date().toISOString().slice(0,10);
const future=guides.filter(g=>g.status==='scheduled'&&g.publishOn>today).sort((a,b)=>a.publishOn.localeCompare(b.publishOn));
const report=`## Editorial queue\n\n${future.length} prepared guides remain scheduled.\n\n${future.map(g=>`- ${g.publishOn}: ${g.title}`).join('\n')}\n\nIn addition, the weekly editorial job researches and reviews one new article when OPENAI_API_KEY is configured. See content/runs for attempt outcomes; a held article is not published. Scheduled prepared guides publish on the first successful build on or after their date.\n`;
console.log(report);
if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,report);
