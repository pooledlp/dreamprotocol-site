const API='https://api.dreamprotocol.ai';
const $=id=>document.getElementById(id);
const cents=n=>Number.isFinite(+n)?(+n*100).toFixed(1)+'¢':'--';
const money=n=>Number.isFinite(+n)?new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:2,maximumFractionDigits:2}).format(+n):'--';
const pct=n=>Number.isFinite(+n)?(+n*100).toFixed(1)+'%':'--';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function json(path,ms=8000){const ac=new AbortController(),t=setTimeout(()=>ac.abort(),ms);try{const r=await fetch(API+path,{cache:'no-store',signal:ac.signal});if(!r.ok)throw new Error('HTTP '+r.status);return await r.json()}finally{clearTimeout(t)}}
function klass(v){return v>0?'green':v<0?'red':'amber'}
function remaining(min){if(!Number.isFinite(+min))return'--:--';const s=Math.max(0,Math.round(+min*60));return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0')}
function ageLabel(iso){
  const t=Date.parse(iso||'');if(!Number.isFinite(t))return'--';
  const s=Math.max(0,Math.floor((Date.now()-t)/1000));
  if(s<60)return s+'s ago';
  const m=Math.floor(s/60);if(m<60)return m+'m ago';
  const h=Math.floor(m/60);if(h<24)return h+'h '+(m%60)+'m ago';
  return Math.floor(h/24)+'d ago';
}
function renderStatus(s){
  const live=!!s?.scalper?.live;
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
  const top=rows[0]||null;
  $('scanCount').textContent=rows.length+' LIVE';
  if(top){
    $('selectedAsset').textContent=top.asset||j.asset||'--';
    $('selectedTicker').textContent=top.ticker||j.ticker||'--';
    $('selectedSide').textContent=top.eligible?(top.side==='yes'?'UP / YES':'DOWN / NO'):'WAIT';
    $('selectedSide').className='side '+(top.eligible?(top.side==='yes'?'green':'red'):'amber');
    $('selectedTime').textContent=remaining(top.remainingMinutes);
    $('selectedReason').textContent=top.reason||'No qualifying setup yet.';
    $('entry').textContent=cents(top.makerEntry);
    $('target').textContent=cents(top.targetExit);
    $('gross').textContent=cents(top.grossEdge);
    $('net').textContent=cents(top.estimatedNetTarget);
    $('spread').textContent=cents(top.spread);
    const p=top.side==='no'?top.pDown:top.pUp;
    $('prob').textContent=(top.side==='no'?'DOWN ':'UP ')+pct(p);
  }else{
    $('selectedAsset').textContent=j?.asset||'--';$('selectedTicker').textContent=j?.ticker||'SCANNING...';$('selectedSide').textContent='WAIT';$('selectedTime').textContent=remaining(j?.remainingMinutes);
  }
  $('markets').innerHTML=rows.map((r,i)=>`
    <div class="market ${i===0?'active ':''}${r.eligible?'eligible':''}">
      <div class="marketTop"><div class="marketAsset">${esc(r.asset)}</div><div class="badge">${r.eligible?'ELIGIBLE':'WATCH'}</div></div>
      <div class="marketMain ${r.eligible?(r.side==='yes'?'green':'red'):'amber'}">${r.eligible?(r.side==='yes'?'UP / YES':'DOWN / NO'):'WAIT'}</div>
      <div class="marketMeta">Net target <b>${cents(r.estimatedNetTarget)}</b><br>Gross edge ${cents(r.grossEdge)} · spread ${cents(r.spread)}<br>${remaining(r.remainingMinutes)} left</div>
    </div>`).join('')||'<div class="muted">No supported markets returned yet.</div>';
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
  $('positions').innerHTML=ps.length?ps.map(p=>`<div class="activityRow"><b>${esc(p.ticker)}</b><span>Position ${esc(p.position)}</span><span>Exposure ${money(p.exposure)}</span><span>P&amp;L ${money((+p.realizedPnl||0)-(+p.fees||0))}</span></div>`).join(''):'<div class="muted">No open bot-owned position.</div>';
  $('orders').innerHTML=os.slice(0,8).map(o=>`<div class="activityRow"><b>${esc(o.ticker)}</b><span>${esc(o.status||'--')}</span><span>${esc(o.clientOrderId?.includes('-entry-')?'ENTRY':'EXIT')}</span><span>${cents(o.yesPrice)}</span></div>`).join('');
  const lastExit=os.find(o=>String(o.status||'').toLowerCase()==='executed'&&String(o.clientOrderId||'').includes('-exit-'));
  const lastExecuted=lastExit||os.find(o=>String(o.status||'').toLowerCase()==='executed');
  $('lastTrade').textContent=lastExecuted?ageLabel(lastExecuted.lastUpdateTime||lastExecuted.createdTime):'NONE TODAY';
  $('openState').textContent=ps.length?ps.length+' OPEN':'FLAT';
  $('openState').className=ps.length?'green':'amber';
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
refresh();setInterval(refresh,3000);
