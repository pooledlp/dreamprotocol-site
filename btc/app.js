function formatWindow(m){if(!m)return'No active market';const o=new Date(m.open_time),c=new Date(m.close_time||m.expiration_time),fmt={hour:'numeric',minute:'2-digit'};return o.toLocaleTimeString([],fmt)+' -> '+c.toLocaleTimeString([],fmt)+' local'}
function marketLink(m){return m&&m.event_ticker?'https://kalshi.com/markets/kx/'+m.event_ticker.toLowerCase():'https://kalshi.com/markets/kx'}
function dirLabel(x){return !Number.isFinite(x)?'--':x>.08?'BULL':x<-.08?'BEAR':'NEUTRAL'}
function colorize(el,v){el.classList.remove('green','red','amber');el.classList.add(v>0?'green':v<0?'red':'amber')}
function timingPolicy(m,model){
  const open=Date.parse(m.open_time||0),close=model.close,total=Number.isFinite(open)&&open<close?(close-open)/60000:15;
  const elapsed=clamp(total-model.remaining,0,total);
  let phase='OBSERVE',cls='amber',threshold=.12,minProb=.64,noEntry=false,guidance='Opening noise is still being priced. Wait unless the mispricing is unusually large.';
  if(elapsed>=2&&elapsed<10.5){phase='PRIMARY ENTRY';cls='green';threshold=.08;minProb=.60;guidance='Best balance of information and remaining time. Normal edge threshold applies.'}
  else if(elapsed>=10.5&&elapsed<13.5){phase='LATE CONFIRMATION';cls='amber';threshold=.10;minProb=.67;guidance='Direction has more evidence, but there is less recovery time. Require a stronger edge.'}
  else if(elapsed>=13.5||model.remaining<=1.5){phase='NO NEW ENTRY';cls='red';threshold=.99;minProb=.99;noEntry=true;guidance='Too close to the final settlement window. Manage an existing position instead of opening a new one.'}
  return{open,close,total,elapsed,phase,cls,threshold,minProb,noEntry,guidance}
}
function currentSignalPosition(){
  if(!state.market)return null;
  return calls().find(x=>x.ticker===state.market.ticker&&!x.result)||null
}
function exitPlan(d){
  const pos=currentSignalPosition();
  if(!pos)return{action:'NO POSITION',cls:'wait',guidance:'When a BUY signal locks, this panel will continuously decide whether the paper position should hold, take profit, or exit.',bid:NaN,entry:NaN,mark:NaN,p:NaN,choice:'WAIT'};
  const heldYes=pos.side==='yes',p=heldYes?d.model.pUp:1-d.model.pUp,bid=heldYes?d.q.yesBid:d.q.noBid,entry=+pos.ask,mark=Number.isFinite(bid)?bid-entry:NaN,oppositeEdge=heldYes?d.downEdge:d.upEdge,remaining=d.model.remaining;
  let action='HOLD / REASSESS',cls='wait',guidance='The live bid is still below the model value. Keep watching for a reversal or a richer exit.';
  if(p<.48||oppositeEdge>=.08){action='EXIT NOW';cls='down';guidance='The original direction has materially weakened or the opposite side now has an edge.'}
  else if(Number.isFinite(bid)&&bid>=p+.02){action='TAKE PROFIT';cls='up';guidance='Kalshi is currently offering more on the exit bid than the model thinks the contract is worth.'}
  else if(Number.isFinite(mark)&&mark>=.15&&p<.80&&remaining>1.25){action='TAKE PROFIT';cls='up';guidance='A large mark-to-market gain is available while the remaining win probability is not dominant.'}
  else if(remaining<=1.25){
    if(p>=.90){action='HOLD TO SETTLEMENT';cls='up';guidance='Model probability is very high in the settlement window. Holding avoids paying another trading fee to exit.'}
    else if(Number.isFinite(bid)&&bid>=p-.02){action='SELL / REDUCE';cls='down';guidance='The live bid is close to model fair value, so locking the result can be preferable to final-minute variance.'}
    else{action='HOLD / TIGHT WATCH';cls='wait';guidance='The exit bid is discounted versus model value, but final-minute variance is still meaningful.'}
  }else if(remaining<=3&&p>=.82){action='HOLD TO END';cls='up';guidance='The held side remains strongly favored and the exit bid is not rich enough to justify giving up settlement value.'}
  return{action,cls,guidance,bid,entry,mark,p,choice:action.includes('SETTLEMENT')||action.includes('TO END')?'HOLD':action.includes('EXIT')||action.includes('SELL')||action.includes('PROFIT')?'SELL':'WATCH'}
}
function decide(){const model=modelForMarket(),m=state.market;if(!model||!m)return null;const q=marketQuote(m),marketUp=Number.isFinite(q.yesAsk)&&Number.isFinite(q.yesBid)?(q.yesAsk+q.yesBid)/2:Number.isFinite(q.yesAsk)?q.yesAsk:NaN,spread=Number.isFinite(q.yesAsk)&&Number.isFinite(q.yesBid)?q.yesAsk-q.yesBid:NaN,upEdge=Number.isFinite(q.yesAsk)?model.pUp-q.yesAsk:-9,downP=1-model.pUp,downEdge=Number.isFinite(q.noAsk)?downP-q.noAsk:-9,timing=timingPolicy(m,model);
  const stale=Date.now()-state.kalshiAt>12000||Date.now()-state.priceAt>12000,final=model.remaining*60<FINAL_GUARD_SECONDS,badSpread=Number.isFinite(spread)&&spread>.10;let side=null,edge=Math.max(upEdge,downEdge),reason='No executable edge above the current timing threshold.';
  if(stale)reason='Live data is stale, so the model is suppressing the trade.';
  else if(final||timing.noEntry)reason='No new entry this close to the settlement window.';
  else if(model.coverage<70)reason='Not enough independent live feeds are healthy.';
  else if(badSpread)reason='Kalshi spread is too wide for a clean entry.';
  else if(upEdge>=timing.threshold&&model.pUp>=timing.minProb){side='yes';edge=upEdge;reason='Model UP probability is '+pct(model.pUp)+' versus a live '+cents(q.yesAsk)+' ask during the '+timing.phase.toLowerCase()+' phase.'}
  else if(downEdge>=timing.threshold&&downP>=timing.minProb){side='no';edge=downEdge;reason='Model DOWN probability is '+pct(downP)+' versus a live '+cents(q.noAsk)+' ask during the '+timing.phase.toLowerCase()+' phase.'}
  return{model,q,marketUp,spread,upEdge,downEdge,side,edge,actionable:!!side,reason,stale,final,badSpread,timing}
}

