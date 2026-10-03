const API='https://api.dreamprotocol.ai';
const $=id=>document.getElementById(id);
const num=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(+v)?+v:NaN;
const money=v=>Number.isFinite(num(v))?new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:2,maximumFractionDigits:2}).format(num(v)):'--';
const pct=v=>Number.isFinite(num(v))?(num(v)*100).toFixed(num(v)>=.995?1:0)+'%':'--';
const edgePct=v=>Number.isFinite(num(v))?((num(v)*100)>=0?'+':'')+(num(v)*100).toFixed(1)+' pts':'--';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clock=v=>{
  const t=typeof v==='number'?v:Date.parse(v||'');
  return Number.isFinite(t)?new Date(t).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'}):'--';
};
const dateTime=v=>{
  const t=typeof v==='number'?v:Date.parse(v||'');
  return Number.isFinite(t)?new Date(t).toLocaleString([],{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}):'--';
};
const actionTime=o=>o?.actionTime||o?.closeTime||null;
const kalshiAppUrl=()=>{
  const fallback='https://kalshi.com/f/install';
  if(/Android/i.test(navigator.userAgent)){
    return 'intent://kalshi.com/f/install#Intent;scheme=https;package=com.kalshi.mobile;S.browser_fallback_url='+encodeURIComponent(fallback)+';end';
  }
  return fallback;
};
const timeLeft=v=>{
  const t=Date.parse(v||'');
  if(!Number.isFinite(t))return '--';
  const diff=t-Date.now();
  if(diff<=0)return 'CLOSED · awaiting result';
  const total=Math.floor(diff/1000);
  const days=Math.floor(total/86400);
  const hours=Math.floor((total%86400)/3600);
  const mins=Math.floor((total%3600)/60);
  const secs=total%60;
  if(days>0)return days+'d '+String(hours).padStart(2,'0')+'h '+String(mins).padStart(2,'0')+'m';
  if(hours>0)return hours+'h '+String(mins).padStart(2,'0')+'m '+String(secs).padStart(2,'0')+'s';
  return mins+'m '+String(secs).padStart(2,'0')+'s';
};
function updateCountdowns(){
  document.querySelectorAll('[data-countdown]').forEach(el=>{
    const value=el.getAttribute('data-countdown')||'';
    const t=Date.parse(value);
    el.textContent='TIME LEFT '+timeLeft(value);
    el.classList.toggle('red',Number.isFinite(t)&&t<=Date.now());
    el.classList.toggle('green',Number.isFinite(t)&&t>Date.now());
  });
}

let busy=false;
let lastPayload=null;
let activeCategory=null;

function entryWindow(s){
  const w=s?.scan?.entryWindowHours||{};
  const min=Number.isFinite(+w.min)?+w.min:.25;
  const max=Number.isFinite(+w.max)?+w.max:6;
  return{min,max};
}
function hoursLeft(v){
  const t=Date.parse(v||'');
  return Number.isFinite(t)?(t-Date.now())/3600000:NaN;
}
const blockedQualifications=new Set(['LATE DAY','PAST HEATING WINDOW','TOO SOON','TOO FAR','NO ACTION TIME','NO CLOSE TIME','DATA CHECK','STALE DATA']);
function isBlockedOpportunity(o){
  return blockedQualifications.has(String(o?.qualification||'').toUpperCase());
}

