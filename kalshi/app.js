const API='https://api.dreamprotocol.ai';
const $=id=>document.getElementById(id);
const num=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(+v)?+v:NaN;
const money=v=>Number.isFinite(num(v))?new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:2,maximumFractionDigits:2}).format(num(v)):'--';
const cents=v=>Number.isFinite(num(v))?(num(v)*100).toFixed(1).replace(/\.0$/,'')+'¢':'--';
const edge=v=>Number.isFinite(num(v))?((num(v)>=0?'+':'')+(num(v)*100).toFixed(2)+'¢'):'--';
const pct=v=>Number.isFinite(num(v))?(num(v)*100).toFixed(2)+'%':'--';
const integer=v=>Number.isFinite(num(v))?Math.round(num(v)).toLocaleString():'--';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dateTime=v=>{const t=typeof v==='number'?v:Date.parse(v||'');return Number.isFinite(t)?new Date(t).toLocaleString([],{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}):'--';};
const appUrl=()=>/Android/i.test(navigator.userAgent)?'intent://kalshi.com/f/install#Intent;scheme=https;package=com.kalshi.mobile;S.browser_fallback_url='+encodeURIComponent('https://kalshi.com/f/install')+';end':'https://kalshi.com/f/install';

let busy=false;
let lastPayload=null;

function setText(id,value){const el=$(id);if(el)el.textContent=value;}
function setClassByValue(id,value){const el=$(id);if(el)el.className=value>0?'green':value<0?'red':'';}
function health(ok,message){
  const pill=document.querySelector('.livePill');
  if(pill)pill.className='livePill '+(ok?'good':'bad');
  setText('healthText',ok?'LIVE ARB SCANNER':message?'DEGRADED':'RETRYING');
}
async function json(path){
  const r=await fetch(API+path,{cache:'no-store'});
  const data=await r.json().catch(()=>({}));
  if(!r.ok||data?.ok===false)throw new Error(data?.error||'HTTP '+r.status);
  return data;
}
function pairKey(o){return (o?.legs||[]).map(x=>(x.side||'').toUpperCase()+' '+(x.ticker||'')).join(' + ');}
function hoursLeft(v){
  const t=Date.parse(v||'');
  if(!Number.isFinite(t))return '--';
  const ms=t-Date.now();
  if(ms<=0)return 'CLOSING';
  const mins=Math.floor(ms/60000);
  const h=Math.floor(mins/60),m=mins%60;
  return h? h+'h '+m+'m' : m+'m';
}
function modeledCost(o){return (+o?.grossCost||0)+(+o?.estimatedFees||0);}
function conservativeRoi(o){const cost=modeledCost(o);return cost>0?(+o?.netEdge||0)/cost:NaN;}
function cappedPairs(o,s){const depth=Math.max(0,Math.floor(+o?.depth||0));const cap=Math.max(0,Math.floor(+s?.guardrails?.maxContracts||0));return cap?Math.min(depth,cap):depth;}
function lockedProfit(o,s){return Math.max(0,+o?.netEdge||0)*cappedPairs(o,s);}

function legHtml(leg){
  const label=(leg.venue?String(leg.venue)+' · ':'')+String(leg.side||'').toUpperCase();
  const open=leg.url?'<a class="legOpen" href="'+esc(leg.url)+'" target="_blank" rel="noopener">OPEN ↗</a>':'';
  return '<div class="leg">'+
    '<div><span>'+esc(label)+'</span><b>'+esc(leg.ticker||'')+'</b></div>'+
    '<div class="legPrice"><small>LIVE ASK</small><strong>'+cents(leg.ask)+'</strong><small>'+integer(leg.size)+' shown</small></div>'+
    '<button type="button" class="copyTicker" data-copy-ticker="'+esc(leg.ticker||'')+'">COPY</button>'+open+
  '</div>';
}

