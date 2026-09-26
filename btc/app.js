function formatWindow(m){if(!m)return'No active market';const o=new Date(m.open_time),c=new Date(m.close_time||m.expiration_time),fmt={hour:'numeric',minute:'2-digit'};return o.toLocaleTimeString([],fmt)+' -> '+c.toLocaleTimeString([],fmt)+' local'}
function marketLink(m){return m&&m.event_ticker?'https://kalshi.com/markets/kx/'+m.event_ticker.toLowerCase():'https://kalshi.com/markets/kx'}
function dirLabel(x){return !Number.isFinite(x)?'--':x>.08?'BULL':x<-.08?'BEAR':'NEUTRAL'}
function colorize(el,v){el.classList.remove('green','red','amber');el.classList.add(v>0?'green':v<0?'red':'amber')}
const decisionStability={
  entry:{side:null,since:0,count:0},
  exit:{action:null,since:0,count:0}
};
function stabilizeEntry(rawSide){
  const now=Date.now(),s=decisionStability.entry;
  if(!rawSide){s.side=null;s.since=0;s.count=0;return null}
  if(s.side!==rawSide){s.side=rawSide;s.since=now;s.count=1;return null}
  s.count++;
  return (now-s.since>=6000&&s.count>=3)?rawSide:null
}
function stabilizeExit(rawAction,pos){
  const now=Date.now(),s=decisionStability.exit;
  if(!pos){s.action=null;s.since=0;s.count=0;return rawAction}
  const heldFor=now-(+pos.created||now);
  if(heldFor<45000&&rawAction!=='EXIT NOW')return 'HOLD / REASSESS';
  if(rawAction==='HOLD / REASSESS'||rawAction==='HOLD / TIGHT WATCH'||rawAction==='HOLD TO END'||rawAction==='HOLD TO SETTLEMENT'){
    s.action=null;s.since=0;s.count=0;return rawAction
  }
  if(rawAction==='EXIT NOW'&&heldFor>=15000){
    if(s.action!==rawAction){s.action=rawAction;s.since=now;s.count=1;return 'HOLD / REASSESS'}
    s.count++;
    return (now-s.since>=10000&&s.count>=3)?rawAction:'HOLD / REASSESS'
  }
  if(s.action!==rawAction){s.action=rawAction;s.since=now;s.count=1;return 'HOLD / REASSESS'}
  s.count++;
  return (now-s.since>=15000&&s.count>=3)?rawAction:'HOLD / REASSESS'
}
function timingPolicy(m,model){
  const open=Date.parse(m.open_time||0),close=model.close,total=Number.isFinite(open)&&open<close?(close-open)/60000:15;
  const elapsed=clamp(total-model.remaining,0,total);
  let phase='EARLY ENTRY',cls='amber',threshold=.07,minProb=.60,noEntry=false,guidance='Early window: directional setups can qualify, but they still need a clear pricing edge.';
  if(elapsed>=1&&elapsed<11.5){phase='ACTIVE ENTRY';cls='green';threshold=.05;minProb=.57;guidance='Main trading window: smaller persistent mispricings can qualify after confirmation.'}
  else if(elapsed>=11.5&&elapsed<14){phase='LATE ENTRY';cls='amber';threshold=.06;minProb=.60;guidance='Late window: still tradable, but require a little more confidence as settlement approaches.'}
  else if(elapsed>=14||model.remaining<=1){phase='NO NEW ENTRY';cls='red';threshold=.99;minProb=.99;noEntry=true;guidance='Final minute: no new trade. Manage an existing position or wait for the next contract.'}
  return{open,close,total,elapsed,phase,cls,threshold,minProb,noEntry,guidance}
}
function manualPositionKey(){return 'dp_manual_position_v1'}
function getManualPosition(){try{const p=JSON.parse(localStorage.getItem(manualPositionKey())||'null');return p&&state.market&&p.ticker===state.market.ticker?p:null}catch{return null}}
function setManualPosition(side){
  const d=decide(); if(!d||!state.market)return;
  const ask=side==='yes'?d.q.yesAsk:d.q.noAsk;
  const p={ticker:state.market.ticker,side,entry:Number.isFinite(ask)?ask:null,created:Date.now()};
  localStorage.setItem(manualPositionKey(),JSON.stringify(p)); render();
}
function clearManualPosition(){localStorage.removeItem(manualPositionKey());render()}
function activeTrackedPosition(){
  return getManualPosition();
}
function currentSignalPosition(){
  if(!state.market)return null;
  return calls().find(x=>x.ticker===state.market.ticker&&!x.result)||null
}
function exitPlan(d){
  const pos=activeTrackedPosition();
  if(!pos)return{action:'NO POSITION',cls:'wait',guidance:'When you place a Kalshi bet, tap I BOUGHT UP or I BOUGHT DOWN above. DreamPredict will then manage the exit.',bid:NaN,entry:NaN,mark:NaN,p:NaN,choice:'WAIT',side:null};
  const heldYes=pos.side==='yes',p=heldYes?d.model.pUp:1-d.model.pUp,bid=heldYes?d.q.yesBid:d.q.noBid,entry=Number.isFinite(+pos.ask)?+pos.ask:+pos.entry,mark=Number.isFinite(bid)&&Number.isFinite(entry)?bid-entry:NaN,oppositeEdge=heldYes?d.downEdge:d.upEdge,remaining=d.model.remaining;
  let action='HOLD / REASSESS',cls='wait',guidance='The live bid is still below the model value. Keep watching for a reversal or a richer exit.';
  if(p<.48||oppositeEdge>=.08){action='EXIT NOW';cls='down';guidance='The original direction has materially weakened or the opposite side now has an edge.'}
  else if(Number.isFinite(bid)&&bid>=p+.02){action='TAKE PROFIT';cls='up';guidance='Kalshi is currently offering more on the exit bid than the model thinks the contract is worth.'}
  else if(Number.isFinite(mark)&&mark>=.15&&p<.80&&remaining>1.25){action='TAKE PROFIT';cls='up';guidance='A large mark-to-market gain is available while the remaining win probability is not dominant.'}
  else if(remaining<=1.25){
    if(p>=.90){action='HOLD TO SETTLEMENT';cls='up';guidance='Model probability is very high in the settlement window. Holding avoids paying another trading fee to exit.'}
    else if(Number.isFinite(bid)&&bid>=p-.02){action='SELL / REDUCE';cls='down';guidance='The live bid is close to model fair value, so locking the result can be preferable to final-minute variance.'}
    else{action='HOLD / TIGHT WATCH';cls='wait';guidance='The exit bid is discounted versus model value, but final-minute variance is still meaningful.'}
  }else if(remaining<=3&&p>=.82){action='HOLD TO END';cls='up';guidance='The held side remains strongly favored and the exit bid is not rich enough to justify giving up settlement value.'}
  const stableAction=stabilizeExit(action,pos);
  if(stableAction!==action){
    action=stableAction;cls='wait';guidance='Holding while DreamPredict confirms the exit condition instead of reacting to a short-lived price/model flip.';
  }
  return{action,cls,guidance,bid,entry,mark,p,choice:action.includes('SETTLEMENT')||action.includes('TO END')?'HOLD':action.includes('EXIT')||action.includes('SELL')||action.includes('PROFIT')?'SELL':'WATCH',side:pos.side}
}
function decide(){const model=modelForMarket(),m=state.market;if(!model||!m)return null;const q=marketQuote(m),marketUp=Number.isFinite(q.yesAsk)&&Number.isFinite(q.yesBid)?(q.yesAsk+q.yesBid)/2:Number.isFinite(q.yesAsk)?q.yesAsk:NaN,spread=Number.isFinite(q.yesAsk)&&Number.isFinite(q.yesBid)?q.yesAsk-q.yesBid:NaN,upEdge=Number.isFinite(q.yesAsk)?model.pUp-q.yesAsk:-9,downP=1-model.pUp,downEdge=Number.isFinite(q.noAsk)?downP-q.noAsk:-9,timing=timingPolicy(m,model);
  const stale=Date.now()-state.kalshiAt>12000||Date.now()-state.priceAt>12000,final=model.remaining*60<FINAL_GUARD_SECONDS,badSpread=Number.isFinite(spread)&&spread>.10;let rawSide=null,leanSide=null,side=null,edge=Math.max(upEdge,downEdge),reason='No executable edge above the current timing threshold.';
  if(stale)reason='Live data is stale, so the model is suppressing the trade.';
  else if(final||timing.noEntry)reason='No new entry this close to the settlement window.';
  else if(model.coverage<60)reason='Not enough independent live feeds are healthy.';
  else if(badSpread)reason='Kalshi spread is too wide for a clean entry.';
  else{
    if(upEdge>=timing.threshold&&model.pUp>=timing.minProb){rawSide='yes';edge=upEdge;reason='UP meets the entry threshold; confirming stability before telling you to tap.'}
    else if(downEdge>=timing.threshold&&downP>=timing.minProb){rawSide='no';edge=downEdge;reason='DOWN meets the entry threshold; confirming stability before telling you to tap.'}
    if(!rawSide){
      if(upEdge>=.02&&model.pUp>=.53){leanSide='yes';edge=upEdge;reason='UP is currently the better value side, but it has not reached the TAP threshold yet.'}
      else if(downEdge>=.02&&downP>=.53){leanSide='no';edge=downEdge;reason='DOWN is currently the better value side, but it has not reached the TAP threshold yet.'}
      else if(model.pUp>=.55){leanSide='yes';edge=upEdge;reason='Model direction leans UP. Watch the price for a better entry.'}
      else if(downP>=.55){leanSide='no';edge=downEdge;reason='Model direction leans DOWN. Watch the price for a better entry.'}
    }
  }
  side=stabilizeEntry(rawSide);
  if(side==='yes')reason='Confirmed UP setup: '+pct(model.pUp)+' model probability versus '+cents(q.yesAsk)+' ask after a 6-second stability check.';
  else if(side==='no')reason='Confirmed DOWN setup: '+pct(downP)+' model probability versus '+cents(q.noAsk)+' ask after a 6-second stability check.';
  return{model,q,marketUp,spread,upEdge,downEdge,side,rawSide,leanSide,edge,actionable:!!side,reason,stale,final,badSpread,timing}
}

