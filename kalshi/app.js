const API='https://api.dreamprotocol.ai';
const STATUS_PATH='/dream-predict/status';
const POLL_MS=8000;
let lastPayload=null;
let lastFetchedAt=0;
let busy=false;

const $=id=>document.getElementById(id);
const n=v=>{const x=Number(v);return Number.isFinite(x)?x:NaN};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=v=>{const x=n(v);return Number.isFinite(x)?new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:2,maximumFractionDigits:2}).format(x):'--'};
const cents=v=>{const x=n(v);return Number.isFinite(x)?(x*100).toFixed(x*100<10?2:1)+'¢':'--'};
const pct=v=>{const x=n(v);return Number.isFinite(x)?(x*100).toFixed(Math.abs(x)<.1?2:1)+'%':'--'};
const integer=v=>{const x=n(v);return Number.isFinite(x)?Math.round(x).toLocaleString():'0'};
const dateTime=v=>{
  const x=typeof v==='number'?v:Date.parse(v);
  if(!Number.isFinite(x))return'--';
  return new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(new Date(x));
};
const ageText=ms=>{
  if(!Number.isFinite(ms)||ms<0)return'--';
  const s=Math.floor(ms/1000);
  if(s<60)return s+'s ago';
  const m=Math.floor(s/60);
  if(m<60)return m+'m ago';
  return Math.floor(m/60)+'h ago';
};
function setText(id,value){const el=$(id);if(el)el.textContent=value}
function valueClass(value){
  const x=n(value);return !Number.isFinite(x)?'':x>0?'goodText':x<0?'badText':'';
}
function copyText(value){
  if(!value)return;
  if(navigator.clipboard?.writeText)return navigator.clipboard.writeText(value);
  return Promise.reject(new Error('clipboard unavailable'));
}
function legVenue(leg){return String(leg?.venue||'KALSHI').toUpperCase()}
function opSource(o){return o?.kind==='CROSS_VENUE'?'CROSS-VENUE':'STRUCTURAL'}
function allOpportunities(s){
  const structural=Array.isArray(s?.scan?.arbOpportunities)?s.scan.arbOpportunities.map(x=>({...x,_source:'STRUCTURAL'})):[];
  const cross=Array.isArray(s?.scan?.crossVenue?.opportunities)?s.scan.crossVenue.opportunities.map(x=>({...x,_source:'CROSS'})):[];
  return [...cross,...structural].sort((a,b)=>
    Number(Boolean(b.qualified))-Number(Boolean(a.qualified))||
    (n(b.netEdge)||0)-(n(a.netEdge)||0)||
    (n(b.depth)||0)-(n(a.depth)||0)
  );
}
function pairCapacity(o,s){
  const cap=Math.max(1,Math.floor(n(s?.guardrails?.maxContracts)||10));
  const depth=n(o?.depth);
  return Number.isFinite(depth)?Math.max(0,Math.min(cap,Math.floor(depth))):cap;
}
function allInCost(o){
  const payout=n(o?.guaranteedMinimumPayout);
  const edge=n(o?.netEdge);
  if(Number.isFinite(payout)&&Number.isFinite(edge))return payout-edge;
  const cost=n(o?.grossCost),fees=n(o?.estimatedFees),buffer=n(o?.safetyMargin);
  return [cost,fees,buffer].every(Number.isFinite)?cost+fees+buffer:NaN;
}
function qualifiedRows(s){return allOpportunities(s).filter(x=>x?.qualified)}
function strongestNearMiss(s){return allOpportunities(s).find(x=>!x?.qualified)||null}

async function getStatus(){
  const response=await fetch(API+STATUS_PATH,{headers:{accept:'application/json'},cache:'no-store'});
  let data={};
  try{data=await response.json()}catch{}
  if(!response.ok)throw new Error(data?.error||'DreamPredict HTTP '+response.status);
  if(data?.ok!==true)throw new Error(data?.error||'DreamPredict returned ok=false');
  return data;
}