function orderedArbs(s){
  const rows=Array.isArray(s?.scan?.arbOpportunities)?[...s.scan.arbOpportunities]:[];
  return rows.sort((a,b)=>Number(!!b.qualified)-Number(!!a.qualified)||(+b.netEdge||0)-(+a.netEdge||0)||(+b.depth||0)-(+a.depth||0));
}
function orderedAllArbs(s){
  const structural=orderedArbs(s);
  const cross=Array.isArray(s?.scan?.crossVenue?.opportunities)?[...s.scan.crossVenue.opportunities]:[];
  return [...structural,...cross].sort((a,b)=>
    Number(!!b.qualified)-Number(!!a.qualified)||
    (+b.netEdge||0)-(+a.netEdge||0)||
    (+b.depth||0)-(+a.depth||0)
  );
}
function shortClock(v){
  const t=typeof v==='number'?v:Date.parse(v||'');
  return Number.isFinite(t)?new Date(t).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'}):'--';
}
function renderHero(s){
  const rows=orderedAllArbs(s);
  const qualified=rows.filter(x=>x.qualified);
  const best=qualified[0]||rows[0]||null;
  const status=$('heroStatus');
  const qualifiedCount=+s?.scan?.qualifiedArbs||0;
  const radar=$('arbRadar');

  setText('radarState',qualifiedCount>0?'LOCKED EDGE':'HUNTING');
  setText('radarEdge',integer(qualifiedCount));
  setText('radarMarkets',integer((+s?.scan?.scannedMarkets||0)+(+s?.scan?.crossVenue?.scannedPolymarketMarkets||0)));
  setText('radarCrossMatches',integer(s?.scan?.crossVenue?.strictMatches||0));
  setText('radarUpdated',shortClock(s?.lastScanAt||s?.scan?.asOf));
  if(radar)radar.className='arbRadar '+(qualifiedCount>0?'found':'hunting');

  setText('bestNetEdgeTop',best?edge(best.netEdge):'--');

  if(!best){
    if(status){status.className='heroStatus hunting';status.textContent='HUNTING';}
    setText('heroTitle','We wait for math to break.');
    setText('heroSubtitle','Dream Arb is scanning Kalshi and Polymarket in the next 24 hours and refusing to manufacture a trade when payout logic, live price, or visible depth is not provable.');
    setText('heroRule','No prediction. No forced trades. No fake edge.');
    setText('heroEdge','--');setText('heroRoi','--');setText('heroCost','--');setText('heroLockedProfit','--');setText('heroPayout','$1.00');
    $('heroLegs').innerHTML='<div class="empty compact">Markets are live. Waiting for a provable price mismatch.</div>';
    return;
  }

  const pairs=cappedPairs(best,s);
  const cross=best.kind==='CROSS_VENUE';
  if(best.qualified){
    if(status){status.className='heroStatus found';status.textContent=cross?'CROSS-VENUE ARB FOUND':'BOOK-VERIFIED ARB';}
    setText('heroTitle',best.eventTitle||'Locked edge detected');
    setText('heroSubtitle',cross
      ?'Kalshi and Polymarket disagree on the same verified outcome, and the gap still survives both books, modeled fees, visible depth, and the cross-venue execution buffer.'
      :'Both legs are available at modeled top-of-book prices with visible size, and the guaranteed minimum payout still beats cost after modeled fees and the safety buffer.');
  }else{
    if(status){status.className='heroStatus near';status.textContent='NO ARB · CLOSEST EDGE';}
    setText('heroTitle','We wait for math to break.');
    setText('heroSubtitle','The scanner is live. This is the closest verified relationship currently visible, but it does not clear the qualification threshold.');
  }
  setText('heroRule',cross
    ?'KALSHI ↔ POLYMARKET · '+(best.timeVerified?'TIME ✓':'TIME ?')+' · '+(best.ruleVerified?'RULES ✓':'RULES ?')+' · closes in '+hoursLeft(best.closeTime)+' · '+(best.qualification||'')
    :(best.strikeType||'threshold').toUpperCase()+' LADDER · '+String(best.lowerStrike)+' → '+String(best.upperStrike)+' · closes in '+hoursLeft(best.closeTime)+' · '+(best.qualification||''));
  setText('heroEdge',edge(best.netEdge));
  setText('heroRoi',pct(conservativeRoi(best)));
  setText('heroCost',cents(modeledCost(best)));
  setText('heroLockedProfit',best.qualified?money(lockedProfit(best,s)):'$0.00');
  setText('heroPayout',money(best.guaranteedMinimumPayout||1));
  $('heroLegs').innerHTML=(best.legs||[]).map(legHtml).join('');
}