// Edge-first fallback qualification. The backend remains authoritative when it marks
// an opportunity qualified, but a large, well-supported pricing disagreement should
// not be reduced to WATCH ONLY merely because the chosen side is below an absolute
// model-probability threshold. This catches cases such as 31% model vs 4% market.
function edgeQualifyOpportunity(s,o){
  if(!o||o.qualified||isBlockedOpportunity(o))return o;
  const {min,max}=entryWindow(s);
  const h=hoursLeft(actionTime(o));
  const model=num(o.modelProbability);
  const market=num(o.marketPrice??o.marketProbability??o.entryPrice);
  const edge=num(o.edge);
  const confidence=num(o.confidence);
  if(!Number.isFinite(h)||h<min||h>max)return o;
  if(!Number.isFinite(model)||!Number.isFinite(market)||!Number.isFinite(edge)||!Number.isFinite(confidence))return o;
  if(market<.03||market>.97||edge<=0)return o;

  // Normal mispricing: >=10 points of edge at >=72% research confidence.
  // Very cheap contracts (<=5c) get a stricter edge/confidence gate to avoid
  // promoting every long shot while still allowing genuinely huge discrepancies.
  const lowPrice=market<=.05;
  const minEdge=lowPrice?.15:.10;
  const minConfidence=lowPrice?.75:.72;
  if(edge<minEdge||confidence<minConfidence||edge>.30)return o;

  const requestedStake=Math.max(1,num(s?.paperStakeDollars)||10);
  const contracts=Math.max(1,Math.floor(requestedStake/market));
  const stake=contracts*market;
  const profitIfWin=contracts-stake;
  return{
    ...o,
    qualified:true,
    derivedQualification:true,
    qualification:lowPrice?'EDGE QUALIFIED · LONGSHOT VALUE':'EDGE QUALIFIED',
    paperTier:'STRONG',
    paperStake:stake,
    stake,
    contracts,
    profitIfWin,
    score:Math.max(num(o.score)||0,(edge*100)+(confidence*10))
  };
}
function nearTermOpportunities(s,category=null){
  const all=Array.isArray(s?.scan?.opportunities)?s.scan.opportunities:[];
  const {max}=entryWindow(s);
  return all.filter(o=>{
    const h=hoursLeft(actionTime(o));
    return Number.isFinite(h)&&h>0&&h<=max&&!isBlockedOpportunity(o)&&(!category||String(o.category||'').toUpperCase()===String(category).toUpperCase());
  }).map(o=>edgeQualifyOpportunity(s,o));
}

function researchedCategoryOpportunities(s,category){
  const all=Array.isArray(s?.scan?.opportunities)?s.scan.opportunities:[];
  return all.filter(o=>String(o.category||'').toUpperCase()===String(category||'').toUpperCase());
}
function upcomingWeatherCalls(s){
  const all=researchedCategoryOpportunities(s,'WEATHER')
    .filter(o=>{
      const h=hoursLeft(actionTime(o));
      return Number.isFinite(h)&&h>0&&h<=24&&String(o.qualification||'').toUpperCase()!=='DATA CHECK';
    });
  const best=new Map();
  for(const o of all){
    const key=o.eventTicker||o.city||o.targetDate||o.ticker;
    const yesProb=String(o.side||'').toLowerCase()==='yes'?+o.modelProbability:1-(+o.modelProbability||0);
    const yesMarket=String(o.side||'').toLowerCase()==='yes'?+o.marketProbability:1-(+o.marketProbability||0);
    const call={
      ...o,
      side:'yes',
      modelProbability:Math.max(0,Math.min(1,yesProb)),
      marketProbability:Math.max(0,Math.min(1,yesMarket)),
      edge:yesProb-yesMarket,
      qualified:false,
      displayState:'UPCOMING'
    };
    const prev=best.get(key);
    if(!prev||call.modelProbability>prev.modelProbability)best.set(key,call);
  }
  return [...best.values()]
    .sort((a,b)=>(+b.modelProbability||0)-(+a.modelProbability||0))
    .slice(0,8);
}

async function json(path,ms=45000){
  const ac=new AbortController(),timer=setTimeout(()=>ac.abort(),ms);
  try{
    const r=await fetch(API+path,{cache:'no-store',signal:ac.signal});
    const text=await r.text();
    let body;
    try{body=JSON.parse(text)}catch{throw new Error('Invalid API response')}
    if(!r.ok)throw new Error(body?.error||('HTTP '+r.status));
    return body;
  }finally{clearTimeout(timer)}
}

function setText(id,value){const el=$(id);if(el)el.textContent=value}
function setClass(id,value){const el=$(id);if(el)el.className=value}

function health(ok,error){
  const pill=document.querySelector('.livePill');
  if(pill)pill.className='livePill '+(ok&&!error?'good':error?'bad':'');
  setText('healthText',ok&&!error?'RESEARCH LIVE':error?'DEGRADED':'CONNECTING');
}

function selectedOpportunity(s){
  const scan=s?.scan||{};
  const qualified=Array.isArray(scan.qualified)?scan.qualified:[];
  if(qualified.length)return{row:qualified[0],qualified:true,test:false};
  const open=Array.isArray(s?.positions)?s.positions:[];
  const activeOpen=open.filter(p=>{
    const t=Date.parse(actionTime(p)||"");
    return !Number.isFinite(t)||t>Date.now();
  });
  if(activeOpen.length){
    const strong=activeOpen.find(p=>p.paperTier==="STRONG");
    if(strong)return{row:strong,qualified:true,test:false,position:true};
    return{row:activeOpen[0],qualified:false,test:true,position:true};
  }
  const opps=nearTermOpportunities(s);
  const tradeable=opps.find(o=>Number.isFinite(+(o.marketPrice??o.marketProbability))&&+(o.marketPrice??o.marketProbability)>=.03&&+(o.marketPrice??o.marketProbability)<=.97);
  const row=tradeable||opps[0]||null;
  return{row,qualified:!!row?.qualified,test:false};
}

