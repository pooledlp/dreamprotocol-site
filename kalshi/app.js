const API='https://api.dreamprotocol.ai';
const $=id=>document.getElementById(id);
const hasNum=n=>n!==null&&n!==undefined&&n!==''&&Number.isFinite(+n);
const cents=n=>hasNum(n)?(+n*100).toFixed(1)+'¢':'--';
const money=n=>hasNum(n)?new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:2,maximumFractionDigits:2}).format(+n):'--';
const pct=n=>hasNum(n)?(+n*100).toFixed(0)+'%':'--';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const asset=t=>String(t||'').match(/^KX([A-Z]+)15M/)?.[1]||String(t||'').split('-')[0].replace(/^KX/,'').replace(/15M$/,'')||'--';

let strategy={minNet:.025,minProb:.58,minEntry:.20,maxEntry:.85,maxSpread:.03,minEdge:.045,swingMinNet:.02,swingMinProb:.55,swingMinEdge:.035};
let coreLive=false,engineHealthy=false,hasScan=false,heroExact=false,lastScan=0,lastDeep=0,lastActivity=0;
let fastBusy=false,scanBusy=false,deepBusy=false,activityBusy=false;

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
  const swing=r?.signal==='DIP'||r?.signal==='PEAK';
  const minNet=swing?strategy.swingMinNet:strategy.minNet;
  const minEdge=swing?strategy.swingMinEdge:strategy.minEdge;
  const minProb=swing?strategy.swingMinProb:strategy.minProb;
  if(r?.eligible)return{label:r?.bidderMode==='TAKE'?'TAKE':'BID',cls:r?.projected?'blue':'green',why:r?.projected?'reservation price available; exact CF still decides':'price-state reservation is live'};
  const why=[];
  if(hasNum(r?.estimatedNetTarget)&&+r.estimatedNetTarget<minNet)why.push('net '+cents(r.estimatedNetTarget)+' < '+cents(minNet));
  if(hasNum(r?.grossEdge)&&+r.grossEdge<minEdge)why.push('edge '+cents(r.grossEdge)+' < '+cents(minEdge));
  if(hasNum(r?.makerEntry)&&(+r.makerEntry<strategy.minEntry||+r.makerEntry>strategy.maxEntry))why.push('entry '+cents(r.makerEntry)+' outside '+cents(strategy.minEntry)+'–'+cents(strategy.maxEntry));
  if(hasNum(r?.spread)&&+r.spread>strategy.maxSpread)why.push('spread '+cents(r.spread)+' > '+cents(strategy.maxSpread));
  const side=inferSide(r),p=side==='no'?+r?.pDown:+r?.pUp;
  if(Number.isFinite(p)&&p<minProb)why.push('fair '+pct(p)+' < '+pct(minProb));
  const sig=r?.signal&&r.signal!=='VALUE'&&r.signal!=='NONE'?r.signal+' '+(hasNum(r.signalStrength)?Number(r.signalStrength).toFixed(1)+'x':'')+' · ':'';
  return{label:'BLOCKED',cls:'amber',why:sig+(why.slice(0,2).join(' · ')||r?.reason||'fails execution gates')};
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
  const sc=s?.strategy||{};
  coreLive=!!sc.live;
  strategy={
    minNet:Number.isFinite(+sc.minNetEdgeCents)?+sc.minNetEdgeCents/100:.025,
    minProb:Number.isFinite(+sc.minModelProbability)?+sc.minModelProbability:.58,
    minEntry:Array.isArray(sc.entryCostBandCents)?+sc.entryCostBandCents[0]/100:.20,
    maxEntry:Array.isArray(sc.entryCostBandCents)?+sc.entryCostBandCents[1]/100:.85,
    maxSpread:Number.isFinite(+sc.maxSpreadCents)?+sc.maxSpreadCents/100:.03,
    minEdge:Number.isFinite(+sc.minGrossEdgeCents)?+sc.minGrossEdgeCents/100:.045,
    swingMinNet:Number.isFinite(+sc.swingMinNetEdgeCents)?+sc.swingMinNetEdgeCents/100:.02,
    swingMinProb:Number.isFinite(+sc.swingMinModelProbability)?+sc.swingMinModelProbability:.55,
    swingMinEdge:Number.isFinite(+sc.swingMinGrossEdgeCents)?+sc.swingMinGrossEdgeCents/100:.035
  };
  setText('mode',coreLive?'DIR LIVE':'PAPER');
  setClass('mode',coreLive?'green':'amber');
  setText('strategyVersion',sc.strategyVersion||'--');
  setText('strategyGate','SUPER BIDDER · price-state reservation · '+cents(strategy.minEntry)+'–'+cents(strategy.maxEntry)+' max entry · no timed confirmation · exact CF decides fair value');
  setText('riskTrade',money(sc.maxRiskDollars));
  setText('riskConcurrent',Number.isFinite(+sc.maxConcurrentPositions)?sc.maxConcurrentPositions:'--');
  setText('riskSameSide',Number.isFinite(+sc.maxSameDirectionPositions)?sc.maxSameDirectionPositions:'--');
  setText('riskLoss',money(sc.maxDailyLossDollars));
  setText('riskPortfolio','Up to '+(Number.isFinite(+sc.maxConcurrentPositions)?sc.maxConcurrentPositions:'--')+' simultaneous positions · max '+money(sc.maxConcurrentRiskDollars)+' open risk · '+money(sc.maxDailyNotionalDollars)+' daily notional · '+(Number.isFinite(+sc.maxTradesPerDay)?sc.maxTradesPerDay:'--')+' max trades');
  setText('refs','Exact CF RTI for entries · Kalshi live quotes/fills · settlement-aware probability · correlation-aware multi-crypto portfolio');
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

  if(e?.lastResult?.ticker){
    const r=e.lastResult,dr=r?.directional||{},c=dr?.candidate||{},b=dr?.bidPlan||{},rem=+r?.decision?.remaining;
    const end=Number.isFinite(rem)?Date.now()+rem*60000:NaN;
    const action=String(dr?.action||'');
    const state=action==='directional-take'?'TAKEN':
      action==='directional-bid'?'BID LIVE':
      action==='directional-bid-resting'?'BIDDING':
      action==='directional-hold'?'HOLD':
      action==='directional-market-complete'?'SETTLED':
      action==='risk-stop'?'RISK STOP':
      'WAIT';
    const cls=state==='TAKEN'||state==='BID LIVE'||state==='BIDDING'||state==='HOLD'?'green':'amber';
    heroExact=true;
    setText('selectedAsset',r.asset||asset(r.ticker));
    setText('selectedTicker',r.ticker||'--');
    setText('selectedState',state);setClass('selectedState','state '+cls);
    if(Number.isFinite(end))$('selectedTime').dataset.end=String(end);
    setText('selectedTime',remaining(rem));setText('selectedEndTime',Number.isFinite(end)?'ends '+absTime(end):'--');
    const signal=(c.signal&&c.signal!=='VALUE'&&c.signal!=='NONE')
      ?c.signal+' '+(hasNum(c.signalStrength)?Number(c.signalStrength).toFixed(1)+'x':'')+' · '
      :'';
    const bidder=b?.mode&&b.mode!=='WAIT'
      ?b.mode+' · max '+cents(b.reservationPrice)+' · market '+cents(b.marketBid)+'/'+cents(b.marketAsk)+' · '
      :'';
    setText('selectedReason',signal+bidder+(b.reason||c.reason||dr.reason||'exact CF price-state evaluation'));
    const px=hasNum(b.desiredPrice)?b.desiredPrice:c.cost;
    const net=hasNum(b.expectedNetEdge)?b.expectedNetEdge:c.netEdge;
    const gross=hasNum(c.fair)&&hasNum(px)?+c.fair-+px:c.grossEdge;
    setText('entry',cents(px));setText('net',cents(net));
    setText('gross',cents(gross));setText('spread',cents(c.spread));setText('target',hasNum(b.reservationPrice)?cents(b.reservationPrice):'100.0¢');
    setText('prob',c.side?(c.side==='yes'?'YES ':'NO ')+pct(c.fair):'--');
  }
  paintHealth();
}
function renderScan(j){
  const rows=Array.isArray(j?.markets)?j.markets:[];
  hasScan=true;lastScan=Date.now();
  setText('scanStamp',absTime(lastScan));setText('scanCount',rows.length+' live');
  const ranked=[...rows].sort((a,b)=>(b.eligible?1:0)-(a.eligible?1:0)+(+(b.score||0)-+(a.score||0)));
  const top=ranked[0]||null;
  if(top&&!heroExact){
    const g=gate(top),side=inferSide(top),p=side==='no'?top.pDown:top.pUp;
    const end=Number.isFinite(+top.remainingMinutes)?Date.now()+ +top.remainingMinutes*60000:NaN;
    setText('selectedAsset',top.asset||j.asset||'--');setText('selectedTicker',top.ticker||'--');
    const scanState=top.eligible?(top.bidderMode==='TAKE'?'TAKE':'BID'):'WAIT';
    setText('selectedState',scanState);setClass('selectedState','state '+(top.eligible?'blue':'amber'));
    if(Number.isFinite(end))$('selectedTime').dataset.end=String(end);
    setText('selectedTime',remaining(top.remainingMinutes));setText('selectedEndTime',Number.isFinite(end)?'ends '+absTime(end):'--');
    const priceState=top.eligible&&hasNum(top.reservationPrice)
      ?'PROJECTED '+String(top.bidderMode||'BID')+' · max '+cents(top.reservationPrice)+' · '
      :'PROJECTED · ';
    setText('selectedReason',priceState+g.why);
    setText('prob',side?(side==='yes'?'YES ':'NO ')+pct(p):'--');
    setText('entry',cents(top.makerEntry));setText('net',cents(top.estimatedNetTarget));setText('gross',cents(top.grossEdge));setText('spread',cents(top.spread));setText('target','100.0¢');
  }
  $('markets').innerHTML=ranked.map((r,i)=>{
    const g=gate(r),side=inferSide(r),p=side==='no'?r.pDown:r.pUp;
    return '<div class="scanRow '+(r.eligible?'hot ':i===0?'active ':'')+'">'+
      '<span class="scanAsset">'+esc(r.asset)+'</span>'+
      '<span class="scanState '+g.cls+'">'+g.label+'</span>'+
      '<span>'+(side?(side==='yes'?'YES ':'NO ')+pct(p):'--')+'</span>'+
      '<span>'+cents(r.makerEntry)+'</span>'+
      '<span class="'+(hasNum(r.estimatedNetTarget)&&Number(r.estimatedNetTarget)>=strategy.minNet?'green':'')+'">'+cents(r.estimatedNetTarget)+'</span>'+
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
function bidderEventRows(orders){
  const entries=[...(orders||[])]
    .filter(o=>String(o?.clientOrderId||'').includes('-entry-'))
    .sort((a,b)=>orderTime(b)-orderTime(a));
  return entries.slice(0,14).map((o,i)=>{
    const status=String(o.status||'').toLowerCase();
    const side=orderSide(o),price=orderCost(o),time=orderTime(o);
    const filled=+(o.filled||0),remaining=+(o.remaining||0);
    const newer=entries.slice(0,i).find(n=>
      n.ticker===o.ticker&&orderSide(n)===side&&orderTime(n)>time&&orderTime(n)-time<25000
    );
    let action='ORDER',cls='amber',detail=status||'unknown';
    if((status==='resting'||status==='open'||status==='pending')&&remaining>0){
      action='LIVE BID';cls='green';detail='resting on book · '+remaining+' remaining';
    }else if(filled>0&&(status==='executed'||remaining===0)){
      action='FILLED';cls='blue';detail=filled+' filled';
    }else if(status==='canceled'){
      if(newer){
        action='REPRICED';cls='amber';
        const np=orderCost(newer);
        detail='replaced '+cents(price)+' → '+cents(np);
      }else{
        action='CANCELED';cls='amber';detail='stale reservation removed';
      }
    }
    return{o,time,side,price,action,cls,detail};
  });
}
function renderActivity(j){
  const ps=Array.isArray(j?.positions)?j.positions:[],os=Array.isArray(j?.orders)?j.orders:[];
  const events=bidderEventRows(os);
  const liveBids=events.filter(x=>x.action==='LIVE BID');
  const reprices=events.filter(x=>x.action==='REPRICED').length;
  setText('openState',ps.length?ps.length+' OPEN':'FLAT');setClass('openState',ps.length?'green':'amber');
  setText('bidderState',liveBids.length?liveBids.length+' LIVE':events.length?'WORKING':'IDLE');
  setClass('bidderState',liveBids.length?'green':events.length?'blue':'amber');
  setText('activityTag',ps.length+' open · '+liveBids.length+' live bid'+(liveBids.length===1?'':'s'));
  setText('bidTapeTag',liveBids.length+' live · '+reprices+' repriced');
  setClass('bidTapeTag','tag '+(liveBids.length?'green':'amber'));
  $('bidTape').innerHTML=events.length?events.map(x=>
    '<div class="bidEvent">'+
      '<span class="bidTime">'+absTime(x.time)+'</span>'+
      '<b class="bidAsset">'+esc(asset(x.o.ticker))+'</b>'+
      '<span>'+String(x.side||'').toUpperCase()+'</span>'+
      '<span class="bidPrice">'+cents(x.price)+'</span>'+
      '<span class="bidAction '+x.cls+'">'+x.action+'</span>'+
      '<span class="bidDetail">'+esc(x.detail)+'</span>'+
    '</div>'
  ).join(''):'<div class="empty">No recent bidder activity. Waiting for a qualified reservation price.</div>';
  $('positions').innerHTML=ps.length?ps.map(p=>'<div class="rawRow"><b>'+esc(p.ticker)+'</b><span>'+String(p.side||'').toUpperCase()+' · position '+esc(p.position)+'</span><span>'+money(p.exposure)+'</span><span>'+absTime(p.lastUpdated)+'</span></div>').join(''):'<div class="empty">No open bot-owned position.</div>';
  $('orders').innerHTML=os.slice(0,12).map(o=>'<div class="rawRow"><b>'+esc(o.ticker)+'</b><span>'+esc(o.status)+'</span><span>'+ (String(o.clientOrderId||'').includes('-entry-')?'ENTRY '+String(orderSide(o)).toUpperCase()+' '+cents(orderCost(o)):'EXIT')+'</span><span>'+absTime(orderTime(o))+'</span></div>').join('');
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
async function refreshActivity(force=false){
  if(activityBusy)return;if(!force&&Date.now()-lastActivity<2200)return;
  lastActivity=Date.now();activityBusy=true;
  try{
    const a=await json('/kalshi-bot/activity',6000);
    if(a?.ok)renderActivity(a);
  }catch{
    setText('bidTapeTag','activity retrying');
    setClass('bidTapeTag','tag amber');
  }finally{activityBusy=false}
}
async function refreshDeep(force=false){
  if(deepBusy)return;if(!force&&Date.now()-lastDeep<8000)return;
  lastDeep=Date.now();deepBusy=true;
  try{
    const p=await json('/kalshi-bot/pnl',12000);
    if(p?.ok)renderPnl(p);
  }finally{deepBusy=false}
}
async function refresh(){await refreshFast();void refreshScan();void refreshActivity();void refreshDeep()}
refresh();void refreshScan(true);void refreshActivity(true);void refreshDeep(true);tick();
setInterval(refresh,2500);setInterval(tick,1000);