function arbCard(o,s){
  const q=!!o.qualified;
  const pairs=cappedPairs(o,s);
  return '<article class="arbCard '+(q?'qualified':'rejected')+'">'+
    '<div class="cardTop"><span class="category">'+esc(o.category||'MARKET')+'</span><em>'+(q?'BOOK-VERIFIED':'REJECTED')+'</em></div>'+
    '<h3>'+esc(o.eventTitle||o.eventTicker||'Kalshi event')+'</h3>'+
    '<div class="threshold">'+esc(String(o.strikeType||'').toUpperCase())+' · '+esc(String(o.lowerStrike))+' → '+esc(String(o.upperStrike))+' · closes '+esc(hoursLeft(o.closeTime))+'</div>'+
    '<div class="miniMetrics">'+
      '<div><span>NET EDGE</span><b class="'+(q?'green':(+o.netEdge<0?'red':'amber'))+'">'+edge(o.netEdge)+'</b></div>'+
      '<div><span>CONSERVATIVE ROI</span><b>'+pct(conservativeRoi(o))+'</b></div>'+
      '<div><span>VISIBLE DEPTH</span><b>'+(o.depth==null?'--':integer(o.depth)+' pairs')+'</b></div>'+
      '<div><span>LOCKED $ @ CAP</span><b>'+(q?money((+o.netEdge||0)*pairs):'$0.00')+'</b></div>'+
    '</div>'+
    '<div class="cardLegs">'+(o.legs||[]).map(legHtml).join('')+'</div>'+
    '<div class="qualification">'+esc(o.qualification||'')+' · pair '+cents(o.grossCost)+' · modeled fees '+cents(o.estimatedFees)+' · buffer '+cents(o.safetyMargin)+'</div>'+
  '</article>';
}
function renderArbs(s){
  const rows=orderedArbs(s);
  const el=$('arbs');if(!el)return;
  if(!rows.length){
    el.innerHTML='<div class="noEdge"><b>NO STRUCTURAL PAIRS PRICED YET</b><span>The scanner is still checking. Empty is better than manufacturing a bet.</span></div>';
    return;
  }
  const qualified=rows.filter(x=>x.qualified);
  const near=rows.filter(x=>!x.qualified).slice(0,4);
  const shown=[...qualified.slice(0,10),...near].slice(0,14);
  el.innerHTML=shown.map(o=>arbCard(o,s)).join('');
}

