import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const data=fs.readFileSync(new URL('../btc/data.js',import.meta.url),'utf8');
const app=fs.readFileSync(new URL('../btc/app.js',import.meta.url),'utf8').replace(/\bboot\(\);\s*$/,'');
function harness(){
  const els=new Map();const el=id=>{if(!els.has(id))els.set(id,{textContent:'',className:'',style:{},classList:{remove(){},add(){},toggle(){}},addEventListener(){}});return els.get(id)};
  let clock=100000;
  class Clock extends Date {static now(){return clock}}
  const ctx=vm.createContext({Date:Clock,Intl,console,AbortController,setTimeout,clearTimeout,setInterval(){},document:{getElementById:el,addEventListener(){}},localStorage:{getItem(){return null}}});
  vm.runInContext(data+'\n'+app,ctx);
  return {run:s=>vm.runInContext(s,ctx),el,ctx,advance:n=>clock+=n};
}
test('cached snapshots and failed polls do not refresh source timestamps',async()=>{
  const h=harness();h.run("getJSON=async()=>({market:{ticker:'m'},coinbase:{price:80000},signals:{cbBook:.1}})");
  await h.run('getSnapshot().then(applySnapshot)');assert.equal(h.run('state.priceAt'),100000);
  h.advance(1000);await h.run('getSnapshot().then(applySnapshot)');assert.equal(h.run('state.priceAt'),100000);
  h.run("render=()=>{};getJSON=async()=>{throw Error('offline')}");h.advance(13000);
  await h.run('refreshPrices()');assert.equal(h.run('state.priceAt'),100000);assert.equal(h.el('status').textContent,'DEGRADED');
});
test('retained market does not become fresh when backend omits market',async()=>{
  const h=harness();h.run("state.market={ticker:'old'};state.kalshiAt=1;getJSON=async()=>({coinbase:{price:80000}})");
  await h.run('getSnapshot().then(applySnapshot)');assert.equal(h.run('state.kalshiAt'),1);
});
test('missing settlement and null quotes remain unknown',()=>{
  const h=harness();assert.equal(h.run('marketResult({settlement_value:null})'),null);
  assert.equal(h.run('marketResult({})'),null);assert.equal(h.run('marketResult({result:"no"})'),'no');
  assert.equal(h.run('Number.isNaN(marketQuote({yes_ask:null}).yesAsk)'),true);
});
test('paused directional mode displays scalper limits',async()=>{
  const h=harness();h.run("getJSON=async()=>({live:true,directionalEnabled:false,risk:{maxDailyLossDollars:5},scalper:{live:true,maxRiskDollars:1,maxDailyLossDollars:3,maxDailyNotionalDollars:100,maxTradesPerDay:100}})");
  await h.run('refreshBotStatus()');assert.equal(h.el('botLoss').textContent,'$3');assert.equal(h.el('botDaily').textContent,'$100');
  h.run("getJSON=async()=>{throw Error('offline')}");await h.run('refreshBotStatus()');assert.equal(h.el('botLoss').textContent,'--');assert.equal(h.el('botLock').textContent,'EXECUTION STATUS UNKNOWN');
});
test('null shadow quotes never show zero cents',async()=>{
  const h=harness();h.run('getJSON=async()=>({scalp:{makerEntry:null,targetExit:null,grossEdge:null,spread:null}})');
  await h.run('refreshScalpShadow()');assert.equal(h.el('scalpEntry').textContent,'--¢');
});
test('incomplete financial report hides numeric totals',async()=>{
  const h=harness();h.run('getJSON=async()=>({ok:true,complete:false,today:{realizedNetDollars:9}})');
  await h.run('refreshScalpAccounting()');assert.equal(h.el('liveNet').textContent,'--');assert.equal(h.el('livePnlStatus').textContent,'RESULTS NOT VERIFIED');
});