function render(){const m=state.market,d=decide();if(m){$('window').textContent=formatWindow(m);$('ticker').textContent=m.ticker||SERIES;$('kalshiLink').href=marketLink(m)}if(!d)return;const model=d.model,q=d.q,delta=model.spot-model.strike,deltaPct=delta/model.strike;
  const timing=d.timing,mins=Math.floor(timing.elapsed),secs=Math.floor((timing.elapsed-mins)*60);$('elapsed').textContent=String(mins).padStart(2,'0')+':'+String(secs).padStart(2,'0');$('entryPhase').textContent=timing.phase;$('entryPhase').className='timingHero '+timing.cls;$('entryGuidance').textContent=timing.guidance;$('requiredEdge').textContent=timing.noEntry?'BLOCKED':Math.round(timing.threshold*100)+'¢';$('requiredProb').textContent=timing.noEntry?'BLOCKED':Math.round(timing.minProb*100)+'%';
  const ep=exitPlan(d);$('exitAction').textContent=ep.action;$('exitAction').className='timingHero '+(ep.cls==='up'?'green':ep.cls==='down'?'red':'amber');$('exitCard').className='card exitCard '+ep.cls;$('exitGuidance').textContent=ep.guidance;$('exitBid').textContent=cents(ep.bid);$('entryPrice').textContent=cents(ep.entry);$('markPnl').textContent=Number.isFinite(ep.mark)?(ep.mark>=0?'+':'')+(ep.mark*100).toFixed(1)+'¢':'--';colorize($('markPnl'),ep.mark);$('heldProb').textContent=pct(ep.p);$('settleChoice').textContent=ep.choice;
  $('spot').textContent=money(model.spot);$('strike').textContent=money(model.strike);$('distance').textContent=(delta>=0?'+':'')+money(delta)+' ('+(deltaPct>=0?'+':'')+(deltaPct*100).toFixed(3)+'%)';colorize($('distance'),delta);
  $('yesAsk').textContent=cents(q.yesAsk);$('yesBid').textContent=cents(q.yesBid)+' bid';$('noAsk').textContent=cents(q.noAsk);$('noBid').textContent=cents(q.noBid)+' bid';$('yesFair').textContent=pct(model.pUp);$('noFair').textContent=pct(1-model.pUp);$('yesModelFill').style.width=(model.pUp*100)+'%';$('noModelFill').style.width=((1-model.pUp)*100)+'%';
  $('modelUp').textContent=pct(model.pUp);$('marketUp').textContent=pct(d.marketUp);$('upEdge').textContent=Number.isFinite(d.upEdge)?(d.upEdge>=0?'+':'')+(d.upEdge*100).toFixed(1)+'¢':'--';$('downEdge').textContent=Number.isFinite(d.downEdge)?(d.downEdge>=0?'+':'')+(d.downEdge*100).toFixed(1)+'¢':'--';colorize($('upEdge'),d.upEdge);colorize($('downEdge'),d.downEdge);
  let sig='WAIT',cls='wait',prob=model.pUp,max='MAX ENTRY --';if(d.side==='yes'){sig='BUY UP NOW';cls='up';prob=model.pUp;max='DO NOT PAY ABOVE '+Math.floor((model.pUp-d.timing.threshold)*100)+'¢'}else if(d.side==='no'){sig='BUY DOWN NOW';cls='down';prob=1-model.pUp;max='DO NOT PAY ABOVE '+Math.floor(((1-model.pUp)-d.timing.threshold)*100)+'¢'}
  $('signal').textContent=sig;$('signal').className='hero '+(cls==='up'?'green':cls==='down'?'red':'amber');$('signalCard').className='card signalCard '+cls;$('signalText').textContent=d.reason;$('sideProb').textContent='Model '+(d.side==='no'?'DOWN':'UP')+' '+pct(prob);$('edgeText').textContent='Edge '+(d.edge>-8?(d.edge*100).toFixed(1)+'¢':'--');$('maxPrice').textContent=max;
  $('rDistance').textContent=(delta>=0?'ABOVE ':'BELOW ')+money(Math.abs(delta));colorize($('rDistance'),delta);$('rMomentum').textContent='1m '+(model.mom1*100).toFixed(2)+'% | 5m '+(model.mom5*100).toFixed(2)+'%';colorize($('rMomentum'),model.mom1*.5+model.mom5*.5);$('rFlow').textContent=dirLabel(model.flow);colorize($('rFlow'),model.flow);$('rBook').textContent=dirLabel(model.book);colorize($('rBook'),model.book);$('rVol').textContent=(model.sigma*Math.sqrt(model.remaining)*100).toFixed(2)+'% sigma';$('rSpread').textContent=Number.isFinite(d.spread)?(d.spread*100).toFixed(1)+'¢':'--';colorize($('rSpread'),Number.isFinite(d.spread)&&d.spread>.08?-1:0);
  $('coverage').textContent=model.coverage+'%';$('coverageFill').style.width=model.coverage+'%';$('hKalshi').textContent=Date.now()-state.kalshiAt<12000?'LIVE':'STALE';$('hCB').textContent=state.cbTicker?'LIVE':'OFFLINE';$('hK').textContent=state.kTicker?'LIVE':'OFFLINE';$('hMicro').textContent=(state.cbBook||state.kBook)&&(state.cbTrades||state.kTrades)?'LIVE':'PARTIAL';
  $('source').textContent='Coinbase '+(state.cbTicker?money(state.cbTicker.price):'offline')+' | Kraken '+(state.kTicker?money(state.kTicker.price):'offline')+' | Kalshi quote live';$('freshness').textContent=state.signalsAt?'UPDATED '+Math.max(0,Math.round((Date.now()-state.signalsAt)/1000))+'s AGO':'--';
  state.model=d;lockCall(d);draw()
}

