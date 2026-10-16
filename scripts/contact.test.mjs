import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
const script=fs.readFileSync(new URL('../assets/site.js',import.meta.url),'utf8');
function fixture(response,{search='?service=AI%20training',leadType=''}={}){
 const listeners={};const classes=()=>({add(){},remove(){},contains:()=>false});const button={disabled:false,innerHTML:'Submit <span>→</span>',classList:classes()};const status={textContent:'',innerHTML:'',classList:classes(),scrollIntoView(){}};
 const fields={name:'Test Person',company:'Example Company',email:'test@example.com',workflow:'Connect our inquiry process'};
 let reset=false;let payload;
 const form={dataset:{leadType},elements:{workflow:{value:''},service_interest:{value:''}},querySelector:()=>button,addEventListener:(name,fn)=>listeners[name]=fn,reset:()=>{reset=true;}};
 const noop={addEventListener(){},classList:{contains:()=>false}};
 const context={document:{body:{dataset:{}},documentElement:{},querySelectorAll:()=>[],querySelector:s=>({'#lead-form':form,'#form-status':status,'.menu-button':noop,'#primary-nav':noop}[s]),addEventListener(){}},location:{pathname:leadType==='subscription'?'/start-monthly-ai/':'/contact/',search},window:{DREAMPROTOCOL_ATTRIBUTION:{landing_page:'/ai-training/',utm_source:'search'}},URLSearchParams,AbortSignal,FormData:class{*[Symbol.iterator](){yield*Object.entries(fields);}},setTimeout:fn=>{fn();return 1;},fetch:async(url,options)=>{payload={url,body:JSON.parse(options.body)};return response;}};
 vm.runInNewContext(script,context);
 return {form,button,status,submit:()=>listeners.submit({preventDefault(){}}),get reset(){return reset;},get payload(){return payload;}};
}
test('Contact form carries service context and campaign attribution without sending a real message',async()=>{
 const f=fixture({ok:true,json:async()=>({success:true})});
 assert.equal(f.form.elements.workflow.value,"I'm interested in AI training. ");
 await f.submit();
 assert.equal(f.payload.url,'https://formsubmit.co/ajax/pooledlp@gmail.com');
 assert.equal(f.payload.body.source_page,'/contact/');
 assert.equal(f.payload.body.landing_page,'/ai-training/');
 assert.equal(f.payload.body.utm_source,'search');
 assert.equal(f.reset,true);assert.equal(f.button.disabled,true);assert.match(f.button.innerHTML,/Sent/);assert.match(f.status.innerHTML,/Request sent/);
});
test('Contact form preserves the inquiry and permits retry after rejected delivery',async()=>{
 const f=fixture({ok:true,json:async()=>({success:false})});await f.submit();
 assert.equal(f.reset,false);assert.equal(f.button.disabled,false);assert.match(f.status.innerHTML,/Couldn’t send/);
});
test('HTTP failure also preserves the inquiry',async()=>{
 const f=fixture({ok:false});await f.submit();assert.equal(f.reset,false);assert.match(f.status.innerHTML,/Couldn’t send/);
});

test('Monthly plan form preserves service choice, source, and no-payment acknowledgement',async()=>{
 const f=fixture({ok:true,json:async()=>({success:true})},{search:'?service=AI%20receptionist&source=offer-primary',leadType:'subscription'});
 assert.equal(f.form.elements.service_interest.value,'AI phone receptionist');
 await f.submit();
 assert.match(f.payload.body._subject,/monthly AI plan/);
 assert.equal(f.payload.body.campaign_source,'offer-primary');
 assert.equal(f.payload.body.source_page,'/start-monthly-ai/');
 assert.match(f.status.innerHTML,/No payment was collected/);
});

test('Managed AI monthly plan is selected from referral link',()=>{
 const f=fixture({ok:true,json:async()=>({success:true})},{search:'?service=Managed%20AI%20Operations',leadType:'subscription'});
 assert.equal(f.form.elements.service_interest.value,'Managed AI operations');
});
