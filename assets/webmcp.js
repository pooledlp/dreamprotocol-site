(() => {
  'use strict';
  // WebMCP is experimental and is a progressive enhancement, not a dependency
  // for the human-facing site. The page remains functional without this API.
  if (!('modelContext' in document) || typeof document.modelContext?.registerTool !== 'function') return;

  const offers = Object.freeze({
    reception: { name: 'AI receptionist', monthlyFromUSD: 399, setupFromUSD: 995,
      scope: 'One-location starter scope. Usage, transfers and integrations quoted before launch.' },
    leads: { name: 'AI lead follow-up', monthlyFromUSD: 499, setupFromUSD: 1500,
      scope: 'One lead source and one approved follow-up path. Consent and connected systems scoped.' },
    managed: { name: 'Managed AI operations', monthlyFromUSD: 750, setupFromUSD: null,
      scope: 'Onboarding quoted separately. Existing AI workflows, monthly review and published support allowance.' }
  });

  function validatePublicWebsite(value) {
    if (typeof value !== 'string' || value.length > 300 || /\s/.test(value.trim())) throw new Error('Invalid website');
    const raw = value.trim();
    if (!raw || (/^[a-z][a-z\d+.-]*:/i.test(raw) && !/^https?:\/\//i.test(raw))) throw new Error('Invalid website scheme');
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : 'https://' + raw);
    const host = url.hostname.toLowerCase();
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password ||
        !host.includes('.') || /^(localhost|.*\.localhost|.*\.local|.*\.internal)$/.test(host) ||
        /^\d+\.\d+\.\d+\.\d+$/.test(host) ||
        !host.split('.').every((part) => /^[a-z\d](?:[a-z\d-]*[a-z\d])?$/i.test(part))) {
      throw new Error('A public business domain is required');
    }
    url.pathname = '/';
    url.search = '';
    url.hash = '';
    return url.href;
  }

  const clip = (v, max) => typeof v === 'string' ? v.trim().slice(0, max) : '';
  const list = (v) => Array.isArray(v) ? v.filter((x) => typeof x === 'string').map((x) => x.trim().slice(0, 160)).filter(Boolean).slice(0, 5) : [];
  function profileFromResponse(data, url) {
    if (!data || data.success !== true || !data.business) return { ok: false, error: 'Could not verify this website.' };
    const b = data.business;
    return {
      ok: true, publicWebsite: url,
      name: clip(b.name || b.company || b.businessName, 110),
      industry: clip(b.industry, 80),
      description: clip(b.description, 400),
      services: list(b.services),
      hours: clip(b.hours, 200),
      locations: list(b.locations),
      note: 'Public information only. Missing fields are unknown. This is not a production agent.'
    };
  }
  const jsonSchemaString = (description, maxLength = 300) => ({ type: 'string', description, maxLength });
  const defs = [
    {
      name: 'analyze_business',
      description: 'Read an explicitly supplied public business website using Dream Protocol existing scanner; do not use for private or confidential URLs. Returns available public business fields only.',
      inputSchema: {
        type: 'object',
        properties: { url: jsonSchemaString('Public website URL or domain, for example example.com') },
        required: ['url'], additionalProperties: false
      },
      async execute(input, context = {}) {
        let url;
        try { url = validatePublicWebsite(input?.url); }
        catch { return { ok: false, error: 'Use a public business website such as example.com.' }; }
        if (window.DreamProtocolLive && location.pathname.startsWith('/live')) {
          try { const b = await window.DreamProtocolLive.runScan(url); return { ok: true, ...b, note: 'Verified public website scan. No production agent was created.' }; }
          catch { return { ok: false, error: 'Scan unavailable or unable to verify business information.' }; }
        }
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 45000);
          const externalSignal = context?.signal;
          if (externalSignal?.aborted) controller.abort();
          else externalSignal?.addEventListener?.('abort', () => controller.abort(), { once: true });
          try {
            const response = await fetch('https://api.dreamprotocol.ai/analyze-business', {
              method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
              credentials: 'omit', signal: controller.signal, body: JSON.stringify({ url })
            });
            if (!response.ok) return { ok: false, error: 'Scanner backend is unavailable.' };
            return profileFromResponse(await response.json(), url);
          } finally { clearTimeout(timeout); }
        } catch { return { ok: false, error: 'Scanner request failed or timed out.' }; }
      }
    },
    {
      name: 'build_demo_agent',
      description: 'Prepare a link to the existing real, browser-based Vapi AI front desk demo for a public business website. Does not provision, deploy, or call any production agent; the visitor starts the call.',
      inputSchema: { type: 'object', properties: { url: jsonSchemaString('Public business website to scan for a personalized voice preview') }, required: ['url'], additionalProperties: false },
      execute(input) {
        let url;
        try { url = validatePublicWebsite(input?.url); }
        catch { return { ok: false, error: 'Provide a public business website.' }; }
        return {
          ok: true, demoUrl: location.origin + '/?business=' + encodeURIComponent(url) + '#demo',
          instructions: 'Open the link, allow the public-site scan to finish, then explicitly click to start the Vapi voice call. Voice is unavailable if the scan cannot verify public business data.',
          requiresUserGesture: true, liveAssistantProvisioned: false
        };
      }
    },
    {
      name: 'compare_solutions',
      description: 'Compare Dream Protocol published AI reception, lead follow-up, and managed AI operations starter offers without inventing pricing or capabilities.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      execute() {
        return { solutions: Object.values(offers), note: 'Published starting prices, not a quote or guaranteed scope. Third-party services and integrations may cost extra.' };
      }
    },
    {
      name: 'estimate_pricing',
      description: 'Show the published starting price and setup boundary for one Dream Protocol offer. Does not produce a binding quote.',
      inputSchema: {
        type: 'object',
        properties: { service: { type: 'string', enum: ['reception', 'leads', 'managed'], description: 'Requested service' } },
        required: ['service'], additionalProperties: false
      },
      execute(input) {
        const offer = Object.prototype.hasOwnProperty.call(offers, input?.service) ? offers[input.service] : null;
        return offer ? { ok: true, ...offer, currency: 'USD', isBindingQuote: false, nextStep: location.origin + '/live/#plan' } :
          { ok: false, error: 'Choose reception, leads, or managed.' };
      }
    },
    {
      name: 'simulate_workflow',
      description: 'Display an illustrative business workflow in Dream Protocol Live. This changes the visible preview only: it never sends an SMS, books an appointment, or writes to a CRM.',
      inputSchema: {
        type: 'object',
        properties: { workflow: { type: 'string', enum: ['reception', 'leads', 'dispatch', 'operations'] } },
        required: ['workflow'], additionalProperties: false
      },
      execute(input) {
        if (!['reception', 'leads', 'dispatch', 'operations'].includes(input?.workflow)) return { ok: false, error: 'Unknown workflow.' };
        if (!window.DreamProtocolLive) return { ok: true, previewUrl: location.origin + '/live/#workflow', note: 'Open the live workspace to run this example; no real systems are changed.' };
        return { ok: true, steps: window.DreamProtocolLive.runWorkflow(input.workflow), systemsModified: 0, simulation: true };
      }
    },
    {
      name: 'request_consultation',
      description: 'Open and optionally select an offer in the visitor-controlled consultation form. Does not submit personal details or contact anyone without the visitor pressing Submit and consenting.',
      inputSchema: {
        type: 'object',
        properties: { service: { type: 'string', enum: ['reception', 'leads', 'managed'], description: 'Offer to preselect' } },
        required: ['service'], additionalProperties: false
      },
      execute(input) {
        if (!Object.prototype.hasOwnProperty.call(offers, input?.service)) return { ok: false, error: 'Unknown service.' };
        if (window.DreamProtocolLive) {
          window.DreamProtocolLive.focusLead(input.service);
          return { ok: true, formReady: true, submitted: false, consentRequired: true };
        }
        return { ok: true, formUrl: location.origin + '/live/#plan', submitted: false, consentRequired: true };
      }
    }
  ];

  (async () => {
    for (const definition of defs) {
      try { await document.modelContext.registerTool(definition); }
      catch (error) { console.warn('[Dream Protocol WebMCP] Could not register tool', definition.name, error?.name || 'unsupported'); }
    }
  })();
})();