function render(){const m=state.market,d=decide();if(m){$('window').textContent=formatWindow(m);$('ticker').textContent=m.ticker||SERIES;$('kalshiLink').href=marketLink(m)}if(!d)return;const model=d.model,q=d.q,delta=model.spot-model.strike,deltaPct=delta/model.strike;
  const timing=d.timing,mins=Math.floor(timing.elapsed),secs=Math.floor((timing.elapsed-mins)*60);$('elapsed').textContent=String(mins).padStart(2,'0')+':'+String(secs).padStart(2,'0');$('entryPhase').textContent=timing.phase;$('entryPhase').className='timingHero '+timing.cls;$('entryGuidance').textContent=timing.guidance;$('requiredEdge').textContent=timing.noEntry?'BLOCKED':Math.round(timing.threshold*100)+'¢';$('requiredProb').textContent=timing.noEntry?'BLOCKED':Math.round(timing.minProb*100)+'%';
  const ep=exitPlan(d);$('exitAction').textContent=ep.action;$('exitAction').className='timingHero '+(ep.cls==='up'?'green':ep.cls==='down'?'red':'amber');$('exitCard').className='card exitCard '+ep.cls;$('exitGuidance').textContent=ep.guidance;$('exitBid').textContent=cents(ep.bid);$('entryPrice').textContent=cents(ep.entry);$('markPnl').textContent=Number.isFinite(ep.mark)?(ep.mark>=0?'+':'')+(ep.mark*100).toFixed(1)+'¢':'--';colorize($('markPnl'),ep.mark);$('heldProb').textContent=pct(ep.p);$('settleChoice').textContent=ep.choice;
  const tracked=activeTrackedPosition();
  let simpleAction='WAIT',simpleCls='wait',simpleText=d.reason,simpleSide='NONE',simpleMax='--¢',simpleProb='--%',simpleEdge='--¢';
  if(tracked){
    simpleAction=ep.action;
    simpleCls=ep.cls==='up'?'up':ep.cls==='down'?'down':'wait';
    simpleText=ep.guidance;
    simpleSide=tracked.side==='yes'?'UP':'DOWN';
    simpleMax=Number.isFinite(ep.bid)?cents(ep.bid):'--¢';
    simpleProb=pct(ep.p);
    simpleEdge=Number.isFinite(ep.mark)?(ep.mark>=0?'+':'')+(ep.mark*100).toFixed(1)+'¢':'--';
  }else if(d.side==='yes'){
    simpleAction='TAP UP';
    simpleCls='up';
    simpleText='Kalshi: tap UP now. Do not pay above '+Math.floor((model.pUp-d.timing.threshold)*100)+'¢.';
    simpleSide='UP';
    simpleMax=Math.floor((model.pUp-d.timing.threshold)*100)+'¢';
    simpleProb=pct(model.pUp);
    simpleEdge=(d.upEdge*100).toFixed(1)+'¢';
  }else if(d.side==='no'){
    simpleAction='TAP DOWN';
    simpleCls='down';
    simpleText='Kalshi: tap DOWN now. Do not pay above '+Math.floor(((1-model.pUp)-d.timing.threshold)*100)+'¢.';
    simpleSide='DOWN';
    simpleMax=Math.floor(((1-model.pUp)-d.timing.threshold)*100)+'¢';
    simpleProb=pct(1-model.pUp);
    simpleEdge=(d.downEdge*100).toFixed(1)+'¢';
  }else if(d.rawSide){
    simpleAction='CONFIRMING '+(d.rawSide==='yes'?'UP':'DOWN');
    simpleCls=d.rawSide==='yes'?'up':'down';
    simpleText='Entry threshold is met. Hold for the 6-second stability confirmation before tapping Kalshi.';
    simpleSide=d.rawSide==='yes'?'UP':'DOWN';
    simpleProb=pct(d.rawSide==='yes'?model.pUp:1-model.pUp);
    simpleEdge=((d.rawSide==='yes'?d.upEdge:d.downEdge)*100).toFixed(1)+'¢';
  }else if(d.leanSide){
    simpleAction='LEAN '+(d.leanSide==='yes'?'UP':'DOWN');
    simpleCls=d.leanSide==='yes'?'up':'down';
    simpleText=d.reason;
    simpleSide=d.leanSide==='yes'?'UP':'DOWN';
    simpleProb=pct(d.leanSide==='yes'?model.pUp:1-model.pUp);
    simpleEdge=((d.leanSide==='yes'?d.upEdge:d.downEdge)*100).toFixed(1)+'¢';
    simpleMax='WAIT FOR TAP';
  }else{
    simpleAction=d.timing.noEntry?'NEXT ROUND':'WATCH';simpleText='No confirmed entry right now. '+d.timing.guidance;
  }
  $('simpleAction').textContent=simpleAction;
  $('simpleAction').className='simpleHero '+(simpleCls==='up'?'green':simpleCls==='down'?'red':'amber');
  $('simpleActionCard').className='card simpleAction '+simpleCls;
  $('simpleInstruction').textContent=simpleText;
  $('simpleSide').textContent=simpleSide;
  $('simpleMax').textContent=simpleMax;
  $('simpleProb').textContent=simpleProb;
  $('simpleEdge').textContent=simpleEdge;
  $('simpleTime').textContent=$('countdown').textContent;
  if(tracked){
    const source=getManualPosition()?'MANUAL':'AUTO';
    $('trackedPosition').textContent='Tracking '+(tracked.side==='yes'?'UP':'DOWN')+' on '+tracked.ticker+' · '+source+' position · entry '+(Number.isFinite(+tracked.ask)?cents(+tracked.ask):cents(+tracked.entry));
  }else $('trackedPosition').textContent='No position tracked on this device.';

  $('spot').textContent=money(model.spot);$('strike').textContent=money(model.strike);$('distance').textContent=(delta>=0?'+':'')+money(delta)+' ('+(deltaPct>=0?'+':'')+(deltaPct*100).toFixed(3)+'%)';colorize($('distance'),delta);
  $('yesAsk').textContent=cents(q.yesAsk);$('yesBid').textContent=cents(q.yesBid)+' bid';$('noAsk').textContent=cents(q.noAsk);$('noBid').textContent=cents(q.noBid)+' bid';$('yesFair').textContent=pct(model.pUp);$('noFair').textContent=pct(1-model.pUp);$('yesModelFill').style.width=(model.pUp*100)+'%';$('noModelFill').style.width=((1-model.pUp)*100)+'%';
  $('modelUp').textContent=pct(model.pUp);$('marketUp').textContent=pct(d.marketUp);$('upEdge').textContent=Number.isFinite(d.upEdge)?(d.upEdge>=0?'+':'')+(d.upEdge*100).toFixed(1)+'¢':'--';$('downEdge').textContent=Number.isFinite(d.downEdge)?(d.downEdge>=0?'+':'')+(d.downEdge*100).toFixed(1)+'¢':'--';colorize($('upEdge'),d.upEdge);colorize($('downEdge'),d.downEdge);
  let sig='WAIT',cls='wait',prob=model.pUp,max='MAX ENTRY --';if(d.side==='yes'){sig='BUY UP NOW';cls='up';prob=model.pUp;max='DO NOT PAY ABOVE '+Math.floor((model.pUp-d.timing.threshold)*100)+'¢'}else if(d.side==='no'){sig='BUY DOWN NOW';cls='down';prob=1-model.pUp;max='DO NOT PAY ABOVE '+Math.floor(((1-model.pUp)-d.timing.threshold)*100)+'¢'}else if(d.rawSide==='yes'){sig='CONFIRMING UP';cls='up';prob=model.pUp}else if(d.rawSide==='no'){sig='CONFIRMING DOWN';cls='down';prob=1-model.pUp}else if(d.leanSide==='yes'){sig='LEAN UP';cls='up';prob=model.pUp}else if(d.leanSide==='no'){sig='LEAN DOWN';cls='down';prob=1-model.pUp}
  $('signal').textContent=sig;$('signal').className='hero '+(cls==='up'?'green':cls==='down'?'red':'amber');$('signalCard').className='card signalCard '+cls;$('signalText').textContent=d.reason;$('sideProb').textContent='Model '+(d.side==='no'?'DOWN':'UP')+' '+pct(prob);$('edgeText').textContent='Edge '+(d.edge>-8?(d.edge*100).toFixed(1)+'¢':'--');$('maxPrice').textContent=max;
  $('rDistance').textContent=(delta>=0?'ABOVE ':'BELOW ')+money(Math.abs(delta));colorize($('rDistance'),delta);$('rMomentum').textContent='1m '+(model.mom1*100).toFixed(2)+'% | 5m '+(model.mom5*100).toFixed(2)+'%';colorize($('rMomentum'),model.mom1*.5+model.mom5*.5);$('rFlow').textContent=dirLabel(model.flow);colorize($('rFlow'),model.flow);$('rBook').textContent=dirLabel(model.book);colorize($('rBook'),model.book);$('rVol').textContent=(model.sigma*Math.sqrt(model.remaining)*100).toFixed(2)+'% sigma';$('rSpread').textContent=Number.isFinite(d.spread)?(d.spread*100).toFixed(1)+'¢':'--';colorize($('rSpread'),Number.isFinite(d.spread)&&d.spread>.08?-1:0);
  $('coverage').textContent=model.coverage+'%';$('coverageFill').style.width=model.coverage+'%';$('hKalshi').textContent=Date.now()-state.kalshiAt<12000?'LIVE':'STALE';$('hCB').textContent=state.cbTicker?'LIVE':'OFFLINE';$('hK').textContent=state.kTicker?'LIVE':'OFFLINE';$('hMicro').textContent=(state.cbBook||state.kBook)&&(state.cbTrades||state.kTrades)?'LIVE':'PARTIAL';
  $('source').textContent='Coinbase '+(state.cbTicker?money(state.cbTicker.price):'offline')+' | Kraken '+(state.kTicker?money(state.kTicker.price):'offline')+' | Kalshi quote live';$('freshness').textContent=state.signalsAt?'UPDATED '+Math.max(0,Math.round((Date.now()-state.signalsAt)/1000))+'s AGO':'--';
  state.model=d;if(d.actionable)lockCall(d);draw()
}

