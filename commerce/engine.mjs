import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(import.meta.dirname);
const {products,asOf}=JSON.parse(fs.readFileSync(path.join(root,'catalog.json'),'utf8'));
const today=process.env.BUILD_DATE||new Date().toISOString().slice(0,10);
if(!/^\d{4}-\d{2}-\d{2}$/.test(today)) throw Error('Invalid BUILD_DATE');
const candidates=products.filter(p=>p.status==='research');
const score=p=>p.demand*2+p.demo*2+p.marginPotential+p.shippingEase-p.risk-p.competition;
const ranked=[...candidates].sort((a,b)=>score(b)-score(a));
const campaigns=ranked.slice(0,6).flatMap(p=>[
 {date:today,productId:p.id,channel:'TikTok / Instagram Reels / YouTube Shorts',headline:p.hook,concept:'Film a real before/after demonstration of '+p.name+'. Show limitations honestly. No supplier footage without rights.',status:'draft-unapproved',budgetUSD:0},
 {date:today,productId:p.id,channel:'Pinterest / SEO',headline:p.angle,concept:'Create a genuine how-to guide with original verified product photos after sampling.',status:'draft-unapproved',budgetUSD:0}
]);
const report={generatedAt:today,catalogAsOf:asOf,automationState:'research and creative drafts only',liveOffers:0,paidAdsAuthorized:false,viralCandidateRanking:ranked.map(p=>({id:p.id,name:p.name,category:p.category,score:score(p),reason:p.angle})),campaigns,launchGates:['Merchant store connected','Supplier contract and sample verified','Shipping, refund and privacy policies reviewed','COGS and contribution margin verified','Checkout and tax settings verified','Campaign account connected with spend cap'],guardrails:{unverifiedSupplierNoPurchase:true,neverInventTestimonials:true,noAutomaticAdSpend:true,noUnapprovedClaims:true,doNotPostUnreviewedContent:true}};
const folder=path.join(root,'generated');
fs.mkdirSync(folder,{recursive:true});
fs.writeFileSync(path.join(folder,'marketing-plan.json'),JSON.stringify(report,null,2)+'\n');
const csv=['channel,product_id,headline,status,budget_usd',...campaigns.map(c=>[c.channel,c.productId,c.headline,c.status,c.budgetUSD].map(x=>'"'+String(x).replaceAll('"','""')+'"').join(','))].join('\n')+'\n';
fs.writeFileSync(path.join(folder,'campaign-drafts.csv'),csv);
console.log('Generated '+campaigns.length+' marketing drafts, zero ads or purchases, for '+today);