function renderHero(s){
  const pick=selectedOpportunity(s),o=pick.row;
  const qualified=!!pick.qualified&&(pick.position||!!o?.qualified);
  const test=!!pick.test;
  const status=$('heroStatus');
  if(status){
    status.textContent=qualified?'STRONG PAPER PICK':test?'TEST PAPER PICK':o?'WATCH ONLY':'NO BET NOW';
    status.className='heroStatus '+(qualified?'found':'hunting');
  }
  if(!o){
    setText('heroTitle','No bet right now');
    setText('heroSubtitle','Nothing currently passes DreamPredict’s timing, confidence, and edge rules.');
    setText('heroResearch','The engine is still researching, but it will not surface blocked or stale contracts as a bet.');
    ['heroModel','heroMarket','heroEdge','heroConfidence','heroSide','heroContracts','heroProfit','orbProb'].forEach(id=>setText(id,'--'));
    setText('heroStake',money(s?.paperStakeDollars||10));
    setText('orbLabel','NO BET');
    const orb=$('probOrb');if(orb)orb.style.setProperty('--prob','0');
    const heroActions=$('heroTradeActions');if(heroActions)heroActions.hidden=true;
    const heroLink=$('heroKalshiLink');if(heroLink)heroLink.removeAttribute('href');
    const heroCopy=$('heroCopyTicker');if(heroCopy)heroCopy.dataset.copyTicker='';
    return;
  }

  setText('heroTitle',o.title||((o.city||'Weather')+' prediction'));
  setText('heroSubtitle',(o.city?o.city+' · ':'')+(o.subtitle||o.ticker||'')+(qualified?' · STRONG PAPER PICK':test?' · TEST PAPER PICK · LOWER THRESHOLD':' · WATCH ONLY · NOT A BET'));
  setText('heroResearch',o?.research?.rationale||'Independent research loaded.');
  setText('heroModel',pct(o.modelProbability));
  setText('heroMarket',pct(o.marketProbability??o.entryPrice));
  setText('heroEdge',edgePct(o.edge));
  setText('heroConfidence',pct(o.confidence));
  setText('heroSide',(qualified||test)?String(o.side||'').toUpperCase():'WAIT');
  setText('heroStake',(qualified||test)?money(o.paperStake||o.stake||s?.paperStakeDollars||10):money(s?.paperStakeDollars||10));
  setText('heroContracts',(qualified||test)?String(o.contracts||'--'):'--');
  setText('heroProfit',(qualified||test)?money(Number.isFinite(+o.profitIfWin)?+o.profitIfWin:(+o.contracts||0)-(+o.stake||0)):'--');
  setText('orbProb',pct(o.modelProbability));
  setText('orbLabel',qualified?String(o.side||'').toUpperCase()+' STRONG':test?String(o.side||'').toUpperCase()+' TEST':'WATCH ONLY');
  const orb=$('probOrb');if(orb)orb.style.setProperty('--prob',String(Math.max(0,Math.min(100,Math.round((+o.modelProbability||0)*100)))));
  const heroActions=$('heroTradeActions');
  const heroLink=$('heroKalshiLink');
  const heroCopy=$('heroCopyTicker');
  if(heroActions)heroActions.hidden=!(qualified&&o.ticker);
  if(heroLink&&qualified&&o.ticker)heroLink.href=kalshiAppUrl();
  if(heroCopy)heroCopy.dataset.copyTicker=qualified?(o.ticker||''):'';
}