function renderHealth(s){
  const last=n(s?.lastScanAt);
  const age=Number.isFinite(last)?Date.now()-last:Infinity;
  const pill=$('healthPill');
  const healthy=s?.ok===true&&age<120000&&!s?.lastError;
  const stale=s?.ok===true&&age>=120000;
  if(pill)pill.className='healthPill '+(healthy?'good':stale?'bad':'connecting');
  setText('healthText',healthy?'LIVE':stale?'STALE':s?.lastError?'DEGRADED':'CONNECTING');
  setText('railAge',Number.isFinite(age)?ageText(age):'--');
  setText('autoState',healthy||s?.scanner?.automated?'ACTIVE':'CHECKING');
  const arch=$('architectureTag');
  if(arch){arch.textContent=s?.scanner?.automated?'AUTONOMOUS':'CHECK ENGINE';arch.className='tag '+(s?.scanner?.automated?'green':'amber')}
}

function heroLeg(leg){
  return '<div class="bestLeg">'+
    '<span>'+esc(legVenue(leg))+' · '+esc(String(leg?.side||'').toUpperCase())+'</span>'+
    '<b>'+esc(leg?.title||leg?.ticker||'Market leg')+'</b>'+
    '<small>'+esc(leg?.ticker||'')+'</small>'+
    '<strong>'+cents(leg?.ask)+'</strong>'+
  '</div>';
}
function renderHero(s){
  const rows=qualifiedRows(s);
  const best=rows[0]||null;
  const near=strongestNearMiss(s);
  const totalQualified=rows.length;
  setText('railQualified',integer(totalQualified));
  setText('orbCount',integer(totalQualified));
  const orb=$('orb');
  const kicker=$('heroKicker');

  if(best){
    if(orb)orb.className='orb locked';
    if(kicker){kicker.className='heroKicker locked';kicker.innerHTML='<i></i>ARB LOCKED'}
    setText('orbState','PROVABLE EDGE');
    setText('heroTitle','Math broke. DreamPredict caught it.');
    setText('heroCopy','A live price relationship survived contract identity, settlement, book depth, modeled fees, and safety buffer checks. It is still shadow-only until execution is deliberately armed.');
    const legs=Array.isArray(best.legs)?best.legs:[];
    const deal=$('heroDeal');
    if(deal)deal.innerHTML='<div class="bestDeal">'+
      (legs[0]?heroLeg(legs[0]):'')+'<div class="bestVs">LOCK</div>'+(legs[1]?heroLeg(legs[1]):'')+
      '</div>';
    const cap=pairCapacity(best,s);
    const locked=(n(best.netEdge)||0)*cap;
    const cost=allInCost(best);
    setText('heroCost',Number.isFinite(cost)?cents(cost):'--');
    setText('heroEdge',cents(best.netEdge));
    setText('heroDepth',Number.isFinite(n(best.depth))?integer(best.depth)+' pairs':'--');
    setText('heroLocked',money(locked));
    setText('railEdge',cents(best.netEdge));
  }else{
    if(orb)orb.className='orb hunting';
    if(kicker){kicker.className='heroKicker hunting';kicker.innerHTML='<i></i>HUNTING'}
    setText('orbState','SCANNING');
    const hasNear=Boolean(near);
    setText('heroTitle',hasNear?'Close is not good enough.':'Watching two markets disagree.');
    setText('heroCopy',hasNear?'DreamPredict sees candidate relationships, but none survive every qualification gate yet. The engine is correctly refusing to turn a near miss into fake profit.':'Cloudflare keeps DreamPredict scanning with this page closed. The console is only telemetry, so browser state has zero control over the autonomous engine.');
    const deal=$('heroDeal');
    if(deal)deal.innerHTML='<div class="heroEmpty"><b>'+(hasNear?'BEST NEAR MISS · '+esc(near.qualification||'NOT QUALIFIED'):'NO QUALIFIED ARB RIGHT NOW')+'</b><span>'+(hasNear?'Best observed edge: '+cents(near.netEdge)+' per pair. It stays watch-only until every proof gate passes.':'That is a valid result. DreamPredict is not allowed to invent edge.')+'</span></div>';
    const edge=near?.netEdge;
    setText('heroCost',near?cents(allInCost(near)):'--');
    setText('heroEdge',near?cents(edge):'--');
    setText('heroDepth',near&&Number.isFinite(n(near.depth))?integer(near.depth)+' pairs':'--');
    setText('heroLocked','$0.00');
    setText('railEdge',near?cents(edge):'--');
  }
}