function tickCountdown(){const m=state.market;if(!m)return;const close=Date.parse(m.close_time||m.expiration_time),s=Math.max(0,Math.floor((close-Date.now())/1000));$('countdown').textContent=String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0');if($('simpleTime'))$('simpleTime').textContent=$('countdown').textContent;$('countdown').classList.toggle('red',s<75);if(s<=0&&!state.rolling){state.rolling=true;setTimeout(()=>discoverMarket().then(()=>refreshAll(true)).catch(e=>log('roll '+e.message)).finally(()=>state.rolling=false),1200)}if(state.signalsAt)$('freshness').textContent='UPDATED '+Math.max(0,Math.round((Date.now()-state.signalsAt)/1000))+'s AGO'}

function draw(){const c=$('chart'),ctx=c.getContext('2d'),rows=candles.slice(-90),live=currentSpot();ctx.clearRect(0,0,c.width,c.height);if(rows.length<2)return;const ps=rows.map(x=>x.c);if(Number.isFinite(live))ps.push(live);const lo=Math.min(...ps),hi=Math.max(...ps),pad=14;ctx.strokeStyle='#213044';ctx.lineWidth=1;for(let z=1;z<4;z++){const y=c.height*z/4;ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(c.width,y);ctx.stroke()}ctx.strokeStyle=ps[ps.length-1]>=ps[0]?'#35d07f':'#ff626a';ctx.lineWidth=3;ctx.beginPath();ps.forEach((p,i)=>{const x=pad+i/(ps.length-1)*(c.width-2*pad),y=c.height-pad-(p-lo)/Math.max(1e-9,hi-lo)*(c.height-2*pad);i?ctx.lineTo(x,y):ctx.moveTo(x,y)});ctx.stroke();const move=ps[ps.length-1]/ps[0]-1;$('tapeMove').textContent=(move>=0?'+':'')+(move*100).toFixed(2)+'%';colorize($('tapeMove'),move)}

function renderHistory(){const a=calls(),done=a.filter(x=>x.result),wins=done.filter(x=>x.win).length,pnl=done.reduce((s,x)=>s+(+x.pnl||0),0);$('score').textContent=done.length?(wins+'/'+done.length+' correct | '+(wins/done.length*100).toFixed(1)+'% hit rate | DreamPredict paper calls only'):'Fresh scorecard: no settled DreamPredict calls yet.';$('paperPnl').textContent=(pnl>=0?'+':'')+'$'+pnl.toFixed(2);colorize($('paperPnl'),pnl);$('history').innerHTML=a.slice(0,12).map(r=>'<div class="historyRow"><div><b>'+(r.side==='yes'?'UP':'DOWN')+'</b> @ '+cents(r.ask)+' <span class="small">'+new Date(r.created).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})+'</span><div class="small">'+r.ticker+' | model '+pct(r.p)+' | edge '+(r.edge*100).toFixed(1)+'¢</div></div><div class="'+(r.result?(r.win?'green':'red'):'amber')+'"><b>'+(r.result?(r.win?'WIN':'LOSS'):'OPEN')+'</b>'+(r.pnl!==null&&r.pnl!==undefined?'<div class="small">'+(r.pnl>=0?'+':'')+'$'+r.pnl.toFixed(2)+'</div>':'')+'</div></div>').join('')}

