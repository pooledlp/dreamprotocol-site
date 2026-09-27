const API='https://api.dreamprotocol.ai';
const $=id=>document.getElementById(id);
const cents=n=>Number.isFinite(+n)?(+n*100).toFixed(1)+'¢':'--';
const money=n=>Number.isFinite(+n)?new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:2,maximumFractionDigits:2}).format(+n):'--';
const pct=n=>Number.isFinite(+n)?(+n*100).toFixed(1)+'%':'--';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function json(path,ms=8000){const ac=new AbortController(),t=setTimeout(()=>ac.abort(),ms);try{const r=await fetch(API+path,{cache:'no-store',signal:ac.signal});if(!r.ok)throw new Error('HTTP '+r.status);return await r.json()}finally{clearTimeout(t)}}
function klass(v){return v>0?'green':v<0?'red':'amber'}
function remaining(min){if(!Number.isFinite(+min))return'--:--';const s=Math.max(0,Math.round(+min*60));return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0')}
function signedMoney(n){if(!Number.isFinite(+n))return'--';const v=+n;return(v>0?'+':'')+money(v)}
function timeAgo(value){
  const at=Date.parse(value||'');if(!Number.isFinite(at))return'--';
  const sec=Math.max(0,Math.floor((Date.now()-at)/1000));
  if(sec<60)return sec+'s ago';
  const min=Math.floor(sec/60);if(min<60)return min+'m ago';
  const hr=Math.floor(min/60);if(hr<24)return hr+'h '+(min%60)+'m ago';
  const day=Math.floor(hr/24);return day+'d ago';
}
function renderStatus(s){
  const live=!!s?.scalper?.live;
  $('mode').textContent=live?'LIVE MULTI-MARKET':'SHADOW / PAPER';
  $('mode').className='big '+(live?'green':'amber');
  $('assets').textContent=(s?.scalper?.assets||['BTC','ETH','SOL','XRP','DOGE','BNB','HYPE','ZEC','NEAR','GOLD','SILVER','COPPER','WTI','NATGAS','PALLADIUM','PLATINUM']).join(' · ');
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
  if(!j?.ok||!t){$('pnl').textContent='--';$('pnlNote').textContent=j?.errors?.join(' · ')||'Accounting data unavailable.';return}
  const n=+t.realizedNetDollars||0;$('pnl').textContent=money(n);$('pnl').className='pnl '+klass(n);
  $('pnlGross').textContent=money(t.realizedGrossDollars);
  $('pnlFees').textContent=money(t.realizedFeesDollars);
  $('pnlTrades').textContent=t.completed??'--';
  $('pnlOpen').textContent=money(t.openCostDollars);
  $('pnlNote').textContent=j.complete?'Reconciled from actual fills, settlements, and fees.':'Accounting is partial; totals are suppressed where attribution is uncertain.';
}
function renderDailySummary(pnlData,activityData){
  const t=pnlData?.today;
  const orders=Array.isArray(activityData?.orders)?activityData.orders:[];
  const exits=orders.filter(o=>o?.status==='executed'&&String(o?.clientOrderId||'').includes('-exit-'));
  const last=exits.sort((a,b)=>Date.parse(b.lastUpdateTime||b.createdTime||0)-Date.parse(a.lastUpdateTime||a.createdTime||0))[0]||null;
  if(!pnlData?.ok||!t){
    $('todayTrades').textContent='--';
    $('todayRecord').textContent='--';
    $('todayNet').textContent='--';
    $('todayNet').className='amber';
    $('lastTrade').textContent=last?timeAgo(last.lastUpdateTime||last.createdTime):'--';
    $('lastTradeDetail').textContent=last?('Last completed: '+last.ticker):'No completed trade in the current activity window.';
    $('todayState').textContent='Daily accounting is temporarily unavailable.';
    return;
  }
  const completed=Number.isFinite(+t.completed)?+t.completed:0;
  const wins=Number.isFinite(+t.wins)?+t.wins:0;
  const losses=Math.max(0,completed-wins);
  const net=+t.realizedNetDollars||0;
  $('todayTrades').textContent=completed;
  $('todayRecord').textContent=wins+'W / '+losses+'L';
  $('todayNet').textContent=signedMoney(net);
  $('todayNet').className=klass(net);
  $('lastTrade').textContent=last?timeAgo(last.lastUpdateTime||last.createdTime):(completed?'Earlier today':'None yet');
  $('lastTradeDetail').textContent=last
    ?('Last completed: '+last.ticker+' · '+(String(last.clientOrderId||'').includes('-no-')?'NO':'YES')+' side · '+cents(last.noPrice??last.yesPrice))
    :(completed+' completed trade'+(completed===1?'':'s')+' recorded today.');
  $('todayState').textContent=completed
    ?('Bot has been active today · '+wins+' wins, '+losses+' losses · '+money(t.entryNotionalDollars||0)+' entry notional.')
    :'Bot is live and waiting for the first completed setup today.';
  $('todayBadge').textContent=completed?(completed+' TRADE'+(completed===1?'':'S')):'WAITING';
}
function renderActivity(j){
  const ps=Array.isArray(j?.positions)?j.positions:[],os=Array.isArray(j?.orders)?j.orders:[];
  $('activityTag').textContent=ps.length+' OPEN · '+os.length+' ORDERS';
  $('positions').innerHTML=ps.length?ps.map(p=>`<div class="activityRow"><b>${esc(p.ticker)}</b><span>Position ${esc(p.position)}</span><span>Exposure ${money(p.exposure)}</span><span>P&amp;L ${money((+p.realizedPnl||0)-(+p.fees||0))}</span></div>`).join(''):'<div class="muted">No open bot-owned position.</div>';
  $('orders').innerHTML=os.slice(0,8).map(o=>`<div class="activityRow"><b>${esc(o.ticker)}</b><span>${esc(o.status||'--')}</span><span>${esc(o.clientOrderId?.includes('-entry-')?'ENTRY':'EXIT')}</span><span>${cents(o.yesPrice)}</span></div>`).join('');
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
      renderDailySummary(p.status==='fulfilled'?p.value:null,a.status==='fulfilled'?a.value:null);
    }
  }catch(e){
    $('health').className='pill red';$('health').querySelector('b').textContent='ENGINE ERROR';$('selectedReason').textContent=e.message||String(e);
  }
}
refresh();setInterval(refresh,3000);