function crossVenueCard(o,s){
  const q=!!o.qualified;
  const pairs=cappedPairs(o,s);
  const roi=conservativeRoi(o);
  const proof=[
    o.matchMethod==='EXACT_SEQUENCE'?'QUESTION ✓':'QUESTION ?',
    o.timeVerified?'TIME ✓':'TIME ?',
    o.ruleVerified?'RULES ✓':'RULES ?'
  ].join(' · ');
  return '<article class="arbCard crossCard '+(q?'qualified':'rejected')+'">'+
    '<div class="cardTop"><span class="category">KALSHI ↔ POLYMARKET</span><em>'+(q?'CROSS ARB':'WATCH')+'</em></div>'+
    '<h3>'+esc(o.eventTitle||'Cross-venue market')+'</h3>'+
    '<div class="threshold">'+esc(proof)+' · match '+pct(o.matchConfidence||0)+'</div>'+
    '<div class="miniMetrics">'+
      '<div><span>NET EDGE</span><b class="'+(q?'green':(+o.netEdge<0?'red':'amber'))+'">'+edge(o.netEdge)+'</b></div>'+
      '<div><span>CONSERVATIVE ROI</span><b>'+pct(roi)+'</b></div>'+
      '<div><span>VISIBLE DEPTH</span><b>'+(o.depth==null?'--':integer(o.depth)+' pairs')+'</b></div>'+
      '<div><span>LOCKED $ @ CAP</span><b>'+(q?money((+o.netEdge||0)*pairs):'$0.00')+'</b></div>'+
    '</div>'+
    '<div class="cardLegs">'+(o.legs||[]).map(legHtml).join('')+'</div>'+
    '<div class="qualification">'+esc(o.qualification||'')+' · pair '+cents(o.grossCost)+' · modeled fees '+cents(o.estimatedFees)+' · cross-venue buffer '+cents(o.safetyMargin)+'</div>'+
  '</article>';
}
function renderCrossVenue(s){
  const x=s?.scan?.crossVenue||{};
  const rows=Array.isArray(x.opportunities)?x.opportunities:[];
  setText('polyMarketCount',integer(x.scannedPolymarketMarkets||0));
  setText('strictMatchCount',integer(x.strictMatches||0));
  setText('crossArbCount',integer(x.qualifiedArbs||0));
  setText('polyCacheState',x.catalogCached?'CACHED':'FRESH');
  setText('diagPolyMarkets',integer(x.scannedPolymarketMarkets||0));
  setText('diagStrictMatches',integer(x.strictMatches||0));
  const tag=$('crossVenueTag');
  if(tag){
    tag.textContent=x.qualifiedArbs>0?'ARB FOUND':x.enabled===false?'OFF':'HUNTING';
    tag.className='tag '+(x.qualifiedArbs>0?'safe':x.enabled===false?'amber':'');
  }
  const el=$('crossVenue');if(!el)return;
  if(!x.enabled){
    el.innerHTML='<div class="noEdge"><b>CROSS-VENUE SCANNER OFF</b><span>Polymarket comparison is disabled.</span></div>';
    return;
  }
  if(!rows.length){
    el.innerHTML='<div class="noEdge"><b>NO STRICT CROSS-VENUE MATCH PRICED YET</b><span>'+integer(x.scannedPolymarketMarkets||0)+' Polymarket markets checked. A similar headline alone is not enough to call an arb.</span></div>';
    return;
  }
  const qualified=rows.filter(o=>o.qualified);
  const near=rows.filter(o=>!o.qualified).slice(0,6);
  el.innerHTML=[...qualified.slice(0,10),...near].slice(0,14).map(o=>crossVenueCard(o,s)).join('');
}

