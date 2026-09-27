const API='https://api.dreamprotocol.ai';
const $=id=>document.getElementById(id);
const cents=n=>Number.isFinite(+n)?(+n*100).toFixed(1)+'¢':'--';
const money=n=>Number.isFinite(+n)?new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:2,maximumFractionDigits:2}).format(+n):'--';
const pct=n=>Number.isFinite(+n)?(+n*100).toFixed(0)+'%':'--';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const asset=t=>String(t||'').match(/^KX([A-Z]+)15M/)?.[1]||String(t||'').split('-')[0].replace(/^KX/,'').replace(/15M$/,'')||'--';

let strategy={minNet:.04,minProb:.70,minEntry:.60,maxEntry:.80,maxSpread:.025,minEdge:.05,makerOnly:true};
let coreLive=false,engineHealthy=false,hasScan=false,lastScan=0,lastDeep=0;
let fastBusy=false,scanBusy=false,deepBusy=false;

async function json(path,ms=6000){
  const ac=new AbortController(),timer=setTimeout(()=>ac.abort(),ms);
  try{
    const r=await fetch(API+path,{cache:'no-store',signal:ac.signal});
    if(!r.ok)throw new Error('HTTP '+r.status);
    return await r.json();
  }finally{clearTimeout(timer)}
}
function remaining(min){
  if(!Number.isFinite(+min))return'--:--';
  const s=Math.max(0,Math.round(+min*60));
  return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0');
}
function absTime(v){
  const t=typeof v==='number'?v:Date.parse(v||'');
  return Number.isFinite(t)?new Date(t).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'}):'--';
}
function setText(id,v){const el=$(id);if(el)el.textContent=v}
function setClass(id,c){const el=$(id);if(el)el.className=c}
function inferSide(r){
  if(r?.side)return r.side;
  if(!Number.isFinite(+r?.makerEntry)||!Number.isFinite(+r?.grossEdge))return null;
  const fair=+r.makerEntry + +r.grossEdge;
  const up=Number.isFinite(+r.pUp)?+r.pUp:NaN,down=Number.isFinite(+r.pDown)?+r.pDown:NaN;
  if(Number.isFinite(up)&&Number.isFinite(down))return Math.abs(down-fair)<Math.abs(up-fair)?'no':'yes';
  return null;
}
function gate(r){
  if(r?.eligible)return{label:'SWEET SPOT',cls:'green',why:'all execution gates pass'};
  const why=[];
  if(Number.isFinite(+r?.estimatedNetTarget)&&+r.estimatedNetTarget<strategy.minNet)why.push('net '+cents(r.estimatedNetTarget)+' < '+cents(strategy.minNet));
  if(Number.isFinite(+r?.grossEdge)&&+r.grossEdge<strategy.minEdge)why.push('edge '+cents(r.grossEdge)+' < '+cents(strategy.minEdge));
  if(Number.isFinite(+r?.makerEntry)&&(+r.makerEntry<strategy.minEntry||+r.makerEntry>strategy.maxEntry))why.push('entry '+cents(r.makerEntry)+' outside '+cents(strategy.minEntry)+'–'+cents(strategy.maxEntry));
  if(Number.isFinite(+r?.spread)&&+r.spread>strategy.maxSpread)why.push('spread '+cents(r.spread)+' > '+cents(strategy.maxSpread));
  const side=inferSide(r),p=side==='no'?+r?.pDown:+r?.pUp;
  if(Number.isFinite(p)&&p<strategy.minProb)why.push('fair '+pct(p)+' < '+pct(strategy.minProb));
  return{label:'BLOCKED',cls:'amber',why:why.slice(0,2).join(' · ')||'fails execution gates'};
}
function paintHealth(){
  const live=coreLive&&engineHealthy;
  setText('healthText',live?'LIVE':coreLive||engineHealthy?'SYNCING':'CONNECTING');
  const dot=$('feedDot');if(dot)dot.className='dot '+(live?'green':coreLive||engineHealthy?'amber':'amber');
}
function tick(){
  const now=Date.now();
  document.querySelectorAll('[data-end]').forEach(el=>{
    const end=+el.dataset.end;if(end)el.textContent=remaining((end-now)/60000);
  });
  const next=Math.ceil((now+1)/(15*60*1000))*(15*60*1000);
  setText('rolloverCountdown',remaining((next-now)/60000));
}
function renderStatus(s){
  coreLive=!!s?.scalper?.live;
  const sc=s?.scalper||{};
  strategy={
    minNet:Number.isFinite(+sc.minEstimatedNetTargetCents)?+sc.minEstimatedNetTargetCents/100:.04,
    minProb:Number.isFinite(+sc.minModelProbability)?+sc.minModelProbability:.70,
    minEntry:Array.isArray(sc.entryCostBandCents)?+sc.entryCostBandCents[0]/100:.60,
    maxEntry:Array.isArray(sc.entryCostBandCents)?+sc.entryCostBandCents[1]/100:.80,
    maxSpread:Number.isFinite(+sc.maxSpreadCents)?+sc.maxSpreadCents/100:.025,
    minEdge:Number.isFinite(+sc.minGrossEdgeCents)?+sc.minGrossEdgeCents/100:.05,
    makerOnly:sc.makerOnlyEntries!==false
  };
  setText('mode',coreLive?'LIVE':'PAPER');
  setClass('mode',coreLive?'green':'amber');
  setText('strategyVersion',sc.strategyVersion||'--');
  setText('strategyGate',(strategy.makerOnly?'MAKER ONLY · ':'')+cents(strategy.minEntry)+'–'+cents(strategy.maxEntry)+' · ≥'+cents(strategy.minNet)+' net · ≥'+pct(strategy.minProb)+' fair');
  setText('riskTrade',money(sc.maxRiskDollars));
  setText('riskLoss',money(sc.maxDailyLossDollars));
  setText('riskNotional',money(sc.maxDailyNotionalDollars));
  setText('riskTrades',Number.isFinite(+sc.maxTradesPerDay)?sc.maxTradesPerDay:'--');
  setText('refs','CF indexes: '+((sc.referenceIndexes||[]).join(' · ')||'--')+' · Kalshi quotes/fills · exchange history fallback');
}
function renderEngine(e){
  engineHealthy=!!e?.ok&&!e?.lastError;
  const ws=e?.websocket||{},age=Number.isFinite(+ws.lastMessageAgeMs)?+ws.lastMessageAgeMs:NaN;
  const fresh=!!ws.open&&Number.isFinite(age)&&age<2500;
  setText('feedAge',Number.isFinite(age)?Math.round(age)+'ms':'--');
  setClass('feedAge',fresh?'green':ws.open?'amber':'red');
  setText('wsState',fresh?'FRESH':ws.open?'STALE':'OFFLINE');
  setClass('wsState',fresh?'green':ws.open?'amber':'red');
  setText('refCount',Number.isFinite(+ws.referenceCount)?ws.referenceCount:'--');
  setText('refTargets',(Number.isFinite(+ws.targetCount)?ws.targetCount:'--')+' targets');
  setText('quoteCount',Number.isFinite(+ws.quoteCount)?ws.quoteCount:'--');
  setText('quoteTargets',(Number.isFinite(+ws.targetCount)?ws.targetCount:'--')+' targets');
  setText('engineCycles',Number.isFinite(+e?.cycleCount)?Number(e.cycleCount).toLocaleString():'--');
  setText('engineTrigger',e?.lastTrigger?String(e.lastTrigger).replaceAll('-',' '):'--');
  setText('feedHealth',fresh?'CF HEALTHY':ws.open?'CF STALE':'CF OFFLINE');
  setClass('feedHealth','tag '+(fresh?'green':ws.open?'amber':'red'));
  setText('healthSub',fresh?(Math.round(age)+'ms CF / quotes'):'engine + CF feed');
  const detail=[];
  if(Number.isFinite(+ws.messageCount))detail.push(Number(ws.messageCount).toLocaleString()+' messages');
  if(Number.isFinite(+ws.reconnectCount))detail.push(ws.reconnectCount+' reconnects');
  if(Number.isFinite(+ws.referenceCount)&&Number.isFinite(+ws.targetCount))detail.push(ws.referenceCount+'/'+ws.targetCount+' refs');
  if(Number.isFinite(+ws.quoteCount)&&Number.isFinite(+ws.targetCount))detail.push(ws.quoteCount+'/'+ws.targetCount+' quotes');
  if(ws.lastError)detail.push('socket: '+ws.lastError);
  setText('feedDetail',detail.join(' · ')||'No feed telemetry.');

  if(!hasScan&&e?.lastResult?.ticker){
    const r=e.lastResult,sc=r?.scalp?.scalp||{},rem=+r?.decision?.remaining;
    const end=Number.isFinite(rem)?Date.now()+rem*60000:NaN;
    setText('selectedAsset',r.asset||asset(r.ticker));
    setText('selectedTicker',r.ticker||'--');
    setText('selectedState','WAIT');
    setClass('selectedState','state amber');
    if(Number.isFinite(end))$('selectedTime').dataset.end=String(end);
    setText('selectedTime',remaining(rem));
    setText('selectedEndTime',Number.isFinite(end)?'ends '+absTime(end):'--');
    setText('selectedReason','ENGINE LIVE · market scan updating');
    setText('entry',cents(sc.makerEntry));setText('net',cents(sc.estimatedNetTarget));
    setText('gross',cents(sc.grossEdge));setText('spread',cents(sc.spread));setText('target',cents(sc.targetExit));
  }
  paintHealth();
}
function renderScan(j){
  const rows=Array.isArray(j?.markets)?j.markets:[];
  hasScan=true;lastScan=Date.now();
  setText('scanStamp',absTime(lastScan));setText('scanCount',rows.length+' live');
  const ranked=[...rows].sort((a,b)=>(b.eligible?1:0)-(a.eligible?1:0)+(+(b.score||0)-+(a.score||0)));
  const top=ranked[0]||null;
  if(top){
    const g=gate(top),side=inferSide(top),p=side==='no'?top.pDown:top.pUp;
    const end=Number.isFinite(+top.remainingMinutes)?Date.now()+ +top.remainingMinutes*60000:NaN;
    setText('selectedAsset',top.asset||j.asset||'--');setText('selectedTicker',top.ticker||'--');
    setText('selectedState',top.eligible?'SWEET SPOT':'WAIT');setClass('selectedState','state '+(top.eligible?'green':'amber'));
    if(Number.isFinite(end))$('selectedTime').dataset.end=String(end);
    setText('selectedTime',remaining(top.remainingMinutes));setText('selectedEndTime',Number.isFinite(end)?'ends '+absTime(end):'--');
    setText('selectedReason',top.eligible?'READY · '+g.why:'WAIT · '+g.why);
    setText('prob',side?(side==='yes'?'YES ':'NO ')+pct(p):'--');
    setText('entry',cents(top.makerEntry));setText('net',cents(top.estimatedNetTarget));setText('gross',cents(top.grossEdge));setText('spread',cents(top.spread));setText('target',cents(top.targetExit));
  }
  $('markets').innerHTML=ranked.map((r,i)=>{
    const g=gate(r),side=inferSide(r),p=side==='no'?r.pDown:r.pUp;
    return '<div class="scanRow '+(r.eligible?'hot ':i===0?'active ':'')+'">'+
      '<span class="scanAsset">'+esc(r.asset)+'</span>'+
      '<span class="scanState '+g.cls+'">'+g.label+'</span>'+
      '<span>'+(side?(side==='yes'?'YES ':'NO ')+pct(p):'--')+'</span>'+
      '<span>'+cents(r.makerEntry)+'</span>'+
      '<span class="'+(Number(r.estimatedNetTarget)>=strategy.minNet?'green':'')+'">'+cents(r.estimatedNetTarget)+'</span>'+
      '<span>'+cents(r.spread)+'</span>'+
      '<span class="scanWhy">'+esc(g.why)+'</span>'+
    '</div>';
  }).join('')||'<div class="empty">No active supported markets.</div>';
}
function renderPnl(j){
  const t=j?.today;if(!j?.ok||!t)return;
  const net=+t.realizedNetDollars||0,completed=+t.completed||0,wins=+t.wins||0;
  setText('todayTrades',completed);setText('todayWL',wins+'W / '+Math.max(0,completed-wins)+'L');
  setText('todayNet',money(net));setClass('todayNet',net>0?'green':net<0?'red':'amber');
  setText('pnl',money(net));setClass('pnl',net>0?'green':net<0?'red':'amber');
  setText('pnlGross',money(t.realizedGrossDollars));setText('pnlFees',money(t.realizedFeesDollars));

  const trades=Array.isArray(j?.recentTrades)?j.recentTrades:[];
  $('trades').innerHTML=trades.length?trades.slice(0,10).map(t=>{
    const move=Number.isFinite(+t.netDollars)?+t.netDollars:NaN;
    return '<div class="tradeRow">'+
      '<span>'+absTime(t.closedAt)+'</span>'+
      '<b>'+esc(t.asset||asset(t.ticker))+'</b>'+
      '<span>'+String(t.side||'').toUpperCase()+'</span>'+
      '<span>'+cents(t.entryPrice)+'</span>'+
      '<span>'+cents(t.exitPrice)+'</span>'+
      '<span class="tradeMove '+(move>=0?'pos':'neg')+'">'+money(move)+'</span>'+
    '</div>';
  }).join(''):'<div class="empty">No reconciled completed trades yet.</div>';
}
function orderTime(o){return Date.parse(o?.lastUpdateTime||o?.createdTime||'')||0}
function orderSide(o){
  const id=String(o?.clientOrderId||''),m=id.match(/-(yes|no)-/i);
  if(m)return m[1].toLowerCase();
  return String(o?.bookSide||'').toLowerCase()==='ask'?'no':'yes';
}
function orderCost(o){
  const y=+o?.yesPrice;if(!Number.isFinite(y))return NaN;
  return orderSide(o)==='no'?1-y:y;
}
function pairTrades(orders){
  const rows=[...(orders||[])].sort((a,b)=>orderTime(a)-orderTime(b)),out=[];
  const entries=[];
  for(const o of rows){
    const id=String(o.clientOrderId||'');
    if(!id.includes('-entry-')||!(+(o.filled||0)>0))continue;
    entries.push(o);
  }
  for(const exit of rows){
    const id=String(exit.clientOrderId||'');
    if(!id.includes('-exit-')||String(exit.status||'').toLowerCase()!=='executed'||!(+(exit.filled||0)>0))continue;
    const candidates=entries.filter(e=>e.ticker===exit.ticker&&orderTime(e)<=orderTime(exit)&&orderSide(e)===orderSide(exit));
    const entry=candidates.sort((a,b)=>orderTime(b)-orderTime(a))[0];if(!entry)continue;
    const ec=orderCost(entry),xc=orderCost(exit),move=Number.isFinite(ec)&&Number.isFinite(xc)?xc-ec:NaN;
    out.push({time:orderTime(exit),asset:asset(exit.ticker),side:orderSide(entry),entry:ec,exit:xc,move});
  }
  return out.sort((a,b)=>b.time-a.time).slice(0,6);
}
function renderActivity(j){
  const ps=Array.isArray(j?.positions)?j.positions:[],os=Array.isArray(j?.orders)?j.orders:[];
  setText('openState',ps.length?ps.length+' OPEN':'FLAT');setClass('openState',ps.length?'green':'amber');
  setText('activityTag',ps.length+' open · '+os.length+' raw orders');
  $('positions').innerHTML=ps.length?ps.map(p=>'<div class="rawRow"><b>'+esc(p.ticker)+'</b><span>position '+esc(p.position)+'</span><span>'+money(p.exposure)+'</span><span>'+absTime(p.lastUpdated)+'</span></div>').join(''):'<div class="empty">No open bot-owned position.</div>';
  $('orders').innerHTML=os.slice(0,10).map(o=>'<div class="rawRow"><b>'+esc(o.ticker)+'</b><span>'+esc(o.status)+'</span><span>'+ (String(o.clientOrderId||'').includes('-entry-')?'ENTRY':'EXIT')+'</span><span>'+absTime(orderTime(o))+'</span></div>').join('');
}
async function refreshFast(){
  if(fastBusy)return;fastBusy=true;
  try{
    const [s,e]=await Promise.allSettled([json('/kalshi-bot/status',4000),json('/kalshi-bot/engine-status',4000)]);
    if(s.status==='fulfilled')renderStatus(s.value);
    if(e.status==='fulfilled')renderEngine(e.value);
    paintHealth();
  }finally{fastBusy=false}
}
async function refreshScan(force=false){
  if(scanBusy)return;if(!force&&Date.now()-lastScan<5000)return;
  scanBusy=true;
  try{const q=await json('/kalshi-bot/scalp-shadow',12000);if(q?.ok)renderScan(q)}
  catch{if(!hasScan)setText('selectedReason','ENGINE LIVE · market scan retrying')}
  finally{scanBusy=false}
}
async function refreshDeep(force=false){
  if(deepBusy)return;if(!force&&Date.now()-lastDeep<8000)return;
  lastDeep=Date.now();deepBusy=true;
  try{
    const [p,a]=await Promise.allSettled([json('/kalshi-bot/pnl',12000),json('/kalshi-bot/activity',8000)]);
    if(p.status==='fulfilled')renderPnl(p.value);
    if(a.status==='fulfilled')renderActivity(a.value);
  }finally{deepBusy=false}
}
async function refresh(){await refreshFast();void refreshScan();void refreshDeep()}
refresh();void refreshScan(true);void refreshDeep(true);tick();
setInterval(refresh,2500);setInterval(tick,1000);