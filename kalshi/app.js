const API='https://api.dreamprotocol.ai';
const $=id=>document.getElementById(id);
const num=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(+v)?+v:NaN;
const money=v=>Number.isFinite(num(v))?new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:2,maximumFractionDigits:2}).format(num(v)):'--';
const cents=v=>Number.isFinite(num(v))?(num(v)*100).toFixed(1).replace(/\.0$/,'')+'¢':'--';
const edge=v=>Number.isFinite(num(v))?((num(v)>=0?'+':'')+(num(v)*100).toFixed(2)+'¢'):'--';
const pct=v=>Number.isFinite(num(v))?(num(v)*100).toFixed(2)+'%':'--';
const integer=v=>Number.isFinite(num(v))?Math.round(num(v)).toLocaleString():'--';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clock=v=>{
  const t=typeof v==='number'?v:Date.parse(v||'');
  return Number.isFinite(t)?new Date(t).toLocaleTimeString([],{hour:'numeric',minute:'2-digit',second:'2-digit'}):'--';
};
const dateTime=v=>{
  const t=typeof v==='number'?v:Date.parse(v||'');
  return Number.isFinite(t)?new Date(t).toLocaleString([],{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}):'--';
};
const appUrl=()=>/Android/i.test(navigator.userAgent)
  ?'intent://kalshi.com/f/install#Intent;scheme=https;package=com.kalshi.mobile;S.browser_fallback_url='+encodeURIComponent('https://kalshi.com/f/install')+';end'
  :'https://kalshi.com/f/install';

let busy=false;
let lastPayload=null;

function setText(id,value){
  const el=$(id);if(el)el.textContent=value;
}
function health(ok,message){
  const pill=document.querySelector('.livePill');
  if(pill)pill.className='livePill '+(ok?'good':'bad');
  setText('healthText',ok?'LIVE SCANNER':message?'DEGRADED':'RETRYING');
}
async function json(path){
  const r=await fetch(API+path,{cache:'no-store'});
  const data=await r.json().catch(()=>({}));
  if(!r.ok||data?.ok===false)throw new Error(data?.error||'HTTP '+r.status);
  return data;
}
function pairKey(o){
  return (o?.legs||[]).map(x=>(x.side||'').toUpperCase()+' '+(x.ticker||'')).join(' + ');
}
function legHtml(leg){
  return '<div class="leg">'+
    '<div><span>'+esc(String(leg.side||'').toUpperCase())+'</span><b>'+esc(leg.ticker||'')+'</b></div>'+
    '<div class="legPrice"><small>ASK</small><strong>'+cents(leg.ask)+'</strong></div>'+
    '<button type="button" class="copyTicker" data-copy-ticker="'+esc(leg.ticker||'')+'">COPY</button>'+
  '</div>';
}

function renderHero(s){
  const rows=Array.isArray(s?.scan?.arbOpportunities)?s.scan.arbOpportunities:[];
  const qualified=rows.filter(x=>x.qualified);
  const best=qualified[0]||rows[0]||null;
  const status=$('heroStatus');
  if(!best){
    if(status){status.className='heroStatus hunting';status.textContent='HUNTING'}
    setText('heroTitle','No structural pair priced yet.');
    setText('heroSubtitle','Dream Arb is scanning open Kalshi threshold ladders and refusing to invent a trade when the relationship or price is not provable.');
    setText('heroRule','No prediction required. If the payoff relationship cannot be proven, it does not get the ARB label.');
    setText('heroEdge','--');setText('heroCost','--');setText('heroFees','--');setText('heroDepth','--');
    $('heroLegs').innerHTML='<div class="empty compact">Waiting for a provable price mismatch.</div>';
    return;
  }
  if(best.qualified){
    status.className='heroStatus found';status.textContent='LOCKED EDGE FOUND';
    setText('heroTitle',best.eventTitle||'Structural arbitrage detected');
    setText('heroSubtitle','Both legs are priced below their guaranteed minimum combined payout after conservative estimated fees and the configured safety margin.');
  }else{
    status.className='heroStatus near';status.textContent='NO ARB · CLOSEST PAIR';
    setText('heroTitle','No guaranteed edge right now.');
    setText('heroSubtitle','This is the closest structural pair currently visible, shown so you can see what the scanner is rejecting instead of a blank screen.');
  }
  setText('heroRule',(best.strikeType||'threshold').toUpperCase()+' ladder · '+String(best.lowerStrike)+' → '+String(best.upperStrike)+' · '+(best.qualification||''));
  setText('heroEdge',edge(best.netEdge));
  setText('heroCost',cents(best.grossCost));
  setText('heroFees',cents((+best.estimatedFees||0)+(+best.safetyMargin||0)));
  setText('heroDepth',best.depth===null||best.depth===undefined?'UNKNOWN':integer(best.depth)+' pairs');
  setText('heroPayout',money(best.guaranteedMinimumPayout||1));
  $('heroLegs').innerHTML=(best.legs||[]).map(legHtml).join('');
}