function opportunityCard(o){
  const q=!!o.qualified;
  const research=o?.research||{};
  const sourceLine=Array.isArray(research.sources)&&research.sources.length?research.sources.join(' + '):'independent research';
  return '<article class="opp '+(q?'qualified':'')+'">'+
    '<div class="oppTop"><span class="oppCategory">'+esc(o.category||'MARKET')+' · '+esc(o.city||'')+'</span><span class="oppBadge">'+esc(q?(o.qualification||'QUALIFIED'):'WATCH')+'</span></div>'+
    '<h3>'+esc(o.title||o.ticker||'Opportunity')+'</h3>'+
    '<div class="oppSub">'+esc(o.subtitle||'')+' · '+esc(String(o.side||'').toUpperCase())+'</div>'+
    '<div class="oppOdds">'+
      '<div><span>MODEL</span><b>'+pct(o.modelProbability)+'</b></div>'+
      '<div><span>MARKET</span><b>'+pct(o.marketProbability)+'</b></div>'+
      '<div><span>EDGE</span><b class="'+((+o.edge||0)>0?'green':'red')+'">'+edgePct(o.edge)+'</b></div>'+
    '</div>'+
    '<div class="oppResearch">'+esc(sourceLine)+' · confidence '+pct(o.confidence)+(q?' · '+money(o.paperStake)+' paper / '+esc(o.contracts)+' contracts':'')+'</div>'+
    '<div class="oppCountdown" data-countdown="'+esc(actionTime(o)||'')+'">TIME LEFT '+timeLeft(actionTime(o))+'</div>'+
    (q?'<div class="tradeActions"><span class="ticker">'+esc(o.ticker||'')+'</span><button type="button" class="copyTicker" data-copy-ticker="'+esc(o.ticker||'')+'">COPY TICKER</button><a class="kalshiLink" href="'+esc(kalshiAppUrl())+'">OPEN KALSHI APP ↗</a></div>':'<div class="watchOnly">WATCH ONLY · DREAM PREDICT WOULD NOT ENTER THIS</div>')+
  '</article>';
}

function renderOpportunities(s){
  const near=nearTermOpportunities(s);
  const backendQualified=(Array.isArray(s?.scan?.qualified)?s.scan.qualified:[]).map(o=>edgeQualifyOpportunity(s,o));
  const qids=new Set(backendQualified.map(x=>x.id||x.ticker));
  const rows=[...backendQualified,...near.filter(x=>!qids.has(x.id||x.ticker))]
    .sort((a,b)=>(+b.qualified-+a.qualified)||(+b.score||0)-(+a.score||0))
    .slice(0,12);
  const el=$('opportunities');
  const {max}=entryWindow(s);
  if(el)el.innerHTML=rows.length?rows.map(opportunityCard).join(''):'<div class="empty noBetEmpty"><b>NO BET NOW</b><span>Nothing currently passes the timing, confidence, and edge rules inside the next '+max+' hours.</span></div>';
  setText('scanCount',String(near.length));
  setText('qualifiedCount',String(rows.filter(x=>x.qualified).length));
  updateCountdowns();
}

function renderPositions(s){
  const rows=Array.isArray(s?.positions)?s.positions:[];
  setText('openCount',rows.length+' OPEN');
  const el=$('positions');
  if(!el)return;
  el.innerHTML=rows.length?rows.map(p=>{
    const test=p.paperTier==="TEST";
    const actionAt=Date.parse(actionTime(p)||"");
    const weatherPending=String(p.category||'').toUpperCase()==='WEATHER'&&Number.isFinite(actionAt)&&actionAt<=Date.now();
    const stateLabel=weatherPending?'AWAITING NWS SETTLEMENT':(test?'TEST PAPER PICK':'STRONG PAPER PICK');
    return '<div class="position '+(test?'testPosition ':'')+(weatherPending?'weatherPending':'')+'">'+
      '<div class="rowTop"><b>'+esc(p.city||p.category||'Prediction')+' · '+esc(String(p.side||'').toUpperCase())+'</b><span class="'+(weatherPending?'pendingTag':test?'testTag':'strongTag')+'">'+stateLabel+'</span></div>'+
      '<div class="rowMeta"><span>'+esc(p.subtitle||p.title||p.ticker)+'</span><span>'+money(p.stake)+' paper</span><span>model '+pct(p.modelProbability)+'</span><span>entry '+pct(p.marketProbability||p.entryPrice)+'</span><span>edge '+edgePct(p.edge)+'</span><span>'+esc(p.contracts)+' contracts</span>'+
        (weatherPending?'<span>HEATING WINDOW CLOSED</span><span>official settlement '+dateTime(p.closeTime)+'</span>':'<span data-countdown="'+esc(actionTime(p)||'')+'">TIME LEFT '+timeLeft(actionTime(p))+'</span>')+
      '</div>'+
      (weatherPending?'<div class="watchOnly">NO MORE WEATHER ENTRY · WAITING FOR FINAL NWS DAILY CLIMATE REPORT</div>':test?'<div class="watchOnly">PAPER TEST ONLY · LOWER THRESHOLD · NO REAL-MONEY LINK</div>':'<div class="tradeActions"><span class="ticker">'+esc(p.ticker||'')+'</span><button type="button" class="copyTicker" data-copy-ticker="'+esc(p.ticker||'')+'">COPY TICKER</button><a class="kalshiLink" href="'+esc(kalshiAppUrl())+'">OPEN KALSHI APP ↗</a></div>')+
    '</div>';
  }).join(''):'<div class="empty">No open paper predictions yet.</div>';
  updateCountdowns();
}