async function refreshPrices(){const jobs=[['cbTicker',cbTicker],['kTicker',kTicker]];await Promise.all(jobs.map(async([k,f])=>{try{state[k]=await f()}catch(e){log(k+' '+e.message)}}));state.priceAt=Date.now();render()}
async function refreshSignals(){const jobs=[['cbBook',cbBook],['kBook',kBook],['cbTrades',cbTradeFlow],['kTrades',kTradeFlow]];await Promise.all(jobs.map(async([k,f])=>{try{state[k]=await f()}catch(e){log(k+' '+e.message)}}));state.signalsAt=Date.now();render()}
async function refreshAll(forceDiscover=false){try{if(forceDiscover||!state.market)await discoverMarket();else await refreshMarket();await Promise.all([refreshPrices(),refreshSignals()]);setStatus('LIVE',true);render();resolveCalls().catch(()=>{})}catch(e){setStatus('DEGRADED');log('refresh '+e.message);render()}}

async function refreshScalpShadow(){
  try{
    const j=await getJSON('https://api.dreamprotocol.ai/kalshi-bot/scalp-shadow',7000);
    const s=j.scalp||{};
    $('scalpMode').textContent=j.mode==='SHADOW_ONLY'?'SHADOW':'UNKNOWN';
    $('scalpMode').className='scalpMode amber';
    $('scalpCandidate').textContent=s.eligible?(s.side==='yes'?'UP SCALP':'DOWN SCALP'):'NO SCALP';
    $('scalpCandidate').className='scalpCandidate '+(s.eligible?'green':'amber');
    $('scalpEntry').textContent=Number.isFinite(+s.makerEntry)?Math.round(+s.makerEntry*100)+'¢':'--¢';
    $('scalpTarget').textContent=Number.isFinite(+s.targetExit)?Math.round(+s.targetExit*100)+'¢':'--¢';
    $('scalpEdge').textContent=Number.isFinite(+s.grossEdge)?(+s.grossEdge*100).toFixed(1)+'¢':'--¢';
    $('scalpSpread').textContent=Number.isFinite(+s.spread)?(+s.spread*100).toFixed(1)+'¢':'--¢';
    $('scalpMessage').textContent=s.eligible
      ? 'Paper maker candidate: '+(s.side==='yes'?'UP':'DOWN')+' near '+Math.round(+s.makerEntry*100)+'¢ with a '+Math.round(+s.targetProfit*100)+'¢ gross target. No real scalp order is being sent.'
      : 'Scanning for maker-style micro-profits. '+(s.reason||'No qualifying setup right now.');
    $('scalpCard').className='card scalpCard '+(s.eligible?'candidate':'shadow');
    $('scalpLock').textContent='SHADOW ONLY · NO SCALP ORDERS';
  }catch(e){
    $('scalpCandidate').textContent='STATUS ERROR';
    $('scalpCandidate').className='scalpCandidate red';
    $('scalpMessage').textContent='Could not read micro-scalper shadow status: '+e.message;
  }
}