function arbCard(o){
  const q=!!o.qualified;
  return '<article class="arbCard '+(q?'qualified':'rejected')+'">'+
    '<div class="cardTop"><span class="category">'+esc(o.category||'MARKET')+'</span><em>'+(q?'ARB':'REJECTED')+'</em></div>'+
    '<h3>'+esc(o.eventTitle||o.eventTicker||'Kalshi event')+'</h3>'+
    '<div class="threshold">'+esc(String(o.strikeType||'').toUpperCase())+' · '+esc(String(o.lowerStrike))+' → '+esc(String(o.upperStrike))+'</div>'+
    '<div class="miniMetrics">'+
      '<div><span>NET EDGE</span><b class="'+(q?'green':(+o.netEdge<0?'red':'amber'))+'">'+edge(o.netEdge)+'</b></div>'+
      '<div><span>PAIR COST</span><b>'+cents(o.grossCost)+'</b></div>'+
      '<div><span>FEES + BUFFER</span><b>'+cents((+o.estimatedFees||0)+(+o.safetyMargin||0))+'</b></div>'+
      '<div><span>DEPTH</span><b>'+(o.depth==null?'--':integer(o.depth))+'</b></div>'+
    '</div>'+
    '<div class="cardLegs">'+(o.legs||[]).map(legHtml).join('')+'</div>'+
    '<div class="qualification">'+esc(o.qualification||'')+'</div>'+
  '</article>';
}
function renderArbs(s){
  const rows=Array.isArray(s?.scan?.arbOpportunities)?s.scan.arbOpportunities:[];
  const el=$('arbs');if(!el)return;
  if(!rows.length){
    el.innerHTML='<div class="noEdge"><b>NO STRUCTURAL PAIRS PRICED YET</b><span>The bot is still scanning. Empty is better than manufacturing a bet.</span></div>';
    return;
  }
  const qualified=rows.filter(x=>x.qualified);
  const near=rows.filter(x=>!x.qualified).slice(0,6);
  const shown=[...qualified.slice(0,8),...near].slice(0,12);
  el.innerHTML=shown.map(arbCard).join('');
}

function rewardCard(r){
  const perDay=Number.isFinite(num(r.rewardPerDay))?money(r.rewardPerDay):'--';
  const ends=r.endDate?dateTime(r.endDate):'--';
  return '<article class="rewardCard">'+
    '<div class="cardTop"><span class="category">LIQUIDITY</span><em class="cyan">'+esc(r.qualification||'WATCH')+'</em></div>'+
    '<h3>'+esc(r.ticker||'Kalshi market')+'</h3>'+
    '<p>'+esc(r.description||'Active liquidity incentive')+'</p>'+
    '<div class="miniMetrics rewardMetrics">'+
      '<div><span>POOL / PERIOD</span><b>'+money(r.reward)+'</b></div>'+
      '<div><span>POOL / DAY</span><b>'+perDay+'</b></div>'+
      '<div><span>TARGET SIZE</span><b>'+integer(r.targetSize)+'</b></div>'+
      '<div><span>ENDS</span><b>'+esc(ends)+'</b></div>'+
    '</div>'+
    '<div class="tradeBar"><span>'+esc(r.ticker||'')+'</span><button type="button" class="copyTicker" data-copy-ticker="'+esc(r.ticker||'')+'">COPY TICKER</button><a href="'+esc(appUrl())+'">OPEN KALSHI ↗</a></div>'+
  '</article>';
}
function renderLiquidity(s){
  const rows=Array.isArray(s?.scan?.liquidityOpportunities)?s.scan.liquidityOpportunities:[];
  const el=$('liquidity');if(!el)return;
  el.innerHTML=rows.length?rows.slice(0,12).map(rewardCard).join(''):
    '<div class="noEdge"><b>NO ACTIVE LIQUIDITY PROGRAMS RETURNED</b><span>The scanner will keep checking automatically.</span></div>';
}

