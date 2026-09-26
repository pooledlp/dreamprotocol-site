const LIVE_API='https://api.dreamprotocol.ai/btc-live';
const SERIES='KXBTC15M';
const EDGE_THRESHOLD=.08;
const FINAL_GUARD_SECONDS=75;
const $=id=>document.getElementById(id);
let candles=[],state={market:null,kalshiAt:0,priceAt:0,signalsAt:0,cbTicker:null,kTicker:null,cbBook:null,kBook:null,cbTrades:null,kTrades:null,model:null,rolling:false};
let snapshotCache=null,snapshotAt=0,snapshotPromise=null;

const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const avg=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:0;
const money=(n,d=2)=>Number.isFinite(n)?new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:d,maximumFractionDigits:d}).format(n):'--';
const pct=n=>Number.isFinite(n)?(n*100).toFixed(1)+'%':'--%';
const cents=n=>Number.isFinite(n)?Math.round(n*100)+'¢':'--¢';

function erf(x){const s=x<0?-1:1,a=Math.abs(x),t=1/(1+.3275911*a);return s*(1-(((((1.061405429*t-1.453152027)*t+1.421413741)*t-.284496736)*t+.254829592)*t)*Math.exp(-a*a))}
const normalCDF=x=>.5*(1+erf(x/Math.SQRT2));
function log(s){const e=$('log');if(!e)return;e.textContent+='\n'+new Date().toLocaleTimeString()+' '+s;e.scrollTop=e.scrollHeight}
function setStatus(s,on=false){$('status').textContent=s;$('statusPill').className='pill'+(on?' live':'')}
async function getJSON(url,ms=7000){const ac=new AbortController(),t=setTimeout(()=>ac.abort(),ms);try{const r=await fetch(url,{cache:'no-store',signal:ac.signal,headers:{Accept:'application/json'}});if(!r.ok)throw new Error('HTTP '+r.status);return await r.json()}finally{clearTimeout(t)}}

function dollarField(m,name,legacy){const v=m&&m[name];if(v!==undefined&&v!==null&&v!=='')return +v;const c=m&&m[legacy];return Number.isFinite(+c)?+c/100:NaN}
function marketQuote(m){const yb=dollarField(m,'yes_bid_dollars','yes_bid'),ya=dollarField(m,'yes_ask_dollars','yes_ask'),nb=dollarField(m,'no_bid_dollars','no_bid'),na=dollarField(m,'no_ask_dollars','no_ask');return{yesBid:yb,yesAsk:Number.isFinite(ya)?ya:(Number.isFinite(nb)?1-nb:NaN),noBid:nb,noAsk:Number.isFinite(na)?na:(Number.isFinite(yb)?1-yb:NaN)}}
function parseStrike(m){for(const k of ['floor_strike','strike','cap_strike']){const n=+(m&&m[k]);if(Number.isFinite(n)&&n>1000)return n}const parts=[m&&m.functional_strike,m&&m.subtitle,m&&m.yes_sub_title,m&&m.title,m&&m.rules_primary].filter(Boolean);for(const s of parts){const hits=String(s).match(/\$?([0-9]{2,3}(?:,[0-9]{3})+(?:\.\d+)?|[0-9]{4,6}(?:\.\d+)?)/g)||[];for(const h of hits){const n=+h.replace(/[$,]/g,'');if(n>1000&&n<1000000)return n}}return NaN}

async function getSnapshot(force=false){
  if(!force&&snapshotCache&&Date.now()-snapshotAt<1400)return snapshotCache;
  if(snapshotPromise)return snapshotPromise;
  snapshotPromise=getJSON(LIVE_API,9000).then(j=>{
    if(!j)throw new Error('live feed unavailable');
    if(Array.isArray(j.errors)&&j.errors.length)log('Backend: '+j.errors.map(x=>x.error).join(' | '));
    snapshotCache=j;snapshotAt=Date.now();return j;
  }).finally(()=>{snapshotPromise=null});
  return snapshotPromise;
}
function applySnapshot(j){
  if(!j)return;
  const oldTicker=state.market&&state.market.ticker;
  state.market=j.market||state.market;
  state.cbTicker=j.coinbase||null;
  state.kTicker=j.kraken||null;
  state.cbBook=Number.isFinite(j.signals&&j.signals.cbBook)?{score:+j.signals.cbBook}:null;
  state.kBook=Number.isFinite(j.signals&&j.signals.kBook)?{score:+j.signals.kBook}:null;
  state.cbTrades=Number.isFinite(j.signals&&j.signals.cbFlow)?{score:+j.signals.cbFlow}:null;
  state.kTrades=Number.isFinite(j.signals&&j.signals.kFlow)?{score:+j.signals.kFlow}:null;
  if(Array.isArray(j.candles)&&j.candles.length)candles=j.candles.map(x=>({t:+x.t,l:+x.l,h:+x.h,o:+x.o,c:+x.c,v:+x.v})).sort((a,b)=>a.t-b.t);
  const now=Date.now();
  state.kalshiAt=state.market?now:state.kalshiAt;
  state.priceAt=(state.cbTicker||state.kTicker)?now:state.priceAt;
  state.signalsAt=(state.cbBook||state.kBook||state.cbTrades||state.kTrades)?now:state.signalsAt;
  if(oldTicker&&state.market&&oldTicker!==state.market.ticker){log('Rolled to '+state.market.ticker);resolveCalls().catch(()=>{})}
}
async function discoverMarket(){const j=await getSnapshot(true);applySnapshot(j);if(!state.market){log('No active '+SERIES+' market yet');return null}return state.market}
async function refreshMarket(){const j=await getSnapshot();applySnapshot(j);return state.market}
async function cbTicker(){const j=await getSnapshot();applySnapshot(j);if(!state.cbTicker)throw new Error('Coinbase offline');return state.cbTicker}
async function kTicker(){const j=await getSnapshot();applySnapshot(j);if(!state.kTicker)throw new Error('Kraken offline');return state.kTicker}
async function cbBook(){const j=await getSnapshot();applySnapshot(j);if(!state.cbBook)throw new Error('Coinbase book offline');return state.cbBook}
async function kBook(){const j=await getSnapshot();applySnapshot(j);if(!state.kBook)throw new Error('Kraken book offline');return state.kBook}
async function cbTradeFlow(){const j=await getSnapshot();applySnapshot(j);if(!state.cbTrades)throw new Error('Coinbase flow offline');return state.cbTrades}
async function kTradeFlow(){const j=await getSnapshot();applySnapshot(j);if(!state.kTrades)throw new Error('Kraken flow offline');return state.kTrades}
async function loadHistory(){const j=await getSnapshot(true);applySnapshot(j);if(candles.length<30)log('History feed partial: '+candles.length+' bars');else log('History '+candles.length+' bars');return candles}