async function refreshBotStatus(){
  try{
    const j=await getJSON('https://api.dreamprotocol.ai/kalshi-bot/status',7000);
    $('botMode').textContent=j.mode||'UNKNOWN';
    $('botMode').className='botMode '+(j.live?'green':'amber');
    $('botCreds').textContent=j.credentialsConfigured?'CONNECTED':'NOT CONNECTED';
    $('botCreds').className='botCreds '+(j.credentialsConfigured?'green':'amber');
    $('botRisk').textContent='$'+(j.risk?.maxRiskDollars??'--');
    $('botDaily').textContent='$'+(j.risk?.maxDailyNotionalDollars??'--');
    $('botLoss').textContent='$'+(j.risk?.maxDailyLossDollars??'--');
    $('botTrades').textContent=String(j.risk?.maxTradesPerDay??'--');
    $('botCard').className='card botCard '+(j.live?'live':'paper');
    if(j.live){
      $('botLock').textContent='LIVE EXECUTION ARMED';
      $('botLock').className='botLock live';
      $('botMessage').textContent='The bot can place and reduce Kalshi positions automatically under the displayed risk limits.';
    }else if(j.credentialsConfigured){
      $('botLock').textContent='LIVE MONEY LOCKED';
      $('botLock').className='botLock';
      $('botMessage').textContent='Kalshi credentials are connected, but the real-money arm switch remains off.';
    }else{
      $('botLock').textContent='LIVE MONEY LOCKED';
      $('botLock').className='botLock';
      $('botMessage').textContent='Paper execution is active. Add Kalshi credentials server-side before real-money mode can ever arm.';
    }
  }catch(e){
    $('botMode').textContent='STATUS ERROR';
    $('botMode').className='botMode red';
    $('botMessage').textContent='Could not read execution-bot status: '+e.message;
  }
}