function arbPaperStats(s){
  const rows=Array.isArray(s?.shadow?.recent)?s.shadow.recent:[];
  const total=+s?.shadow?.theoreticalLockedProfit||0;
  const capital=rows.reduce((sum,x)=>sum+(+x.capital||0),0);
  const cutoff=Date.now()-86_400_000;
  const recent24=rows.filter(x=>(+x.capturedAt||0)>=cutoff);
  return{
    rows,total,capital,
    roi:capital>0?total/capital:NaN,
    last24Profit:recent24.reduce((sum,x)=>sum+(+x.lockedProfit||0),0),
    last24Count:recent24.length
  };
}
function renderPaper(s){
  const p=arbPaperStats(s);
  const captures=+s?.shadow?.captures||0;
  setText('paperArb',money(p.total));
  setText('arbPnl',money(p.total));
  setText('arbCaptureCount',integer(captures));
  setText('captureTopCount',integer(captures));
  setText('paperCapital',money(p.capital));
  setText('paperRoi',Number.isFinite(p.roi)?pct(p.roi):'--');
  setText('paper24h',money(p.last24Profit));
  setText('paper24hCount',p.last24Count+' capture'+(p.last24Count===1?'':'s'));
  setClassByValue('paperArb',p.total);setClassByValue('arbPnl',p.total);setClassByValue('paper24h',p.last24Profit);
  const verdict=$('paperVerdict');
  if(!verdict)return;
  if(p.total>0){
    verdict.className='paperVerdict positive';
    verdict.innerHTML='<b>ARB PAPER LEDGER IS POSITIVE</b><span>'+money(p.total)+' theoretical locked profit across '+captures+' unique capture'+(captures===1?'':'s')+'. Still fake money until execution is proven.</span>';
  }else{
    verdict.className='paperVerdict neutral';
    verdict.innerHTML='<b>WAITING FOR A QUALIFIED ARB</b><span>No forced trades. Zero is better than fake edge.</span>';
  }
}
function captureRow(x){
  const payout=(+x.capital||0)+(+x.lockedProfit||0);
  return '<div class="capture paperTrade">'+
    '<div class="captureTop"><div><span class="paperLabel">FAKE TRADE · LOCKED MODEL</span><b>'+esc(x.eventTitle||x.eventTicker||'Structural pair')+'</b></div><strong class="green">+'+money(Math.max(0,+x.lockedProfit||0))+'</strong></div>'+
    '<div class="captureMeta"><span>'+integer(x.contracts)+' pairs</span><span>'+money(x.capital)+' modeled capital</span><span>'+money(payout)+' modeled minimum payout</span><span>'+edge(x.netEdge)+' / pair</span><span>'+dateTime(x.capturedAt)+'</span></div>'+
    '<div class="captureLegs">'+esc(pairKey(x))+'</div>'+
  '</div>';
}
function renderCaptures(s){
  const p=arbPaperStats(s);
  setText('captureCount',(s?.shadow?.captures||0)+' ARB CAPTURES');
  const el=$('captures');
  if(el)el.innerHTML=p.rows.length?p.rows.slice(0,20).map(captureRow).join(''):'<div class="empty">No qualified arb capture yet. The engine is allowed to stay empty.</div>';
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
  el.innerHTML=rows.length?rows.slice(0,8).map(rewardCard).join(''):'<div class="noEdge"><b>NO ACTIVE LIQUIDITY PROGRAMS RETURNED</b><span>Liquidity rewards are watch-only anyway.</span></div>';
}

function cryptoOpenRow(p){
  const stake=(+p.entryCost||0)*(+p.count||0);
  return '<div class="cryptoTrade openTrade"><div class="cryptoTradeTop"><div><span>'+esc(p.asset||'CRYPTO')+' · '+esc(String(p.side||'').toUpperCase())+'</span><b>'+esc(p.ticker||'')+'</b></div><strong class="amber">LEGACY OPEN</strong></div><div class="cryptoTradeMeta"><span>Entry '+cents(p.entryCost)+'</span><span>'+integer(p.count)+' contracts</span><span>'+money(stake)+' fake risk</span><span>'+dateTime(p.enteredAt)+'</span></div></div>';
}
function cryptoTradeRow(t){
  const net=+t.netDollars||0;
  return '<div class="cryptoTrade"><div class="cryptoTradeTop"><div><span>'+esc(t.asset||'CRYPTO')+' · '+esc(String(t.side||'').toUpperCase())+'</span><b>'+esc(t.ticker||'')+'</b></div><strong class="'+(net>0?'green':net<0?'red':'')+'">'+(net>0?'+':'')+money(net)+'</strong></div><div class="cryptoTradeMeta"><span>'+cents(t.entryCost)+' → '+cents(t.exitCost)+'</span><span>'+integer(t.count)+' contracts</span><span>'+esc(t.reason||'exit')+'</span><span>'+dateTime(t.exitedAt)+'</span></div></div>';
}
function renderCrypto(s){
  const c=s?.crypto||{};
  const rows=Array.isArray(c.recent)?c.recent:[];
  const open=Array.isArray(c.openPositions)?c.openPositions:[];
  setText('cryptoEngineState',c.enabled?'PAPER LIVE':'PAUSED');
  setText('cryptoTotalPnl',money(c.totalPnl||0));
  setText('cryptoWinLoss',(c.wins||0)+'W / '+(c.losses||0)+'L');
  setText('cryptoAvgWin',money(c.avgWin||0));
  setText('cryptoAvgLoss',money(-(c.avgLoss||0)));
  setText('cryptoProfitFactor',Number.isFinite(num(c.profitFactor))?num(c.profitFactor).toFixed(2):'--');
  setText('cryptoExpectancy',money(c.expectancyPerTrade||0));
  setText('cryptoOpenRisk',money(c.openRisk||0));
  setText('cryptoLastAction',String(c.lastAction||'--').replace(/^paper-scalp-/,'').toUpperCase());
  setText('cryptoOpenCount',integer(open.length));
  setText('cryptoTradeCount',integer(c.completed||rows.length));
  setClassByValue('cryptoTotalPnl',+c.totalPnl||0);setClassByValue('cryptoAvgWin',+c.avgWin||0);setClassByValue('cryptoExpectancy',+c.expectancyPerTrade||0);
  const loss=$('cryptoAvgLoss');if(loss&&+c.avgLoss>0)loss.className='red';
  const openEl=$('cryptoOpenPositions');if(openEl)openEl.innerHTML=open.length?open.map(cryptoOpenRow).join(''):'<div class="empty">No open crypto paper position.</div>';
  const tradeEl=$('cryptoTrades');if(tradeEl)tradeEl.innerHTML=rows.length?rows.slice(0,20).map(cryptoTradeRow).join(''):'<div class="empty">No completed crypto paper scalp.</div>';
}

