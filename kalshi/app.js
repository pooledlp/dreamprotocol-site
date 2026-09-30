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
  if(qualified.length)return{row:qualified[0],qualified:true};
  const opps=Array.isArray(scan.opportunities)?scan.opportunities:[];
  const tradeable=opps.find(o=>Number.isFinite(+o.marketPrice)&&+o.marketPrice>=.04&&+o.marketPrice<=.96);
  return{row:tradeable||opps[0]||null,qualified:false};
}

function renderHero(s){
  const pick=selectedOpportunity(s),o=pick.row;
  const qualified=pick.qualified&&!!o?.qualified;
  const status=$('heroStatus');
  if(status){
    status.textContent=qualified?'PAPER PICK READY':'HUNTING';
    status.className='heroStatus '+(qualified?'found':'hunting');
  }
  if(!o){
    setText('heroTitle','Scanning the future...');
    setText('heroSubtitle','No researchable prediction-market opportunity is loaded yet.');
    setText('heroResearch','Weather research is gathering fresh forecast data.');
    ['heroModel','heroMarket','heroEdge','heroConfidence','heroSide','heroContracts','heroProfit','orbProb'].forEach(id=>setText(id,'--'));
    setText('heroStake',money(s?.paperStakeDollars||10));
    setText('orbLabel','SCANNING');
    const orb=$('probOrb');if(orb)orb.style.setProperty('--prob','0');
    return;
  }

  setText('heroTitle',o.title||((o.city||'Weather')+' prediction'));
  setText('heroSubtitle',(o.city?o.city+' · ':'')+(o.subtitle||o.ticker||'')+(qualified?' · QUALIFIED PAPER EDGE':' · watching for a better price/edge'));
  setText('heroResearch',o?.research?.rationale||'Independent research loaded.');
  setText('heroModel',pct(o.modelProbability));
  setText('heroMarket',pct(o.marketProbability));
  setText('heroEdge',edgePct(o.edge));
  setText('heroConfidence',pct(o.confidence));
  setText('heroSide',qualified?String(o.side||'').toUpperCase():'WAIT');
  setText('heroStake',qualified?money(o.paperStake||s?.paperStakeDollars||10):money(s?.paperStakeDollars||10));
  setText('heroContracts',qualified?String(o.contracts||'--'):'--');
  setText('heroProfit',qualified?money(o.profitIfWin):'--');
  setText('orbProb',pct(o.modelProbability));
  setText('orbLabel',qualified?String(o.side||'').toUpperCase()+' EDGE':'WATCH');
  const orb=$('probOrb');if(orb)orb.style.setProperty('--prob',String(Math.max(0,Math.min(100,Math.round((+o.modelProbability||0)*100)))));
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
  '</article>';
}

function renderOpportunities(s){
  const scan=s?.scan||{},all=Array.isArray(scan.opportunities)?scan.opportunities:[];
  const qualified=Array.isArray(scan.qualified)?scan.qualified:[];
  const qids=new Set(qualified.map(x=>x.id||x.ticker));
  const rows=[...qualified,...all.filter(x=>!qids.has(x.id||x.ticker))].slice(0,12);
  const el=$('opportunities');
  if(el)el.innerHTML=rows.length?rows.map(opportunityCard).join(''):'<div class="empty">No research opportunities are available right now.</div>';
  setText('scanCount',String(all.length));
  setText('qualifiedCount',String(qualified.length));
}

function renderPositions(s){
  const rows=Array.isArray(s?.positions)?s.positions:[];
  setText('openCount',rows.length+' OPEN');
  const el=$('positions');
  if(!el)return;
  el.innerHTML=rows.length?rows.map(p=>
    '<div class="position">'+
      '<div class="rowTop"><b>'+esc(p.city||p.category||'Prediction')+' · '+esc(String(p.side||'').toUpperCase())+'</b><span>'+money(p.stake)+' paper</span></div>'+
      '<div class="rowMeta"><span>'+esc(p.subtitle||p.title||p.ticker)+'</span><span>model '+pct(p.modelProbability)+'</span><span>market '+pct(p.marketProbability)+'</span><span>edge '+edgePct(p.edge)+'</span><span>'+esc(p.contracts)+' contracts</span><span data-countdown="'+esc(p.closeTime||'')+'">TIME LEFT '+timeLeft(p.closeTime)+'</span><span>closes '+dateTime(p.closeTime)+'</span></div>'+
    '</div>'
  ).join(''):'<div class="empty">No open paper predictions yet.</div>';
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
    '</div>'
  ).join(''):'<div class="empty">No settled predictions yet.</div>';
}

function renderCategories(s){
  const rows=Array.isArray(s?.scan?.categories)?s.scan.categories:[];
  const el=$('categories');if(!el)return;
  el.innerHTML=rows.length?rows.map(c=>{
    const state=String(c.status||'').toLowerCase();
    return '<div class="category"><div class="categoryTop"><b>'+esc(c.name)+'</b><span class="categoryState '+esc(state)+'">'+esc(c.status)+'</span></div><p>'+esc(c.detail||'')+'</p></div>';
  }).join(''):'<div class="empty">Research universe is loading.</div>';
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

$('refreshBtn')?.addEventListener('click',()=>refresh(true));
refresh(false);
setInterval(()=>refresh(false),25000);
setInterval(updateCountdowns,1000);