function captureRow(x){
  const payout=(+x.capital||0)+(+x.lockedProfit||0);
  return '<div class="capture paperTrade">'+
    '<div class="captureTop"><div><span class="paperLabel">FAKE TRADE · LOCKED MODEL</span><b>'+esc(x.eventTitle||x.eventTicker||'Structural pair')+'</b></div><strong class="green">+'+money(Math.max(0,+x.lockedProfit||0))+'</strong></div>'+
    '<div class="captureMeta"><span>'+integer(x.contracts)+' pairs</span><span>'+money(x.capital)+' fake capital</span><span>'+money(payout)+' modeled minimum payout</span><span>'+edge(x.netEdge)+' / pair</span><span>'+dateTime(x.capturedAt)+'</span></div>'+
    '<div class="captureLegs">'+esc(pairKey(x))+'</div>'+
  '</div>';
}
function isToday(ts){
  const d=new Date(+ts||0),n=new Date();
  return d.getFullYear()===n.getFullYear()&&d.getMonth()===n.getMonth()&&d.getDate()===n.getDate();
}
function arbPaperStats(s){
  const rows=Array.isArray(s?.shadow?.recent)?s.shadow.recent:[];
  const total=+s?.shadow?.theoreticalLockedProfit||0;
  const capital=rows.reduce((sum,x)=>sum+(+x.capital||0),0);
  const today=rows.filter(x=>isToday(x.capturedAt));
  return{rows,total,capital,today,todayProfit:today.reduce((sum,x)=>sum+(+x.lockedProfit||0),0)};
}
function cryptoPaperStats(s){
  const rows=Array.isArray(s?.crypto?.recent)?s.crypto.recent:[];
  return{
    rows,
    total:+s?.crypto?.totalPnl||0,
    today:+s?.crypto?.todayPnl||0,
    capital:+s?.crypto?.modeledCapital||0,
    completed:+s?.crypto?.completed||0,
    wins:+s?.crypto?.wins||0,
    losses:+s?.crypto?.losses||0,
    open:Array.isArray(s?.crypto?.openPositions)?s.crypto.openPositions:[],
    openRisk:+s?.crypto?.openRisk||0
  };
}
function combinedPaperStats(s){
  const a=arbPaperStats(s),c=cryptoPaperStats(s);
  const total=a.total+c.total;
  const capital=a.capital+c.capital;
  return{arb:a,crypto:c,total,capital,roi:capital>0?total/capital:NaN,trades:(+s?.shadow?.captures||0)+c.completed};
}
function renderPaperPnl(s){
  const p=combinedPaperStats(s);
  setText('paperTotal',money(p.total));
  setText('paperCrypto',money(p.crypto.total));
  setText('cryptoRecord',p.crypto.wins+'W / '+p.crypto.losses+'L');
  setText('paperArb',money(p.arb.total));
  setText('arbCaptureCount',(s?.shadow?.captures||0)+' capture'+((s?.shadow?.captures||0)===1?'':'s'));
  setText('paperRoi',Number.isFinite(p.roi)?pct(p.roi):'--');
  setText('paperTrades',integer(p.trades));
  setText('totalPaperPnl',money(p.total));
  setText('cryptoPnl',money(p.crypto.total));
  setText('arbPnl',money(p.arb.total));
  setText('realProfit',money(0));
  setText('realTotal',money(0));
  setText('realPnlNote',s?.execution?.live?'Live P&L feed not connected':'Trading not armed');
  for(const id of ['paperTotal','totalPaperPnl']){
    const el=$(id);if(el)el.className=p.total>0?'green':p.total<0?'red':'';
  }
  for(const [id,value] of [['paperCrypto',p.crypto.total],['cryptoPnl',p.crypto.total],['paperArb',p.arb.total],['arbPnl',p.arb.total]]){
    const el=$(id);if(el)el.className=value>0?'green':value<0?'red':'';
  }
  const verdict=$('paperVerdict');
  if(verdict){
    if(p.total>0){
      verdict.className='paperVerdict positive';
      verdict.innerHTML='<b>COMBINED PAPER STACK IS PROFITABLE</b><span>Total '+money(p.total)+' · Crypto '+money(p.crypto.total)+' · ARB '+money(p.arb.total)+'. Still fake money.</span>';
    }else if(p.total<0){
      verdict.className='paperVerdict negative';
      verdict.innerHTML='<b>COMBINED PAPER STACK IS LOSING</b><span>Total '+money(p.total)+' · Crypto '+money(p.crypto.total)+' · ARB '+money(p.arb.total)+'. Do not arm real money.</span>';
    }else{
      verdict.className='paperVerdict neutral';
      verdict.innerHTML='<b>NO PAPER PROFIT YET</b><span>Crypto is hunting mean-reversion scalps while ARB waits for locked math. Liquidity is watch-only.</span>';
    }
  }
}
function renderCaptures(s){
  const p=arbPaperStats(s);
  setText('captureCount',(s?.shadow?.captures||0)+' ARB CAPTURES');
  const el=$('captures');if(el)el.innerHTML=p.rows.length?p.rows.slice(0,20).map(captureRow).join(''):
    '<div class="empty">No ARB fake trade yet. That engine is allowed to stay empty.</div>';
}

