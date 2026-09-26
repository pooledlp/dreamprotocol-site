const KALSHI_BASE='https://external-api.kalshi.com/trade-api/v2';
const SERIES='KXBTC15M';
const EDGE_THRESHOLD=.08;
const FINAL_GUARD_SECONDS=75;
const $=id=>document.getElementById(id);
let candles=[],state={market:null,kalshiAt:0,priceAt:0,signalsAt:0,cbTicker:null,kTicker:null,cbBook:null,kBook:null,cbTrades:null,kTrades:null,model:null,rolling:false};

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
function chooseActive(markets){const now=Date.now();return (markets||[]).filter(m=>Date.parse(m.close_time||m.expiration_time||0)>now-3000&&(m.status==='open'||!m.status)).sort((a,b)=>Date.parse(a.close_time||a.expiration_time)-Date.parse(b.close_time||b.expiration_time))[0]||null}

async function discoverMarket(){const j=await getJSON(KALSHI_BASE+'/markets?series_ticker='+SERIES+'&status=open&limit=100',9000);const m=chooseActive(j.markets||[]);if(!m)throw new Error('No open '+SERIES+' market');const changed=state.market&&state.market.ticker!==m.ticker;state.market=m;state.kalshiAt=Date.now();if(changed){log('Rolled to '+m.ticker);await resolveCalls();}return m}
async function refreshMarket(){if(!state.market)return discoverMarket();try{const j=await getJSON(KALSHI_BASE+'/markets/'+encodeURIComponent(state.market.ticker),6500);if(j.market)state.market=j.market;state.kalshiAt=Date.now();return state.market}catch(e){log('Kalshi refresh '+e.message);return state.market}}

async function cbTicker(){const j=await getJSON('https://api.exchange.coinbase.com/products/BTC-USD/ticker',6000);return{price:+j.price,bid:+j.bid,ask:+j.ask,at:Date.now()}}
async function kTicker(){const j=await getJSON('https://api.kraken.com/0/public/Ticker?pair=XBTUSD',6000);if(j.error&&j.error.length)throw new Error(j.error.join(','));const k=Object.keys(j.result||{})[0],x=j.result&&j.result[k];return{price:+x.c[0],bid:+x.b[0],ask:+x.a[0],at:Date.now()}}
async function cbBook(){const j=await getJSON('https://api.exchange.coinbase.com/products/BTC-USD/book?level=2',6500),b=j.bids||[],a=j.asks||[];if(!b.length||!a.length)throw new Error('empty CB book');const mid=(+b[0][0]+ +a[0][0])/2,band=.0018;let bn=0,an=0;b.forEach(x=>{const p=+x[0],s=+x[1];if((mid-p)/mid<=band)bn+=p*s});a.forEach(x=>{const p=+x[0],s=+x[1];if((p-mid)/mid<=band)an+=p*s});return{score:(bn-an)/Math.max(1,bn+an),at:Date.now()}}
async function kBook(){const j=await getJSON('https://api.kraken.com/0/public/Depth?pair=XBTUSD&count=100',6500);if(j.error&&j.error.length)throw new Error(j.error.join(','));const k=Object.keys(j.result||{})[0],x=j.result&&j.result[k],b=x.bids||[],a=x.asks||[];if(!b.length||!a.length)throw new Error('empty K book');const mid=(+b[0][0]+ +a[0][0])/2,band=.0018;let bn=0,an=0;b.forEach(y=>{const p=+y[0],s=+y[1];if((mid-p)/mid<=band)bn+=p*s});a.forEach(y=>{const p=+y[0],s=+y[1];if((p-mid)/mid<=band)an+=p*s});return{score:(bn-an)/Math.max(1,bn+an),at:Date.now()}}
async function cbTradeFlow(){const rows=await getJSON('https://api.exchange.coinbase.com/products/BTC-USD/trades',6500);let buy=0,sell=0;(rows||[]).slice(0,120).forEach(x=>{const n=(+x.price)*(+x.size);if(x.side==='sell')buy+=n;else if(x.side==='buy')sell+=n});return{score:(buy-sell)/Math.max(1,buy+sell),at:Date.now()}}
async function kTradeFlow(){const j=await getJSON('https://api.kraken.com/0/public/Trades?pair=XBTUSD',6500);if(j.error&&j.error.length)throw new Error(j.error.join(','));const k=Object.keys(j.result||{}).find(x=>x!=='last'),rows=j.result&&j.result[k]||[];let buy=0,sell=0;rows.slice(-300).forEach(x=>{const n=(+x[0])*(+x[1]);if(x[3]==='b')buy+=n;else if(x[3]==='s')sell+=n});return{score:(buy-sell)/Math.max(1,buy+sell),at:Date.now()}}

async function loadHistory(){const end=Math.floor(Date.now()/1000),start=end-5*3600,u='https://api.exchange.coinbase.com/products/BTC-USD/candles?granularity=60&start='+new Date(start*1000).toISOString()+'&end='+new Date(end*1000).toISOString(),rows=await getJSON(u,9000);candles=(rows||[]).map(x=>({t:+x[0],l:+x[1],h:+x[2],o:+x[3],c:+x[4],v:+x[5]})).sort((a,b)=>a.t-b.t);if(candles.length<100)throw new Error('Only '+candles.length+' 1m bars');log('History '+candles.length+' bars')}
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

function calls(){try{return JSON.parse(localStorage.getItem('dp_kalshi_calls_v3')||'[]')}catch{return[]}}
function saveCalls(a){localStorage.setItem('dp_kalshi_calls_v3',JSON.stringify(a.slice(0,200)))}
function lockCall(d){if(!d||!d.actionable||!state.market)return;const a=calls();if(a.some(x=>x.ticker===state.market.ticker))return;const side=d.side,ask=side==='yes'?d.q.yesAsk:d.q.noAsk,p=side==='yes'?d.model.pUp:1-d.model.pUp;a.unshift({ticker:state.market.ticker,created:Date.now(),close:d.model.close,side,ask,p,edge:d.edge,target:d.model.strike,spot:d.model.spot,result:null,pnl:null});saveCalls(a);log('LOCKED '+side.toUpperCase()+' '+state.market.ticker+' @ '+cents(ask));renderHistory()}
function marketResult(m){const r=String((m&&m.result)||(m&&m.outcome)||'').toLowerCase();if(['yes','up','1','true'].includes(r))return'yes';if(['no','down','0','false'].includes(r))return'no';const sv=+(m&&((m.settlement_value_dollars!==undefined)?m.settlement_value_dollars:m.settlement_value));if(Number.isFinite(sv))return sv>=.5?'yes':'no';return null}
async function resolveCalls(){const a=calls();let changed=false;for(const r of a){if(r.result||Date.now()<r.close+30000)continue;try{const j=await getJSON(KALSHI_BASE+'/markets/'+encodeURIComponent(r.ticker),6500),m=j.market||j,res=marketResult(m);if(res){r.result=res;r.win=res===r.side;r.pnl=r.win?1-r.ask:-r.ask;r.settled=Date.now();changed=true}}catch(e){}}if(changed)saveCalls(a);renderHistory()}