function renderFunnel(s){
  const x=s?.scan?.crossVenue||{};
  setText('funnelUniverse',integer(x.scannedPolymarketMarkets||0));
  setText('funnelCandidates',integer(x.candidateMatches||0));
  setText('funnelTime',integer(x.timeVerifiedMatches||0));
  setText('funnelRules',integer(x.ruleVerifiedMatches||0));
  setText('funnelPriced',integer(x.pricedMatches||0));
  setText('funnelQualified',integer(x.qualifiedArbs||0));
  const tag=$('proofTag');
  if(tag){
    const q=n(x.qualifiedArbs)||0;
    tag.textContent=q>0?'ARB FOUND':x.enabled===false?'SCANNER OFF':'LIVE PIPELINE';
    tag.className='tag '+(q>0?'green':x.enabled===false?'amber':'');
  }
}

function legCard(leg){
  return '<div class="leg">'+
    '<span>'+esc(legVenue(leg))+' · '+esc(String(leg?.side||'').toUpperCase())+'</span>'+
    '<b title="'+esc(leg?.title||'')+'">'+esc(leg?.title||leg?.ticker||'Market leg')+'</b>'+
    '<strong>'+cents(leg?.ask)+'</strong>'+
    '<small>'+esc(leg?.ticker||'')+(Number.isFinite(n(leg?.size))?' · '+integer(leg.size)+' visible':'')+'</small>'+
  '</div>';
}
function opCard(o,s){
  const q=Boolean(o?.qualified);
  const source=opSource(o);
  const cost=allInCost(o);
  const cap=pairCapacity(o,s);
  const locked=q?(n(o.netEdge)||0)*cap:0;
  const roi=Number.isFinite(cost)&&cost>0?(n(o.netEdge)||0)/cost:NaN;
  const proof=o?.kind==='CROSS_VENUE'
    ?'match '+pct(o.matchConfidence||0)+' · '+(o.timeVerified?'time ✓':'time ?')+' · '+(o.ruleVerified?'rules ✓':'rules ?')
    :'nested '+esc(o?.strikeType||'threshold')+' · '+esc(o?.lowerStrike)+' → '+esc(o?.upperStrike);
  const legs=Array.isArray(o?.legs)?o.legs:[];
  const copy=legs.map(x=>x?.ticker).filter(Boolean).join(' | ');
  return '<article class="opCard '+(q?'qualified':'')+'">'+
    '<div class="opTop"><span class="sourceBadge">'+esc(source)+(source==='CROSS-VENUE'?' · PUBLIC DATA':'')+'</span><span class="qualBadge '+(q?'good':'watch')+'">'+esc(q?'QUALIFIED':o?.qualification||'WATCH')+'</span></div>'+
    '<h3 title="'+esc(o?.eventTitle||'')+'">'+esc(o?.eventTitle||o?.eventTicker||'Arbitrage candidate')+'</h3>'+
    '<div class="opProof">'+proof+'</div>'+
    '<div class="opMetrics">'+
      '<div><span>NET EDGE</span><b class="'+valueClass(o?.netEdge)+'">'+cents(o?.netEdge)+'</b></div>'+
      '<div><span>ALL-IN COST</span><b>'+cents(cost)+'</b></div>'+
      '<div><span>VISIBLE DEPTH</span><b>'+(Number.isFinite(n(o?.depth))?integer(o.depth):'--')+'</b></div>'+
      '<div><span>LOCKED @ CAP</span><b class="'+(q?'goodText':'')+'">'+money(locked)+'</b></div>'+
    '</div>'+
    '<div class="legPair">'+legs.slice(0,2).map(legCard).join('')+'</div>'+
    '<div class="opBottom"><span>ROI '+(Number.isFinite(roi)?pct(roi):'--')+' · fees '+cents(o?.estimatedFees)+' · buffer '+cents(o?.safetyMargin)+'</span><button class="copyBtn" type="button" data-copy="'+esc(copy)+'">COPY PAIR</button></div>'+
  '</article>';
}
function renderOpportunities(s){
  const rows=allOpportunities(s);
  const qualified=rows.filter(x=>x?.qualified);
  const near=rows.filter(x=>!x?.qualified);
  const display=[...qualified.slice(0,8),...near.slice(0,8)].slice(0,12);
  setText('opportunityCount',integer(rows.length)+' OPPORTUNIT'+(rows.length===1?'Y':'IES'));
  const grid=$('opportunityGrid');
  if(!grid)return;
  if(!display.length){
    grid.innerHTML='<div class="emptyState"><b>NO PRICED ARB CANDIDATES RIGHT NOW</b><span>The engine is still scanning. Empty is better than manufacturing edge.</span></div>';
    return;
  }
  grid.innerHTML=display.map(o=>opCard(o,s)).join('');
}