async function boot(){
  setStatus('LOADING');
  renderHistory();
  refreshBotStatus().catch(()=>{});
  refreshScalpShadow().catch(()=>{});
  try{
    const j=await getSnapshot(true);
    applySnapshot(j);
    render();
    setStatus(state.market&&Number.isFinite(currentSpot())?'LIVE':'DEGRADED',!!(state.market&&Number.isFinite(currentSpot())));
  }catch(e){
    setStatus('DEGRADED');
    log('Startup '+e.message);
  }
  setInterval(tickCountdown,250);
  setInterval(()=>refreshPrices().catch(e=>log('price retry '+e.message)),2000);
  setInterval(()=>refreshMarket().then(()=>{render();if(state.market&&Number.isFinite(currentSpot()))setStatus('LIVE',true)}).catch(e=>{setStatus('DEGRADED');log('market retry '+e.message)}),3000);
  setInterval(()=>refreshSignals().catch(e=>log('signal retry '+e.message)),5000);
  setInterval(()=>loadHistory().then(render).catch(e=>log('history retry '+e.message)),60000);
  setInterval(()=>discoverMarket().then(()=>{render();if(state.market&&Number.isFinite(currentSpot()))setStatus('LIVE',true)}).catch(e=>log('discover retry '+e.message)),15000);
  setInterval(()=>resolveCalls().catch(()=>{}),30000);
  setInterval(()=>refreshBotStatus().catch(()=>{}),10000);
  setInterval(()=>refreshScalpShadow().catch(()=>{}),5000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshAll(true).catch(()=>{})});
}

$('boughtUp').addEventListener('click',()=>setManualPosition('yes'));
$('boughtDown').addEventListener('click',()=>setManualPosition('no'));
$('clearPosition').addEventListener('click',()=>clearManualPosition());

boot();
