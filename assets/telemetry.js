(() => {
  'use strict';
  // Minimal privacy-aware first-party funnel analytics. No form contents,
  // visitor IPs, email addresses, scanned URLs, or recorded audio are sent.
  if (navigator.doNotTrack === '1' || navigator.globalPrivacyControl === true) return;
  const endpoint = 'https://metrics.dreamprotocol.ai/collect';
  const events = new Set(['page_view','cta_click','demo_started','demo_scanned','demo_scan_failed','demo_voice_started','lead_submit','lead_success','lead_error']);
  const normalize = (v, max=80) => String(v || '').slice(0,max).replace(/[\r\n\t]/g,' ').trim();
  const getSession = () => {
    try {
      let id = sessionStorage.getItem('dp_visitor_session');
      if (!id || !/^[a-f0-9-]{36}$/.test(id)) {
        id = crypto.randomUUID();
        sessionStorage.setItem('dp_visitor_session',id);
      }
      return id;
    } catch { return crypto.randomUUID(); }
  };
  const session = getSession();
  const params = new URLSearchParams(location.search);
  let campaign = {};
  try {
    const saved = sessionStorage.getItem('dp_utm');
    campaign = saved ? JSON.parse(saved) : {};
    if (params.get('utm_source') || params.get('utm_campaign')) {
      campaign = {utm_source:normalize(params.get('utm_source')),utm_medium:normalize(params.get('utm_medium')),utm_campaign:normalize(params.get('utm_campaign'))};
      sessionStorage.setItem('dp_utm',JSON.stringify(campaign));
    }
  } catch {}
  let referrer = '';
  try { const url = new URL(document.referrer); if(url.hostname !== location.hostname && url.hostname !== 'www.'+location.hostname) referrer=url.hostname.slice(0,120); } catch {}
  let lastClick = 0;
  const track = (event, extra={}) => {
    if(!events.has(event)) return;
    // Page paths only. Never report document query strings or input contents.
    const payload = JSON.stringify({
      event, session, page: location.pathname.slice(0,180), 
      source: campaign.utm_source || '', medium:campaign.utm_medium || '',
      campaign:campaign.utm_campaign || '', referrer,
      label:normalize(extra.label || '',70)
    });
    try {
      // sendBeacon is resilient when a visitor navigates after submitting or clicking.
      if(navigator.sendBeacon?.(endpoint,new Blob([payload],{type:'text/plain'}))) return;
      fetch(endpoint,{method:'POST',mode:'cors',keepalive:true,headers:{'Content-Type':'text/plain'},body:payload}).catch(()=>{});
    } catch {}
  };
  window.DPTrack = track;
  track('page_view');
  document.addEventListener('click', event => {
    const action = event.target.closest('a.button,a.hero-primary,a.demo-convert,a.cg-card,button[type=submit]');
    if(!action || Date.now() - lastClick < 120) return;
    lastClick = Date.now();
    // Only a limited semantic label; never include user-generated content.
    let label = action.classList.contains('cg-card') ? 'gateway' :
      action.closest('#demo') ? 'demo' :
      action.closest('#contact') || action.closest('#lead-form') ? 'contact' :
      action.closest('.presence-hero') ? 'hero' : 'other';
    if(action.tagName === 'A' && action.href) {
      try { label += ':'+ new URL(action.href).pathname.slice(0,60); } catch {}
    }
    track('cta_click',{label});
  },{capture:true,passive:true});
  document.addEventListener('click', event => {
    if(event.target.closest('#alex-start-button') && !event.target.closest('#alex-start-button')?.disabled) track('demo_voice_started');
  },{passive:true});
})();