function ledgerStats(s){
  const rows=Array.isArray(s?.shadow?.recent)?s.shadow.recent:[];
  const profit=n(s?.shadow?.theoreticalLockedProfit)||0;
  const capital=rows.reduce((sum,x)=>sum+(n(x?.capital)||0),0);
  const cutoff=Date.now()-86400000;
  const recent=rows.filter(x=>(n(x?.capturedAt)||0)>=cutoff);
  const last24=recent.reduce((sum,x)=>sum+(n(x?.lockedProfit)||0),0);
  return{rows,profit,capital,roi:capital>0?profit/capital:NaN,last24};
}
function chartPath(values){
  const W=700,H=180,pad=10;
  if(!values.length)values=[0,0];
  if(values.length===1)values=[0,values[0]];
  const min=Math.min(0,...values),max=Math.max(1,...values);
  const range=Math.max(.01,max-min);
  const points=values.map((v,i)=>{
    const x=pad+(W-pad*2)*(i/(values.length-1));
    const y=H-pad-(H-pad*2)*((v-min)/range);
    return[x,y];
  });
  const line='M '+points.map(p=>p.map(x=>x.toFixed(2)).join(' ')).join(' L ');
  const area=line+' L '+points[points.length-1][0].toFixed(2)+' '+(H-pad)+' L '+points[0][0].toFixed(2)+' '+(H-pad)+' Z';
  return{line,area};
}
function captureRow(x){
  return '<div class="capture"><div><b>'+esc(x?.eventTitle||x?.eventTicker||'Qualified arb')+'</b><small>'+integer(x?.contracts||0)+' pairs · '+money(x?.capital||0)+' modeled capital · '+cents(x?.netEdge)+' / pair · '+dateTime(x?.capturedAt)+'</small></div><strong>+'+money(Math.max(0,n(x?.lockedProfit)||0))+'</strong></div>';
}
function renderLedger(s){
  const p=ledgerStats(s);
  const captures=n(s?.shadow?.captures)||0;
  setText('railProfit',money(p.profit));setText('railCaptures',integer(captures));
  setText('ledgerProfit',money(p.profit));setText('ledgerCaptureSub',integer(captures)+' capture'+(captures===1?'':'s'));
  setText('ledgerCapital',money(p.capital));setText('ledgerRoi',Number.isFinite(p.roi)?pct(p.roi):'--');
  setText('ledger24',money(p.last24));setText('chartValue',money(p.profit));
  const ordered=[...p.rows].sort((a,b)=>(n(a?.capturedAt)||0)-(n(b?.capturedAt)||0));
  let running=0;const values=[0];
  for(const row of ordered){running+=n(row?.lockedProfit)||0;values.push(running)}
  const path=chartPath(values);
  $('pnlLine')?.setAttribute('d',path.line);$('pnlArea')?.setAttribute('d',path.area);
  const feed=$('captureFeed');
  if(feed)feed.innerHTML=p.rows.length?p.rows.slice(0,8).map(captureRow).join(''):'<div class="emptyState small"><b>NO CAPTURES YET</b><span>The ledger only records qualified, book-verified arbs.</span></div>';
}