function cryptoOpenRow(p){
  const stake=(+p.entryCost||0)*(+p.count||0);
  return '<div class="cryptoTrade openTrade">'+
    '<div class="cryptoTradeTop"><div><span>'+esc(p.asset||'CRYPTO')+' · '+esc(String(p.side||'').toUpperCase())+'</span><b>'+esc(p.ticker||'')+'</b></div><strong class="amber">OPEN</strong></div>'+
    '<div class="cryptoTradeMeta"><span>Entry '+cents(p.entryCost)+'</span><span>'+integer(p.count)+' contracts</span><span>'+money(stake)+' fake risk</span><span>'+dateTime(p.enteredAt)+'</span></div>'+
  '</div>';
}
function cryptoTradeRow(t){
  const net=+t.netDollars||0;
  const fees=((+t.entryFee||0)+(+t.exitFee||0))*(+t.count||0);
  return '<div class="cryptoTrade">'+
    '<div class="cryptoTradeTop"><div><span>'+esc(t.asset||'CRYPTO')+' · '+esc(String(t.side||'').toUpperCase())+'</span><b>'+esc(t.ticker||'')+'</b></div><strong class="'+(net>0?'green':net<0?'red':'')+'">'+(net>0?'+':'')+money(net)+'</strong></div>'+
    '<div class="cryptoTradeMeta"><span>'+cents(t.entryCost)+' → '+cents(t.exitCost)+'</span><span>'+integer(t.count)+' contracts</span><span>'+money(fees)+' fees</span><span>'+esc(t.reason||'exit')+'</span><span>'+dateTime(t.exitedAt)+'</span></div>'+
  '</div>';
}
function renderCrypto(s){
  const c=cryptoPaperStats(s);
  setText('cryptoTotalPnl',money(c.total));
  setText('cryptoTodayPnl',money(c.today));
  setText('cryptoWinLoss',c.wins+'W / '+c.losses+'L');
  setText('cryptoAvgWin',money(s?.crypto?.avgWin||0));
  setText('cryptoAvgLoss',money(-(s?.crypto?.avgLoss||0)));
  setText('cryptoProfitFactor',Number.isFinite(num(s?.crypto?.profitFactor))?num(s.crypto.profitFactor).toFixed(2):'--');
  setText('cryptoExpectancy',money(s?.crypto?.expectancyPerTrade||0));
  setText('cryptoPayoff',Number.isFinite(num(s?.crypto?.payoffRatio))?num(s.crypto.payoffRatio).toFixed(2)+'×':'--');
  setText('cryptoOpenRisk',money(c.openRisk));
  setText('cryptoLastAction',String(s?.crypto?.lastAction||'WAIT').replace(/^paper-scalp-/,'').toUpperCase());
  setText('cryptoOpenCount',integer(c.open.length));
  setText('cryptoTradeCount',integer(c.completed));
  for(const [id,value] of [
    ['cryptoTotalPnl',c.total],
    ['cryptoAvgWin',+(s?.crypto?.avgWin||0)],
    ['cryptoExpectancy',+(s?.crypto?.expectancyPerTrade||0)]
  ]){
    const el=$(id);if(el)el.className=value>0?'green':value<0?'red':'';
  }
  const lossEl=$('cryptoAvgLoss');if(lossEl&&+(s?.crypto?.avgLoss||0)>0)lossEl.className='red';
  const pfEl=$('cryptoProfitFactor');if(pfEl){
    const pf=+s?.crypto?.profitFactor||0;
    pfEl.className=pf>=1.5?'green':pf>0&&pf<1?'red':'';
  }
  const socket=$('cryptoSocketTag');
  if(socket){
    const open=!!s?.crypto?.socket?.open;
    socket.textContent=open?'5 FEEDS LIVE':'FEED RECONNECTING';
    socket.className='tag '+(open?'safe':'amber');
  }
  const state=$('cryptoEngineState');
  if(state)state.textContent=s?.crypto?.socket?.open?'PAPER LIVE':'RECONNECTING';
  setText('cryptoEnginePnl',money(c.total));
  setText('cryptoEngineDetail',(s?.crypto?.socket?.targets||0)+' feeds · '+c.completed+' completed · '+c.open.length+' open');
  const openEl=$('cryptoOpenPositions');if(openEl)openEl.innerHTML=c.open.length?c.open.map(cryptoOpenRow).join(''):'<div class="empty">No open crypto paper position.</div>';
  const tradeEl=$('cryptoTrades');if(tradeEl)tradeEl.innerHTML=c.rows.length?c.rows.slice(0,20).map(cryptoTradeRow).join(''):'<div class="empty">No completed crypto paper scalp yet.</div>';
}
function renderEngineStack(s){
  const a=arbPaperStats(s);
  const qualified=+s?.scan?.qualifiedArbs||0;
  setText('arbEnginePnl',money(a.total));
  setText('arbEngineState',qualified>0?'ARB FOUND':'HUNTING');
  setText('arbEngineDetail',qualified+' qualified now · '+(s?.shadow?.captures||0)+' captured historically');
  setText('liquidityEngineCount',integer(s?.scan?.liquidityPrograms||0));
  const arbP=$('arbEnginePnl');if(arbP)arbP.className=a.total>0?'green':'';
  const cryptoP=$('cryptoEnginePnl');if(cryptoP)cryptoP.className=(+s?.crypto?.totalPnl||0)>0?'green':(+s?.crypto?.totalPnl||0)<0?'red':'';
}