function tickCountdown(){const m=state.market;if(!m)return;const close=Date.parse(m.close_time||m.expiration_time),s=Math.max(0,Math.floor((close-Date.now())/1000));$('countdown').textContent=String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0');$('countdown').classList.toggle('red',s<75);if(s<=0&&!state.rolling){state.rolling=true;setTimeout(()=>discoverMarket().then(()=>refreshAll(true)).catch(e=>log('roll '+e.message)).finally(()=>state.rolling=false),1200)}if(state.signalsAt)$('freshness').textContent='UPDATED '+Math.max(0,Math.round((Date.now()-state.signalsAt)/1000))+'s AGO'}

function draw(){const c=$('chart'),ctx=c.getContext('2d'),rows=candles.slice(-90),live=currentSpot();ctx.clearRect(0,0,c.width,c.height);if(rows.length<2)return;const ps=rows.map(x=>x.c);if(Number.isFinite(live))ps.push(live);const lo=Math.min(...ps),hi=Math.max(...ps),pad=14;ctx.strokeStyle='#213044';ctx.lineWidth=1;for(let z=1;z<4;z++){const y=c.height*z/4;ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(c.width,y);ctx.stroke()}ctx.strokeStyle=ps[ps.length-1]>=ps[0]?'#35d07f':'#ff626a';ctx.lineWidth=3;ctx.beginPath();ps.forEach((p,i)=>{const x=pad+i/(ps.length-1)*(c.width-2*pad),y=c.height-pad-(p-lo)/Math.max(1e-9,hi-lo)*(c.height-2*pad);i?ctx.lineTo(x,y):ctx.moveTo(x,y)});ctx.stroke();const move=ps[ps.length-1]/ps[0]-1;$('tapeMove').textContent=(move>=0?'+':'')+(move*100).toFixed(2)+'%';colorize($('tapeMove'),move)}

function renderHistory(){const a=calls(),done=a.filter(x=>x.result),wins=done.filter(x=>x.win).length,pnl=done.reduce((s,x)=>s+(+x.pnl||0),0);$('score').textContent=done.length?(wins+'/'+done.length+' correct | '+(wins/done.length*100).toFixed(1)+'% hit rate | first actionable call per contract'):'No settled actionable calls on this browser yet.';$('paperPnl').textContent=(pnl>=0?'+':'')+'$'+pnl.toFixed(2);colorize($('paperPnl'),pnl);$('history').innerHTML=a.slice(0,12).map(r=>'<div class="historyRow"><div><b>'+(r.side==='yes'?'UP':'DOWN')+'</b> @ '+cents(r.ask)+' <span class="small">'+new Date(r.created).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})+'</span><div class="small">'+r.ticker+' | model '+pct(r.p)+' | edge '+(r.edge*100).toFixed(1)+'¢</div></div><div class="'+(r.result?(r.win?'green':'red'):'amber')+'"><b>'+(r.result?(r.win?'WIN':'LOSS'):'OPEN')+'</b>'+(r.pnl!==null&&r.pnl!==undefined?'<div class="small">'+(r.pnl>=0?'+':'')+'$'+r.pnl.toFixed(2)+'</div>':'')+'</div></div>').join('')}