function rejectionReasons(s){
  const counts=new Map();
  for(const row of allOpportunities(s)){
    if(row?.qualified)continue;
    const reason=String(row?.qualification||'NOT QUALIFIED').trim()||'NOT QUALIFIED';
    counts.set(reason,(counts.get(reason)||0)+1);
  }
  return [...counts.entries()].sort((a,b)=>b[1]-a[1]).slice(0,7);
}
function renderIntelligence(s){
  const reasons=rejectionReasons(s);
  const max=reasons.length?Math.max(...reasons.map(x=>x[1])):1;
  const box=$('rejectionBars');
  if(box)box.innerHTML=reasons.length?reasons.map(([reason,count])=>
    '<div class="rejectRow"><span title="'+esc(reason)+'">'+esc(reason)+'</span><div class="rejectTrack"><i style="width:'+Math.max(8,(count/max)*100).toFixed(1)+'%"></i></div><b>'+count+'</b></div>'
  ).join(''):'<div class="emptyState small"><span>No priced rejection reasons in the latest scan.</span></div>';
  setText('rejectionTag',reasons.length?'FILTERING '+reasons.reduce((a,x)=>a+x[1],0):'CLEAN');

  const closest=Array.isArray(s?.scan?.crossVenue?.closestMatches)?s.scan.crossVenue.closestMatches.slice(0,6):[];
  setText('closestCount',integer(closest.length));
  const list=$('closestMatches');
  if(!list)return;
  list.innerHTML=closest.length?closest.map(x=>
    '<div class="closest"><div class="closestTop"><b title="'+esc(x?.kalshiMarketTitle||'')+'">'+esc(x?.kalshiEventTitle||x?.kalshiMarketTitle||'Kalshi market')+'</b><strong>'+pct(x?.score||0)+'</strong></div><small title="'+esc(x?.polymarketQuestion||'')+'">'+esc(x?.polymarketEventTitle||x?.polymarketQuestion||'Polymarket candidate')+'</small><div class="compat"><span class="'+(x?.numbersCompatible?'yes':'no')+'">NUMBERS '+(x?.numbersCompatible?'✓':'×')+'</span><span class="'+(x?.directionCompatible?'yes':'no')+'">DIRECTION '+(x?.directionCompatible?'✓':'×')+'</span></div></div>'
  ).join(''):'<div class="emptyState small"><span>No near-match data returned.</span></div>';
}

function renderSystem(s){
  setText('railMode',s?.focus==='ARB_FIRST'?'ARB-FIRST':String(s?.mode||'SHADOW'));
  setText('engineThrottle',integer(s?.scanner?.intervalSeconds||45)+'s');
  setText('sysVersion',s?.version||'--');setText('sysEvents',integer(s?.scan?.scannedEvents||0));
  setText('sysMarkets',integer(s?.scan?.scannedMarkets||0));setText('sysPoly',integer(s?.scan?.crossVenue?.scannedPolymarketMarkets||0));
  setText('sysMinEdge',pct(s?.guardrails?.minNetEdge));setText('sysBuffer',cents(s?.guardrails?.safetyMargin));
  setText('sysMaxPairs',integer(s?.guardrails?.maxContracts||0));setText('sysHorizon',integer(s?.guardrails?.horizonHours||0)+'h');
  setText('sysCrypto',String(s?.crypto?.mode||'PAUSED'));setText('sysReal',s?.realMoney?'ON':'OFF');
  const errors=[];
  if(s?.lastError)errors.push(String(s.lastError));
  if(Array.isArray(s?.scan?.errors))errors.push(...s.scan.errors.map(String));
  if(Array.isArray(s?.scan?.crossVenue?.errors))errors.push(...s.scan.crossVenue.errors.map(String));
  const x=s?.scan?.crossVenue||{};
  const lines=[
    'ENGINE: '+String(s?.version||'unknown')+' · '+String(s?.focus||s?.mode||'unknown'),
    'LAST SCAN: '+dateTime(s?.lastScanAt)+' · '+(Number.isFinite(n(s?.lastScanAt))?ageText(Date.now()-n(s.lastScanAt)):'unknown'),
    'STRUCTURAL: '+integer((s?.scan?.arbOpportunities||[]).length)+' candidates · '+integer(s?.scan?.qualifiedStructuralArbs||0)+' qualified',
    'CROSS-VENUE: '+integer(x.scannedPolymarketMarkets||0)+' markets · '+integer(x.candidateMatches||0)+' candidates · '+integer(x.strictMatches||0)+' strict · '+integer(x.qualifiedArbs||0)+' qualified',
    'SHADOW: '+integer(s?.shadow?.captures||0)+' captures · '+money(s?.shadow?.theoreticalLockedProfit||0)+' theoretical locked profit',
    'CRYPTO: '+String(s?.crypto?.mode||'PAUSED')+' · real money '+(s?.crypto?.realMoney?'ON':'OFF'),
    errors.length?'ERRORS: '+errors.join(' | '):'ERRORS: none'
  ];
  setText('diagText',lines.join('\n'));
}