function renderGuardrails(s){
  setText('minEdge',edge(s?.guardrails?.minNetEdge));
  setText('safetyMargin',cents(s?.guardrails?.safetyMargin));
  setText('maxContracts',integer(s?.guardrails?.maxContracts));
  setText('horizonHours',integer(s?.guardrails?.horizonHours)+'h');
  setText('executionReason',s?.execution?.reason||'Real-money execution is locked.');
  const tag=$('executionTag');if(tag)tag.textContent=s?.execution?.live?'LIVE':'SHADOW ONLY';
}
function renderDiagnostics(s){
  setText('engineVersion',s?.version||'--');
  setText('eventCount',integer(s?.scan?.scannedEvents||0));
  setText('marketCount',integer(s?.scan?.scannedMarkets||0));
  setText('arbCandidates',integer((s?.scan?.arbOpportunities||[]).length));
  const errors=[];
  if(s?.lastError)errors.push(s.lastError);
  if(Array.isArray(s?.scan?.errors))errors.push(...s.scan.errors);
  setText('errors',errors.length?errors.join('\n'):'No errors.');
}

function render(s){
  lastPayload=s;
  health(!!s?.ok,s?.lastError);
  setText('mode',s?.focus==='ARB_FIRST'?'ARB-FIRST':'SHADOW');
  setText('arbCount',integer(s?.scan?.qualifiedArbs||0));
  setText('realProfit',money(0));
  renderHero(s);
  renderPaper(s);
  renderArbs(s);
  renderCrossVenue(s);
  renderCaptures(s);
  renderLiquidity(s);
  renderCrypto(s);
  renderGuardrails(s);
  renderDiagnostics(s);
}
async function refresh(force=false){
  if(busy)return;
  busy=true;
  const btn=$('refreshBtn');
  if(btn){btn.disabled=true;btn.innerHTML='<span>'+(force?'SCANNING...':'REFRESHING...')+'</span>';}
  try{
    const data=await json(force?'/dream-predict/scan':'/dream-predict/status');
    render(data);
  }catch(error){
    const message=error instanceof Error?error.message:String(error);
    health(false,message);
    if(!lastPayload){
      setText('heroTitle','Scanner reconnecting...');
      setText('heroSubtitle',message);
    }
  }finally{
    busy=false;
    if(btn){btn.disabled=false;btn.innerHTML='<span>SCAN NOW</span>';}
  }
}
document.addEventListener('click',async event=>{
  const button=event.target.closest('[data-copy-ticker]');
  if(!button)return;
  const ticker=button.getAttribute('data-copy-ticker')||'';
  if(!ticker)return;
  try{
    await navigator.clipboard.writeText(ticker);
    const old=button.textContent;button.textContent='COPIED';setTimeout(()=>button.textContent=old,1100);
  }catch{window.prompt('Copy this Kalshi ticker:',ticker);}
});
$('refreshBtn')?.addEventListener('click',()=>refresh(true));
refresh(false);
setInterval(()=>refresh(false),20000);