function renderGuardrails(s){
  setText('minEdge',edge(s?.guardrails?.minNetEdge));
  setText('safetyMargin',cents(s?.guardrails?.safetyMargin));
  setText('maxContracts',integer(s?.guardrails?.maxContracts));
  setText('mecRule',s?.guardrails?.mutuallyExclusiveBasketAssumption===false?'OFF':'CHECK');
  setText('executionReason',s?.execution?.reason||'Real-money execution is locked.');
  const tag=$('executionTag');
  if(tag)tag.textContent=s?.execution?.live?'LIVE':'SHADOW ONLY';
}

function renderDiagnostics(s){
  setText('engineVersion',s?.version||'--');
  setText('eventCount',integer(s?.scan?.scannedEvents||0));
  setText('arbCandidates',integer((s?.scan?.arbOpportunities||[]).length));
  setText('liquidityPrograms',integer(s?.scan?.liquidityPrograms||0));
  const errors=[];
  if(s?.lastError)errors.push(s.lastError);
  if(Array.isArray(s?.scan?.errors))errors.push(...s.scan.errors);
  setText('errors',errors.length?errors.join('\n'):'No errors.');
}

function render(s){
  lastPayload=s;
  health(!!s?.ok,s?.lastError);
  setText('mode','PAPER STACK');
  setText('arbCount',integer(s?.scan?.qualifiedArbs||0));
  renderPaperPnl(s);
  renderEngineStack(s);
  renderCrypto(s);
  renderHero(s);
  renderArbs(s);
  renderLiquidity(s);
  renderCaptures(s);
  renderGuardrails(s);
  renderDiagnostics(s);
}

async function refresh(force=false){
  if(busy)return;
  busy=true;
  const btn=$('refreshBtn');
  if(btn){btn.disabled=true;btn.textContent=force?'Scanning...':'Refreshing...'}
  try{
    const data=await json(force?'/dream-predict/scan':'/dream-predict/status');
    render(data);
  }catch(error){
    const message=error instanceof Error?error.message:String(error);
    health(false,message);
    setText('healthText','RETRYING');
    if(!lastPayload){
      setText('heroTitle','Scanner reconnecting...');
      setText('heroSubtitle',message);
    }
  }finally{
    busy=false;
    if(btn){btn.disabled=false;btn.textContent='Scan now'}
  }
}

document.addEventListener('click',async event=>{
  const button=event.target.closest('[data-copy-ticker]');
  if(!button)return;
  const ticker=button.getAttribute('data-copy-ticker')||'';
  if(!ticker)return;
  try{
    await navigator.clipboard.writeText(ticker);
    const old=button.textContent;
    button.textContent='COPIED';
    setTimeout(()=>button.textContent=old,1100);
  }catch{
    window.prompt('Copy this Kalshi ticker:',ticker);
  }
});
$('refreshBtn')?.addEventListener('click',()=>refresh(true));
refresh(false);
setInterval(()=>refresh(false),20000);
