const API='https://api.dreamprotocol.ai';
const $=id=>document.getElementById(id);
const cents=n=>Number.isFinite(+n)?(+n*100).toFixed(1)+'¢':'--';
const money=n=>Number.isFinite(+n)?new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:2,maximumFractionDigits:2}).format(+n):'--';
const pct=n=>Number.isFinite(+n)?(+n*100).toFixed(1)+'%':'--';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let strategy={minNet:.04,minProb:.70,minEntry:.60,maxEntry:.80,maxSpread:.025,minEdge:.05,makerOnly:true};
function gateSummary(r){
  if(r?.eligible)return{label:'SWEET SPOT',cls:'green',detail:'Execution candidate'};
  const reasons=[];
  if(Number.isFinite(+r?.estimatedNetTarget)&&+r.estimatedNetTarget<strategy.minNet)reasons.push('net '+cents(r.estimatedNetTarget)+' < '+cents(strategy.minNet));
  if(Number.isFinite(+r?.spread)&&+r.spread>strategy.maxSpread)reasons.push('spread '+cents(r.spread)+' > '+cents(strategy.maxSpread));
  if(Number.isFinite(+r?.grossEdge)&&+r.grossEdge<strategy.minEdge)reasons.push('edge '+cents(r.grossEdge)+' < '+cents(strategy.minEdge));
  if(Number.isFinite(+r?.makerEntry)&&(+r.makerEntry<strategy.minEntry||+r.makerEntry>strategy.maxEntry))reasons.push('entry '+cents(r.makerEntry)+' outside '+cents(strategy.minEntry)+'–'+cents(strategy.maxEntry));
  const bestP=Math.max(Number.isFinite(+r?.pUp)?+r.pUp:0,Number.isFinite(+r?.pDown)?+r.pDown:0);
  if(bestP&&bestP<strategy.minProb)reasons.push('fair '+pct(bestP)+' < '+pct(strategy.minProb));
  return{label:'BLOCKED',cls:'amber',detail:reasons.slice(0,2).join(' · ')||'fails live execution gates'};
}
async function json(path,ms=8000){const ac=new AbortController(),t=setTimeout(()=>ac.abort(),ms);try{const r=await fetch(API+path,{cache:'no-store',signal:ac.signal});if(!r.ok)throw new Error('HTTP '+r.status);return await r.json()}finally{clearTimeout(t)}}
function klass(v){return v>0?'green':v<0?'red':'amber'}
function remaining(min){if(!Number.isFinite(+min))return'--:--';const s=Math.max(0,Math.round(+min*60));return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0')}
function absoluteTime(isoOrMs){
  const t=typeof isoOrMs==='number'?isoOrMs:Date.parse(isoOrMs||'');
  if(!Number.isFinite(t))return'--';
  return new Date(t).toLocaleTimeString([],{hour:'numeric',minute:'2-digit',second:'2-digit'});
}
function ageLabel(isoOrMs){
  const t=typeof isoOrMs==='number'?isoOrMs:Date.parse(isoOrMs||'');if(!Number.isFinite(t))return'--';
  const s=Math.max(0,Math.floor((Date.now()-t)/1000));
  if(s<60)return s+'s ago';
  const m=Math.floor(s/60),ss=s%60;if(m<60)return m+'m '+ss+'s ago';
  const hh=Math.floor(m/60);if(hh<24)return hh+'h '+(m%60)+'m ago';
  return Math.floor(hh/24)+'d ago';
}
function endLabel(ms){
  if(!Number.isFinite(ms))return'--';
  return 'ends '+new Date(ms).toLocaleTimeString([],{hour:'numeric',minute:'2-digit',second:'2-digit'});
}
function tickTimers(){
  const now=Date.now();
  document.querySelectorAll('[data-end]').forEach(el=>{
    const end=+el.dataset.end;if(!Number.isFinite(end)||!end)return;
    el.textContent=remaining((end-now)/60000);
  });
  document.querySelectorAll('[data-ago]').forEach(el=>{
    const t=+el.dataset.ago;if(Number.isFinite(t)&&t)el.textContent=ageLabel(t);
  });
  const next=Math.ceil((now+1)/(15*60*1000))*(15*60*1000);
  const rc=$('rolloverCountdown'),rt=$('rolloverTime');
  if(rc)rc.textContent=remaining((next-now)/60000);
  if(rt)rt.textContent=absoluteTime(next);
}
function renderStatus(s){
  const live=!!s?.scalper?.live;
  strategy={
    minNet:Number.isFinite(+s?.scalper?.minEstimatedNetTargetCents)?+s.scalper.minEstimatedNetTargetCents/100:.04,
    minProb:Number.isFinite(+s?.scalper?.minModelProbability)?+s.scalper.minModelProbability:.70,
    minEntry:Array.isArray(s?.scalper?.entryCostBandCents)?+s.scalper.entryCostBandCents[0]/100:.60,
    maxEntry:Array.isArray(s?.scalper?.entryCostBandCents)?+s.scalper.entryCostBandCents[1]/100:.80,
    maxSpread:Number.isFinite(+s?.scalper?.maxSpreadCents)?+s.scalper.maxSpreadCents/100:.025,
    minEdge:Number.isFinite(+s?.scalper?.minGrossEdgeCents)?+s.scalper.minGrossEdgeCents/100:.05,
    makerOnly:s?.scalper?.makerOnlyEntries!==false
  };
  const gate=$('strategyGate');
  if(gate)gate.textContent=(strategy.makerOnly?'MAKER ONLY · ':'')+
    cents(strategy.minEntry)+'–'+cents(strategy.maxEntry)+' entry · ≥'+cents(strategy.minNet)+' net · ≥'+pct(strategy.minProb)+' fair · ≤'+cents(strategy.maxSpread)+' spread';
  $('mode').textContent=live?'LIVE MULTI-MARKET':'SHADOW / PAPER';
  $('mode').className='big '+(live?'green':'amber');
  $('assets').textContent=(s?.scalper?.assets||['BTC','ETH','SOL','XRP','DOGE']).join(' · ');
  $('modeText').textContent=live?'Real-money scalper is armed. Ranked market selection and global exposure guard are active.':'Execution is not live; scanner is evaluating setups only.';
  $('riskTrade').textContent=money(s?.scalper?.maxRiskDollars);
  $('riskNotional').textContent=money(s?.scalper?.maxDailyNotionalDollars);
  $('riskLoss').textContent=money(s?.scalper?.maxDailyLossDollars);
  $('riskTrades').textContent=Number.isFinite(+s?.scalper?.maxTradesPerDay)?s.scalper.maxTradesPerDay:'--';
  $('refs').textContent='Kalshi WebSocket · '+(s?.scalper?.referenceIndexes||[]).join(' · ')+' · exchange spot/history feeds';
  return live;
}
function renderScan(j){
  const rows=Array.isArray(j?.markets)?j.markets:[];
  const top=rows[0]||null,now=Date.now();
  $('scanCount').textContent=rows.length+' LIVE';
  $('scanStamp').textContent='SCAN '+absoluteTime(now);
  if(top){
    const end=Number.isFinite(+top.remainingMinutes)?now+(+top.remainingMinutes*60000):NaN;
    $('selectedAsset').textContent=top.asset||j.asset||'--';
    $('selectedTicker').textContent=top.ticker||j.ticker||'--';
    $('selectedSide').textContent=top.eligible?(top.side==='yes'?'UP / YES':'DOWN / NO'):'WAIT';
    $('selectedSide').className='side '+(top.eligible?(top.side==='yes'?'green':'red'):'amber');
    $('selectedTime').dataset.end=Number.isFinite(end)?String(end):'';
    $('selectedTime').textContent=remaining(top.remainingMinutes);
    $('selectedEndTime').textContent=Number.isFinite(end)?endLabel(end):'--';
    const gate=gateSummary(top);
    $('selectedReason').textContent=top.eligible
      ?(top.reason||'Live execution candidate.')
      :'WATCH ONLY · '+gate.detail+'. These projected cents are diagnostics, not a trade target.';
    $('entry').textContent=cents(top.makerEntry);
    $('target').textContent=cents(top.targetExit);
    $('gross').textContent=cents(top.grossEdge);
    $('net').textContent=cents(top.estimatedNetTarget);
    $('spread').textContent=cents(top.spread);
    const p=top.side==='no'?top.pDown:top.pUp;
    $('prob').textContent=(top.side==='no'?'DOWN ':'UP ')+pct(p);
  }else{
    const end=Number.isFinite(+j?.remainingMinutes)?now+(+j.remainingMinutes*60000):NaN;
    $('selectedAsset').textContent=j?.asset||'--';$('selectedTicker').textContent=j?.ticker||'SCANNING...';$('selectedSide').textContent='WAIT';
    $('selectedTime').dataset.end=Number.isFinite(end)?String(end):'';
    $('selectedTime').textContent=remaining(j?.remainingMinutes);
    $('selectedEndTime').textContent=Number.isFinite(end)?endLabel(end):'--';
  }
  $('markets').innerHTML=rows.map((r,i)=>{
    const end=Number.isFinite(+r.remainingMinutes)?now+(+r.remainingMinutes*60000):NaN;
    const gate=gateSummary(r);
    return `<div class="market ${i===0?'active ':''}${r.eligible?'eligible':''}">
      <div class="marketTop"><div class="marketAsset">${esc(r.asset)}</div><div class="badge ${gate.cls}">${gate.label}</div></div>
      <div class="marketMain ${r.eligible?(r.side==='yes'?'green':'red'):'amber'}">${r.eligible?(r.side==='yes'?'UP / YES':'DOWN / NO'):'WAIT'}</div>
      <div class="marketMeta">${r.eligible?'Expected net':'Projected net'} <b>${cents(r.estimatedNetTarget)}</b><br>Gross edge ${cents(r.grossEdge)} · spread ${cents(r.spread)}<br><span class="gateReason">${esc(gate.detail)}</span><br><b class="countdown" data-end="${Number.isFinite(end)?end:''}">${remaining(r.remainingMinutes)}</b> left · ${Number.isFinite(end)?endLabel(end):'--'}</div>
    </div>`;
  }).join('')||'<div class="muted">No supported markets returned yet.</div>';
  tickTimers();
}
function renderPnl(j){
  const t=j?.today;
  if(!j?.ok||!t){
    $('pnl').textContent='--';$('pnlNote').textContent=j?.errors?.join(' · ')||'Accounting data unavailable.';
    $('todayTrades').textContent='--';$('todayWL').textContent='--';$('todayNet').textContent='--';$('todayNet').className='amber';
    return
  }
  const n=+t.realizedNetDollars||0;$('pnl').textContent=money(n);$('pnl').className='pnl '+klass(n);
  $('pnlGross').textContent=money(t.realizedGrossDollars);
  $('pnlFees').textContent=money(t.realizedFeesDollars);
  $('pnlTrades').textContent=t.completed??'--';
  $('pnlOpen').textContent=money(t.openCostDollars);
  const completed=Number.isFinite(+t.completed)?+t.completed:0,wins=Number.isFinite(+t.wins)?+t.wins:0,losses=Math.max(0,completed-wins);
  $('todayTrades').textContent=completed;
  $('todayWL').textContent=wins+'W / '+losses+'L';
  $('todayNet').textContent=money(n);
  $('todayNet').className=klass(n);
  $('pnlNote').textContent=j.complete?'Reconciled from actual fills, settlements, and fees.':'Accounting is partial; totals are suppressed where attribution is uncertain.';
}
function renderActivity(j){
  const ps=Array.isArray(j?.positions)?j.positions:[],os=Array.isArray(j?.orders)?j.orders:[];
  $('activityTag').textContent=ps.length+' OPEN · '+os.length+' ORDERS';
  $('positions').innerHTML=ps.length?ps.map(p=>{
    const t=Date.parse(p.lastUpdated||'');
    return `<div class="activityRow activityRowTime"><b>${esc(p.ticker)}</b><span>Position ${esc(p.position)}</span><span>Exposure ${money(p.exposure)}</span><span>P&amp;L ${money((+p.realizedPnl||0)-(+p.fees||0))}</span><span class="activityTime">${Number.isFinite(t)?absoluteTime(t):'--'}<small data-ago="${Number.isFinite(t)?t:''}">${Number.isFinite(t)?ageLabel(t):'--'}</small></span></div>`;
  }).join(''):'<div class="muted">No open bot-owned position.</div>';
  $('orders').innerHTML=os.slice(0,10).map(o=>{
    const t=Date.parse(o.lastUpdateTime||o.createdTime||'');
    return `<div class="activityRow activityRowTime"><b>${esc(o.ticker)}</b><span>${esc(o.status||'--')}</span><span>${esc(o.clientOrderId?.includes('-entry-')?'ENTRY':'EXIT')}</span><span>${cents(o.yesPrice)}</span><span class="activityTime">${Number.isFinite(t)?absoluteTime(t):'--'}<small data-ago="${Number.isFinite(t)?t:''}">${Number.isFinite(t)?ageLabel(t):'--'}</small></span></div>`;
  }).join('');
  const lastExit=os.find(o=>String(o.status||'').toLowerCase()==='executed'&&String(o.clientOrderId||'').includes('-exit-'));
  const lastExecuted=lastExit||os.find(o=>String(o.status||'').toLowerCase()==='executed');
  const lastT=lastExecuted?Date.parse(lastExecuted.lastUpdateTime||lastExecuted.createdTime||''):NaN;
  $('lastTrade').innerHTML=Number.isFinite(lastT)?absoluteTime(lastT)+'<small class="timeSub" data-ago="'+lastT+'">'+ageLabel(lastT)+'</small>':'NONE TODAY';
  $('openState').textContent=ps.length?ps.length+' OPEN':'FLAT';
  $('openState').className=ps.length?'green':'amber';
  tickTimers();
}
let lastDeep=0;
async function refresh(){
  try{
    const [s,q]=await Promise.all([json('/kalshi-bot/status'),json('/kalshi-bot/scalp-shadow')]);
    const live=renderStatus(s);renderScan(q);
    $('health').className='pill '+(q?.ok?'green':'amber');$('health').querySelector('b').textContent=q?.ok?(live?'LIVE':'SCANNING'):'DEGRADED';
    if(Date.now()-lastDeep>10000){
      lastDeep=Date.now();
      const [p,a]=await Promise.allSettled([json('/kalshi-bot/pnl'),json('/kalshi-bot/activity')]);
      if(p.status==='fulfilled')renderPnl(p.value);
      if(a.status==='fulfilled')renderActivity(a.value);
    }
  }catch(e){
    $('health').className='pill red';$('health').querySelector('b').textContent='ENGINE ERROR';$('selectedReason').textContent=e.message||String(e);
  }
}
refresh();tickTimers();setInterval(refresh,3000);setInterval(tickTimers,1000);
