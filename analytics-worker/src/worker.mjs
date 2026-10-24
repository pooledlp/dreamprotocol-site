// Dream Protocol analytics collector + Access-protected command center.
// Cloudflare Worker + D1. No IP addresses, full user agents, form values,
// customer names, or demo website URLs are stored.
const EVENTS = new Set(['page_view','cta_click','demo_started','demo_scanned','demo_scan_failed','demo_voice_started','lead_submit','lead_success','lead_error','call_click']);
const ALLOWED_ORIGINS = new Set(['https://dreamprotocol.ai','https://www.dreamprotocol.ai']);
const text = (s,max=120) => typeof s==='string' ? s.trim().slice(0,max).replace(/[\u0000-\u001f\u007f]/g,'') : '';
const isSession = s => typeof s==='string' && /^[0-9a-f-]{36}$/.test(s);
const jsonResponse = (data,status=200) => new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
function cors(origin){
  return {'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods':'POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type','Vary':'Origin','Cache-Control':'no-store'};
}
function decodeBase64Url(s){
  const raw = atob(s.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-s.length%4)%4));
  return Uint8Array.from(raw,c=>c.charCodeAt(0));
}
async function verifyAccess(request,env){
  const team = text(env.ACCESS_TEAM_DOMAIN,150).toLowerCase();
  const audience = text(env.ACCESS_AUD,250);
  const permitted = text(env.ACCESS_ALLOWED_EMAIL,240).toLowerCase();
  if(!/^[a-z0-9-]+\.cloudflareaccess\.com$/.test(team)||!audience||!permitted) return false;
  const token = request.headers.get('Cf-Access-Jwt-Assertion');
  if(!token) return false;
  const parts=token.split('.');
  if(parts.length!==3) return false;
  try {
    const header=JSON.parse(new TextDecoder().decode(decodeBase64Url(parts[0])));
    const claims=JSON.parse(new TextDecoder().decode(decodeBase64Url(parts[1])));
    if(header.alg!=='RS256'||!header.kid||claims.iss!=='https://'+team||
       !(Array.isArray(claims.aud)?claims.aud:[claims.aud]).includes(audience)||
       typeof claims.exp!=='number'||claims.exp<=Date.now()/1000||
       typeof claims.nbf==='number'&&claims.nbf>Date.now()/1000||
       text(claims.email,240).toLowerCase()!==permitted) return false;
    const keysResp=await fetch('https://'+team+'/cdn-cgi/access/certs',{cf:{cacheTtl:3600,cacheEverything:true}});
    if(!keysResp.ok) return false;
    const jwks=await keysResp.json();
    const jwk=(jwks.keys||[]).find(k=>k.kid===header.kid&&k.kty==='RSA');
    if(!jwk) return false;
    const key=await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
    const bytes=new TextEncoder().encode(parts[0]+'.'+parts[1]);
    return await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,decodeBase64Url(parts[2]),bytes);
  } catch {return false;}
}
async function collect(request,env,origin){
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors(origin)});
  if(request.method!=='POST')return new Response('Not found',{status:404});
  if(!env.DB)return new Response('Not configured',{status:503});
  if(Number(request.headers.get('content-length')||0)>2048)return new Response('Too large',{status:413});
  const userAgent=request.headers.get('user-agent')||'';
  if(/(?:bot|spider|crawler|headless|lighthouse|pagespeed)/i.test(userAgent))return new Response(null,{status:204,headers:cors(origin)});
  if(typeof request.cf?.botManagement?.score==='number'&&request.cf.botManagement.score<20)return new Response(null,{status:204,headers:cors(origin)});
  let data;
  try{
    const raw=await request.text(); if(raw.length>2048)return new Response('Too large',{status:413});
    data=JSON.parse(raw);
  }catch{return new Response('Bad request',{status:400});}
  if(!data||!EVENTS.has(data.event)||!isSession(data.session))return new Response('Invalid event',{status:400});
  const page=text(data.page,180);
  if(!page.startsWith('/')||page.includes('..')||page.includes('?')||page.includes('#'))return new Response('Invalid path',{status:400});
  const device=/mobile|android|iphone/i.test(userAgent)?'mobile':/ipad|tablet/i.test(userAgent)?'tablet':'desktop';
  const country=text(request.cf?.country,2).toUpperCase();
  try{
    await env.DB.prepare('INSERT INTO analytics_events (created_at,event,session_id,page,source,medium,campaign,referrer,label,country,device) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
      .bind(new Date().toISOString(),data.event,data.session,page,text(data.source,80),text(data.medium,80),text(data.campaign,80),text(data.referrer,120),text(data.label,70),country,device).run();
    return new Response(null,{status:204,headers:cors(origin)});
  }catch{return new Response('Unavailable',{status:503,headers:cors(origin)});}
}
async function summary(env,days){
  const from=new Date(Date.now()-days*24*60*60*1000).toISOString();
  const base=await env.DB.prepare("SELECT COUNT(CASE WHEN event='page_view' THEN 1 END) AS pageviews,COUNT(DISTINCT CASE WHEN event='page_view' THEN session_id END) AS visitors,COUNT(CASE WHEN event='cta_click' THEN 1 END) AS clicks,COUNT(CASE WHEN event='call_click' THEN 1 END) AS phone_taps,COUNT(CASE WHEN event='demo_started' THEN 1 END) AS demo_started,COUNT(CASE WHEN event='demo_scanned' THEN 1 END) AS demo_scanned,COUNT(CASE WHEN event='demo_scan_failed' THEN 1 END) AS demo_failed,COUNT(CASE WHEN event='demo_voice_started' THEN 1 END) AS voice,COUNT(CASE WHEN event='lead_submit' THEN 1 END) AS lead_submit,COUNT(CASE WHEN event='lead_success' THEN 1 END) AS lead_success,COUNT(CASE WHEN event='lead_error' THEN 1 END) AS lead_error FROM analytics_events WHERE created_at>=?").bind(from).first();
  const query=async(sql)=> (await env.DB.prepare(sql).bind(from).all()).results||[];
  const [daily,pages,sources,actions,devices,countries]=await Promise.all([
    query("SELECT substr(created_at,1,10) AS name,COUNT(CASE WHEN event='page_view' THEN 1 END) AS total,COUNT(CASE WHEN event='lead_success' THEN 1 END) AS leads FROM analytics_events WHERE created_at>=? GROUP BY substr(created_at,1,10) ORDER BY name"),
    query("SELECT page AS name,COUNT(*) AS total FROM analytics_events WHERE created_at>=? AND event='page_view' GROUP BY page ORDER BY total DESC LIMIT 12"),
    query("SELECT CASE WHEN source!='' THEN source WHEN referrer!='' THEN referrer ELSE 'Direct / unknown' END AS name,COUNT(DISTINCT session_id) AS total FROM analytics_events WHERE created_at>=? AND event='page_view' GROUP BY name ORDER BY total DESC LIMIT 12"),
    query("SELECT label AS name,COUNT(*) AS total FROM analytics_events WHERE created_at>=? AND event='cta_click' GROUP BY label ORDER BY total DESC LIMIT 10"),
    query("SELECT device AS name,COUNT(DISTINCT session_id) AS total FROM analytics_events WHERE created_at>=? AND event='page_view' GROUP BY device ORDER BY total DESC"),
    query("SELECT country AS name,COUNT(DISTINCT session_id) AS total FROM analytics_events WHERE created_at>=? AND event='page_view' GROUP BY country ORDER BY total DESC LIMIT 8")
  ]);
  return {days,updated:new Date().toISOString(),totals:base,daily,pages,sources,actions,devices,countries};
}
const DASHBOARD = [
'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Dream Protocol / Command Center</title>',
'<style>:root{color-scheme:dark;--bg:#0a100d;--panel:#141f18;--border:#344234;--fg:#e9f5e9;--muted:#a9c0ab;--accent:#cdfc83}*{box-sizing:border-box}body{margin:0;background:radial-gradient(ellipse at 70% 0,#233a26,transparent 40%),var(--bg);color:var(--fg);font:16px/1.5 system-ui,Arial,sans-serif}.shell{max-width:1240px;margin:auto;padding:35px 20px}header{display:flex;justify-content:space-between;align-items:center;gap:15px;flex-wrap:wrap;margin-bottom:30px}.brand{font-weight:800;letter-spacing:-.06em;font-size:26px}.brand span{font-weight:400;color:var(--accent)}h1{font-size:clamp(2rem,5vw,3.5rem);letter-spacing:-.055em;line-height:1.08;margin:8px 0}p{color:var(--muted)}button{background:transparent;color:var(--fg);border:1px solid #506752;border-radius:8px;padding:10px 16px;cursor:pointer;font-weight:650}button[aria-pressed=true]{background:var(--accent);border-color:var(--accent);color:#172116}.period{display:flex;gap:6px;flex-wrap:wrap}.kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:26px 0}.kpi,.panel{background:#131f17;border:1px solid var(--border);border-radius:14px;padding:20px}.kpi small{color:var(--muted);display:block}.kpi strong{font-size:clamp(1.8rem,4vw,3.1rem);letter-spacing:-.04em;display:block;margin:5px 0}.kpi span{font-size:.8rem;color:#bdd7a6}.layout{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.panel h2{font-size:1.1rem;margin:0 0 18px}.panel .empty{color:#8da090;font-style:italic}.line{display:flex;align-items:center;justify-content:space-between;gap:14px;border-bottom:1px solid #29382b;padding:9px 0;font-size:.92rem}.line:last-child{border:0}.line span{overflow-wrap:anywhere}.line b{color:var(--accent)}.bars{display:flex;align-items:end;gap:6px;min-height:160px;border-bottom:1px solid #536b55}.bar{flex:1;min-width:4px;background:linear-gradient(#dcffa1,#668b49);border-radius:3px 3px 0 0}.legend{font-size:.8rem;color:var(--muted);margin-top:10px}.fine{font-size:.8rem;color:#aec3b0;margin-top:22px}#status{min-height:24px;color:var(--muted)}@media(max-width:740px){.kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.layout{grid-template-columns:1fr}}</style></head><body><div class="shell"><header><div class="brand">dream<span>protocol</span> / CONTROL</div><div class="period"><button data-days="1">24h</button><button data-days="7" aria-pressed="true">7 days</button><button data-days="30">30 days</button></div></header>',
'<h1>Your business.<br>In real numbers.</h1><p>Traffic, engagement and inquiries across DreamProtocol.ai.</p><div id="status" role="status">Loading…</div><div class="kpis" id="kpis"></div><div class="layout"><section class="panel"><h2>Daily traffic</h2><div class="bars" id="daily"></div><div class="legend">Page views per day · UTC</div></section><section class="panel"><h2>Top pages</h2><div id="pages"></div></section><section class="panel"><h2>Traffic sources</h2><div id="sources"></div></section><section class="panel"><h2>Clicks that matter</h2><div id="actions"></div></section><section class="panel"><h2>Devices</h2><div id="devices"></div></section><section class="panel"><h2>Countries</h2><div id="countries"></div></section></div><p class="fine">Privacy-minded metrics: no IPs, form submissions, customer data or full browser histories stored. A session is an estimate, not an identified person. Cloudflare Access protects this dashboard.</p></div>',
'<script>(function(){const $=s=>document.querySelector(s);const make=(tag,cls,txt)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(txt!==undefined)n.textContent=String(txt);return n};function rows(id,data){const root=$("#"+id);root.replaceChildren();if(!data.length){root.append(make("p","empty","No events yet."));return}data.forEach(r=>{const line=make("div","line");line.append(make("span","",r.name||"Unknown"),make("b","",Number(r.total||0).toLocaleString()));root.append(line)})}function draw(s){$("#status").textContent="Updated "+new Date(s.updated).toLocaleString()+" · "+s.days+"-day window";const totals=s.totals||{};const metrics=[["Visitors",totals.visitors,"Estimated sessions"],["Page views",totals.pageviews,"Total pages opened"],["Demo scans",totals.demo_scanned,"Completed scans"],["Demo voice starts",totals.voice,"Voice demo interactions"],["Form attempts",totals.lead_submit,"Submission attempts"],["Delivered leads",totals.lead_success,"Accepted by form provider"],["Lead errors",totals.lead_error,"Failed submissions"],["CTA clicks",totals.clicks,"Offer and action clicks"],["Phone demo taps",totals.phone_taps,"Click-to-call taps, not confirmed calls"]];const k=$("#kpis");k.replaceChildren();metrics.forEach(m=>{const card=make("div","kpi");card.append(make("small","",m[0]),make("strong","",Number(m[1]||0).toLocaleString()),make("span","",m[2]));k.append(card)});const daily=$("#daily");daily.replaceChildren();const max=Math.max(1,...s.daily.map(v=>Number(v.total)||0));if(!s.daily.length)daily.append(make("p","empty","No traffic yet."));s.daily.forEach(item=>{const bar=make("div","bar");bar.style.height=Math.max(3,Math.round(Number(item.total||0)/max*150))+"px";bar.title=item.name+": "+item.total+" page views";daily.append(bar)});["pages","sources","actions","devices","countries"].forEach(k=>rows(k,s[k]||[]))}async function load(days){$("#status").textContent="Loading metrics…";try{const res=await fetch("/api/summary?days="+days,{credentials:"same-origin",cache:"no-store"});if(!res.ok)throw Error("Dashboard access or database unavailable ("+res.status+")");draw(await res.json())}catch(e){$("#status").textContent=e.message}}document.querySelectorAll("[data-days]").forEach(b=>b.addEventListener("click",()=>{document.querySelectorAll("[data-days]").forEach(x=>x.setAttribute("aria-pressed",String(x===b)));load(Number(b.dataset.days))}));load(7)})()</script></body></html>'
].join('');
export default {
  async scheduled(event,env){
    // Cloudflare Cron: limit retained analytics to the last 90 days.
    if(!env.DB)return;
    const cutoff = new Date(Date.now()-90*86400000).toISOString();
    await env.DB.prepare('DELETE FROM analytics_events WHERE created_at < ?').bind(cutoff).run();
  },
  async fetch(request,env){
    const url=new URL(request.url);
    const metricsHost=(env.INGEST_HOSTNAME||'metrics.dreamprotocol.ai').toLowerCase();
    const commandHost=(env.DASHBOARD_HOSTNAME||'command.dreamprotocol.ai').toLowerCase();
    if(url.hostname===metricsHost){
      const origin=request.headers.get('Origin')||'';
      if(!ALLOWED_ORIGINS.has(origin))return new Response('Forbidden',{status:403});
      if(url.pathname!=='/collect')return new Response('Not found',{status:404});
      return collect(request,env,origin);
    }
    if(url.hostname===commandHost){
      if(!await verifyAccess(request,env))return new Response('Access denied',{status:403,headers:{'Cache-Control':'no-store'}});
      if(request.method!=='GET')return new Response('Method not allowed',{status:405});
      if(url.pathname==='/'||url.pathname==='/dashboard')return new Response(DASHBOARD,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Robots-Tag':'noindex,nofollow','X-Frame-Options':'DENY','Content-Security-Policy':"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'"}});
      if(url.pathname==='/api/summary'){
        if(!env.DB)return jsonResponse({error:'D1 not configured'},503);
        const days=[1,7,30].includes(Number(url.searchParams.get('days')))?Number(url.searchParams.get('days')):7;
        try{return jsonResponse(await summary(env,days));}catch{return jsonResponse({error:'Metrics database unavailable'},503);}
      }
      return new Response('Not found',{status:404});
    }
    return new Response('Not found',{status:404});
  }
};