function realizedVolPerSqrtMin(){const rows=candles.slice(-120);if(rows.length<30)return .0008;const r=[];for(let i=1;i<rows.length;i++)r.push(Math.log(rows[i].c/rows[i-1].c));const mu=avg(r),v=avg(r.map(x=>(x-mu)*(x-mu)));return clamp(Math.sqrt(v),.00012,.004)}
function currentSpot(){const xs=[state.cbTicker&&state.cbTicker.price,state.kTicker&&state.kTicker.price].filter(Number.isFinite);return xs.length?avg(xs):(candles.length?candles[candles.length-1].c:NaN)}

function modelForMarket(){const m=state.market;if(!m)return null;const strike=parseStrike(m),spot=currentSpot(),close=Date.parse(m.close_time||m.expiration_time),remaining=Math.max(.05,(close-Date.now())/60000);if(!Number.isFinite(strike)||!Number.isFinite(spot)||!Number.isFinite(close))return null;
  const sigma=realizedVolPerSqrtMin(),c1=candles[candles.length-1]&&candles[candles.length-1].c,c5=candles[candles.length-5]&&candles[candles.length-5].c,c15=candles[candles.length-15]&&candles[candles.length-15].c;
  const mom1=c1?spot/c1-1:0,mom5=c5?spot/c5-1:0,mom15=c15?spot/c15-1:0;
  const drift=clamp(mom1*.45+mom5/5*.35+mom15/15*.20,-sigma*.20,sigma*.20);
  const z=(Math.log(spot/strike)+drift*remaining)/(sigma*Math.sqrt(remaining)),pStat=clamp(normalCDF(z),.01,.99);
  const books=[state.cbBook&&state.cbBook.score,state.kBook&&state.kBook.score].filter(Number.isFinite),flows=[state.cbTrades&&state.cbTrades.score,state.kTrades&&state.kTrades.score].filter(Number.isFinite),book=avg(books),flow=avg(flows),microWeight=clamp(remaining/15,.15,1);
  let odds=Math.log(pStat/(1-pStat))+book*.40*microWeight+flow*.55*microWeight;
  let p=1/(1+Math.exp(-odds));
  const coverage=(state.market?25:0)+(state.cbTicker?15:0)+(state.kTicker?15:0)+(candles.length>100?20:0)+(books.length===2?12:books.length?6:0)+(flows.length===2?13:flows.length?6:0);
  const quality=clamp(.55+.45*coverage/100,.55,1);p=.5+(p-.5)*quality;
  return{pUp:clamp(p,.01,.99),strike,spot,remaining,sigma,mom1,mom5,mom15,book,flow,coverage,close}
}

function calls(){try{return JSON.parse(localStorage.getItem('dp_kalshi_calls_v4')||'[]')}catch{return[]}}
function saveCalls(a){localStorage.setItem('dp_kalshi_calls_v4',JSON.stringify(a.slice(0,200)))}
function lockCall(d){if(!d||!d.actionable||!state.market)return;const a=calls();if(a.some(x=>x.ticker===state.market.ticker))return;const side=d.side,ask=side==='yes'?d.q.yesAsk:d.q.noAsk,p=side==='yes'?d.model.pUp:1-d.model.pUp;a.unshift({ticker:state.market.ticker,created:Date.now(),close:d.model.close,side,ask,p,edge:d.edge,target:d.model.strike,spot:d.model.spot,result:null,pnl:null});saveCalls(a);log('LOCKED '+side.toUpperCase()+' '+state.market.ticker+' @ '+cents(ask));renderHistory()}
function marketResult(m){const r=String((m&&m.result)||(m&&m.outcome)||'').toLowerCase();if(['yes','up','1','true'].includes(r))return'yes';if(['no','down','0','false'].includes(r))return'no';const sv=+(m&&((m.settlement_value_dollars!==undefined)?m.settlement_value_dollars:m.settlement_value));if(Number.isFinite(sv))return sv>=.5?'yes':'no';return null}
async function resolveCalls(){const a=calls();let changed=false;for(const r of a){if(r.result||Date.now()<r.close+30000)continue;try{const j=await getJSON(LIVE_API+'?ticker='+encodeURIComponent(r.ticker),7000),m=j.market||j,res=marketResult(m);if(res){r.result=res;r.win=res===r.side;r.pnl=r.win?1-r.ask:-r.ask;r.settled=Date.now();changed=true}}catch(e){log('settlement '+r.ticker+' '+e.message)}}if(changed)saveCalls(a);renderHistory()}