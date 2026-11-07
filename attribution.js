/* Read current-page campaign context without persistent browser tracking. */
(() => {
  'use strict';
  const fields = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
  const params = new URLSearchParams(location.search);
  const attribution = { landing_page: location.pathname };

  fields.forEach((field) => {
    // Some Outlook plain-text emails have rewritten &utm_campaign to
    // &utm;_campaign. Recognize the encoded form without collecting PII.
    const value = params.get(field) || params.get(field.replace('utm_', 'utm;_'));
    if (value) attribution[field] = value.slice(0, 150);
  });
  if (/^nov2026_blitz_[ab]$/.test(attribution.utm_campaign || '')) {
    attribution.utm_source ||= 'outbound';
    attribution.utm_medium ||= 'email';
  }

  try {
    const url = new URL(document.referrer);
    if (url.origin !== location.origin) attribution.referrer_host = url.hostname.slice(0, 250);
    else if (url.pathname && url.pathname !== location.pathname) attribution.previous_page = url.pathname.slice(0, 250);
  } catch { /* Direct visit or unavailable referrer. */ }

  window.DREAMPROTOCOL_ATTRIBUTION = Object.freeze(attribution);
})();