function renderHistory(s){
  const rows=Array.isArray(s?.recent)?s.recent:[];
  setText('settledCount',rows.length+' SETTLED');
  const el=$('history');
  if(!el)return;
  el.innerHTML=rows.length?rows.slice(0,12).map(t=>
    '<div class="historyRow">'+
      '<div class="rowTop"><b>'+esc(t.city||t.category||'Prediction')+' · '+esc(String(t.side||'').toUpperCase())+'</b><span class="'+(t.won?'win':'loss')+'">'+(t.won?'WIN ':'LOSS ')+money(t.netDollars)+'</span></div>'+
      '<div class="rowMeta"><span>'+esc(t.subtitle||t.title||t.ticker)+'</span><span>model '+pct(t.modelProbability)+'</span><span>result '+esc(String(t.result||'').toUpperCase())+'</span><span>'+dateTime(t.settledAt)+'</span></div>'+
      '<div class="tradeActions"><span class="ticker">'+esc(t.ticker||'')+'</span><button type="button" class="copyTicker" data-copy-ticker="'+esc(t.ticker||'')+'">COPY TICKER</button><a class="kalshiLink" href="'+esc(kalshiAppUrl())+'">OPEN KALSHI APP ↗</a></div>'+
    '</div>'
  ).join(''):'<div class="empty">No settled predictions yet.</div>';
}

function categoryPickRow(o){
  const q=!!o.qualified;
  const state=o.displayState||(q?(o.qualification||'PAPER READY'):'WATCH ONLY');
  const upcoming=state==='UPCOMING';
  return '<div class="categoryPick '+(q?'qualified':'')+' '+(upcoming?'upcoming':'')+'">'+
    '<div class="categoryPickTop"><b>'+esc(String(o.side||'').toUpperCase())+' · '+pct(o.modelProbability)+'</b><span>'+esc(state)+'</span></div>'+
    '<div class="categoryPickTitle">'+esc(o.title||o.subtitle||o.ticker)+'</div>'+
    '<div class="categoryPickMeta"><span>market '+pct(o.marketProbability)+'</span><span>edge '+edgePct(o.edge)+'</span><span data-countdown="'+esc(actionTime(o)||'')+'">TIME LEFT '+timeLeft(actionTime(o))+'</span></div>'+
    (q?'<div class="tradeActions"><span class="ticker">'+esc(o.ticker||'')+'</span><button type="button" class="copyTicker" data-copy-ticker="'+esc(o.ticker||'')+'">COPY TICKER</button><a class="kalshiLink" href="'+esc(kalshiAppUrl())+'">OPEN KALSHI APP ↗</a></div>':upcoming?'<div class="watchOnly">UPCOMING RESEARCH · NOT IN BET WINDOW YET</div>':'<div class="watchOnly">WATCH ONLY · NO ENTRY</div>')+
  '</div>';
}
function renderCategoryDetail(s){
  const el=$('categoryDetail');if(!el)return;
  if(!activeCategory){
    el.innerHTML='<div class="categoryPrompt">Tap Weather, Sports, Economics, or Fed to expand its predictions.</div>';
    return;
  }
  const {min,max}=entryWindow(s);
  let rows=nearTermOpportunities(s,activeCategory)
    .sort((a,b)=>(+b.qualified-+a.qualified)||(+b.modelProbability||0)-(+a.modelProbability||0)||(+b.edge||0)-(+a.edge||0))
    .slice(0,8);
  const ready=rows.filter(x=>x.qualified).length;
  let title='Best model calls · next '+max+' hours';
  let state=ready?ready+' PAPER READY':'NO BET NOW';
  if(!rows.length&&activeCategory==='WEATHER'){
    rows=upcomingWeatherCalls(s);
    if(rows.length){
      title='Upcoming weather calls · next 24 hours';
      state='RESEARCHING AHEAD';
    }
  }
  el.innerHTML='<div class="categoryDetailHead"><div><span>'+esc(activeCategory)+'</span><b>'+esc(title)+'</b></div><em>'+esc(state)+'</em></div>'+
    (rows.length?'<div class="categoryPickGrid">'+rows.map(categoryPickRow).join('')+'</div>':
      '<div class="empty">No '+esc(activeCategory.toLowerCase())+' event is inside the '+Math.round(min*60)+' minute-'+max+' hour bet window right now.</div>');
  updateCountdowns();
}
function renderCategories(s){
  const rows=Array.isArray(s?.scan?.categories)?s.scan.categories:[];
  const el=$('categories');if(!el)return;
  el.innerHTML=rows.length?rows.map(cat=>{
    const state=String(cat.status||'').toLowerCase();
    const key=String(cat.name||'').toUpperCase();
    const near=nearTermOpportunities(s,key);
    const researched=researchedCategoryOpportunities(s,key);
    const ready=near.filter(x=>x.qualified).length;
    return '<button type="button" class="category '+(activeCategory===key?'active':'')+'" data-category="'+esc(key)+'">'+
      '<div class="categoryTop"><b>'+esc(cat.name)+'</b><span class="categoryState '+esc(state)+'">'+esc(cat.status)+'</span></div>'+
      '<p>'+esc(cat.detail||'')+'</p>'+
      '<div class="categoryCounts"><span>'+(researched.length?researched.length+' RESEARCHED':'QUIET NOW')+'</span><span>'+(ready?ready+' PAPER READY':'NO BET NOW')+'</span></div>'+
    '</button>';
  }).join(''):'<div class="empty">Research universe is loading.</div>';
  renderCategoryDetail(s);
}

