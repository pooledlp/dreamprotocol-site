/* Keep campaign attribution in this tab; send it only with an inquiry. */
(() => {
  'use strict';
  const key = 'dreamprotocol_attribution_v1';
  const fields = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
  const params = new URLSearchParams(location.search);
  let saved = {};
  try {
    saved = JSON.parse(sessionStorage.getItem(key) || '{}');
    if (!saved || typeof saved !== 'object' || Array.isArray(saved)) saved = {};
  } catch { saved = {}; }
  const incoming = {};
  fields.forEach((field) => {
    const value = params.get(field);
    if (value) incoming[field] = value.slice(0, 150);
  });
  let referrer = '';
  try {
    const url = new URL(document.referrer);
    if (url.origin !== location.origin) referrer = url.hostname;
  } catch { /* Direct visit or unavailable referrer. */ }
  const campaign = Object.keys(incoming).length > 0;
  const attribution = {
    landing_page: campaign ? location.pathname : (typeof saved.landing_page === 'string' ? saved.landing_page.slice(0, 250) : location.pathname),
    referrer_host: campaign ? referrer : (typeof saved.referrer_host === 'string' ? saved.referrer_host.slice(0, 250) : referrer)
  };
  fields.forEach((field) => {
    const value = campaign ? incoming[field] : saved[field];
    if (typeof value === 'string') attribution[field] = value.slice(0, 150);
  });
  try { sessionStorage.setItem(key, JSON.stringify(attribution)); } catch { /* Storage is optional. */ }
  window.DREAMPROTOCOL_ATTRIBUTION = Object.freeze(attribution);
})();