function rewardCard(r){
  return '<article class="rewardCard"><span>'+esc(r?.qualification||'WATCH')+'</span><h3>'+esc(r?.ticker||'Kalshi program')+'</h3><p>'+esc(r?.description||'Liquidity incentive program')+'</p><div class="rewardMeta"><div><span>POOL</span><b>'+money(r?.reward||0)+'</b></div><div><span>PER DAY</span><b>'+money(r?.rewardPerDay||0)+'</b></div><div><span>TARGET SIZE</span><b>'+integer(r?.targetSize||0)+'</b></div><div><span>ENDS</span><b>'+dateTime(r?.endDate)+'</b></div></div></article>';
}
function renderRewards(s){
  const rows=Array.isArray(s?.scan?.liquidityOpportunities)?s.scan.liquidityOpportunities.slice(0,6):[];
  const grid=$('rewardGrid');if(grid)grid.innerHTML=rows.length?rows.map(rewardCard).join(''):'<div class="emptyState"><span>No active reward programs returned. They remain watch-only either way.</span></div>';
}

function render(s){
  lastPayload=s;lastFetchedAt=Date.now();
  renderHealth(s);renderHero(s);renderFunnel(s);renderOpportunities(s);renderLedger(s);renderIntelligence(s);renderSystem(s);renderRewards(s);
}

function updateHeartbeat(){
  if(!lastPayload)return;
  const scanAt=n(lastPayload?.lastScanAt);
  const age=Number.isFinite(scanAt)?Math.max(0,Date.now()-scanAt):NaN;
  const progress=Number.isFinite(age)?clamp((age%60000)/60000*100,0,100):0;
  const bar=$('heartbeatBar');if(bar)bar.style.width=progress.toFixed(1)+'%';
  const fetchAge=lastFetchedAt?Date.now()-lastFetchedAt:NaN;
  setText('heartbeatText',
    (Number.isFinite(age)?'Engine scan '+ageText(age):'Engine scan unknown')+
    (Number.isFinite(fetchAge)?' · console synced '+ageText(fetchAge):'')
  );
  setText('railAge',Number.isFinite(age)?ageText(age):'--');
}

async function refresh(){
  if(busy)return;
  busy=true;
  const btn=$('syncBtn');
  if(btn){btn.disabled=true;btn.textContent='SYNCING...'}
  try{
    const data=await getStatus();
    render(data);
  }catch(error){
    const message=error instanceof Error?error.message:String(error);
    const pill=$('healthPill');if(pill)pill.className='healthPill bad';
    setText('healthText','OFFLINE');
    setText('heartbeatText',message);
    if(!lastPayload){
      setText('heroTitle','Telemetry link interrupted.');
      setText('heroCopy','The browser could not read DreamPredict status. This does not control or stop the autonomous Cloudflare scanner.');
    }
  }finally{
    busy=false;
    if(btn){btn.disabled=false;btn.textContent='SYNC TELEMETRY'}
  }
}

document.addEventListener('click',event=>{
  const target=event.target.closest('[data-copy]');
  if(!target)return;
  const value=target.getAttribute('data-copy')||'';
  copyText(value).then(()=>{
    const old=target.textContent;target.textContent='COPIED';setTimeout(()=>target.textContent=old,1000);
  }).catch(()=>window.prompt('Copy pair:',value));
});
$('syncBtn')?.addEventListener('click',refresh);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});
refresh();
setInterval(refresh,POLL_MS);
setInterval(updateHeartbeat,1000);