async function refreshPrices(){const jobs=[['cbTicker',cbTicker],['kTicker',kTicker]];await Promise.all(jobs.map(async([k,f])=>{try{state[k]=await f()}catch(e){log(k+' '+e.message)}}));state.priceAt=Date.now();render()}
async function refreshSignals(){const jobs=[['cbBook',cbBook],['kBook',kBook],['cbTrades',cbTradeFlow],['kTrades',kTradeFlow]];await Promise.all(jobs.map(async([k,f])=>{try{state[k]=await f()}catch(e){log(k+' '+e.message)}}));state.signalsAt=Date.now();render()}
async function refreshAll(forceDiscover=false){try{if(forceDiscover||!state.market)await discoverMarket();else await refreshMarket();await Promise.all([refreshPrices(),refreshSignals()]);setStatus('LIVE',true);render();resolveCalls().catch(()=>{})}catch(e){setStatus('DEGRADED');log('refresh '+e.message);render()}}

async function boot(){setStatus('LOADING');renderHistory();
  try{const j=await getSnapshot(true);applySnapshot(j);render();setStatus(state.market&&Number.isFinite(currentSpot())?'LIVE':'DEGRADED',!!(state.market&&Number.isFinite(currentSpot())))}catch(e){setStatus('DEGRADED');log('Startup '+e.message)}
  setInterval(tickCountdown,250);
  setInterval(()=>refreshPrices().catch(e=>log('price retry '+e.message)),2000);
  setInterval(()=>refreshMarket().then(()=>{render();if(state.market&&Number.isFinite(currentSpot()))setStatus('LIVE',true)}).catch(e=>{setStatus('DEGRADED');log('market retry '+e.message)}),3000);
  setInterval(()=>refreshSignals().catch(e=>log('signal retry '+e.message)),5000);
  setInterval(()=>loadHistory().then(render).catch(e=>log('history retry '+e.message)),60000);
  setInterval(()=>discoverMarket().then(()=>{render();if(state.market&&Number.isFinite(currentSpot()))setStatus('LIVE',true)}).catch(e=>log('discover retry '+e.message)),15000);
  setInterval(()=>resolveCalls().catch(()=>{}),30000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshAll(true).catch(()=>{})})
}
boot();