function renderDiagnostics(s){
  setText('engineVersion',s?.version||'--');
  setText('entries',String(s?.entries??0));
  const errors=[];
  if(s?.lastError)errors.push(s.lastError);
  if(Array.isArray(s?.scan?.errors))errors.push(...s.scan.errors.map(x=>(x.series?x.series+': ':'')+(x.error||'error')));
  setText('errors',errors.length?errors.join('\n'):'No errors.');
}

function render(s){
  lastPayload=s;
  health(!!s?.ok,s?.lastError);
  setText('mode',s?.mode||'AUTO PAPER');
  setText('stake',money(s?.paperStakeDollars||10));
  setText('openRisk',money(s?.openRisk||0));
  setText('realized',money(s?.realized||0));
  const realized=$('realized');
  if(realized)realized.className=(+s?.realized||0)>0?'green':(+s?.realized||0)<0?'red':'';
  setText('record',(s?.wins||0)+'W / '+(s?.losses||0)+'L');
  setText('lastScan',s?.lastScanAt?clock(s.lastScanAt):'--');
  const w=entryWindow(s);setText('window',Math.round(w.min*60)+' MIN-'+w.max+' HRS');
  renderHero(s);
  renderOpportunities(s);
  renderPositions(s);
  renderHistory(s);
  renderCategories(s);
  renderDiagnostics(s);
}

async function refresh(force=false){
  if(busy)return;
  busy=true;
  const btn=$('refreshBtn');
  if(btn){btn.disabled=true;btn.textContent=force?'Researching...':'Refreshing...'}
  try{
    const data=await json(force?'/dream-predict/scan':'/dream-predict/status');
    render(data);
  }catch(error){
    health(false,error instanceof Error?error.message:String(error));
    setText('healthText','RETRYING');
    if(!lastPayload){
      setText('heroTitle','Research feed reconnecting...');
      setText('heroSubtitle',error instanceof Error?error.message:String(error));
    }
  }finally{
    busy=false;
    if(btn){btn.disabled=false;btn.textContent='Refresh research'}
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
    setTimeout(()=>button.textContent=old,1200);
  }catch{
    window.prompt('Copy this Kalshi ticker:',ticker);
  }
});

$('categories')?.addEventListener('click',event=>{
  const button=event.target.closest('[data-category]');
  if(!button)return;
  const key=button.getAttribute('data-category');
  activeCategory=activeCategory===key?null:key;
  if(lastPayload)renderCategories(lastPayload);
});
$('refreshBtn')?.addEventListener('click',()=>refresh(true));
refresh(false);
setInterval(()=>refresh(false),25000);
setInterval(updateCountdowns,1000);
