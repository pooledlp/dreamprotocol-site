(() => {
  'use strict';

  const config = window.DREAMPROTOCOL_CONFIG || {};
  const $ = (selector) => document.querySelector(selector);
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const menuButton = $('.menu-button');
  const nav = $('#primary-nav');
  menuButton.addEventListener('click', () => {
    const open = menuButton.getAttribute('aria-expanded') === 'true';
    menuButton.setAttribute('aria-expanded', String(!open));
    nav.classList.toggle('open', !open);
  });
  nav.addEventListener('click', () => {
    nav.classList.remove('open');
    menuButton.setAttribute('aria-expanded', 'false');
  });

  const websiteForm = $('#website-form');
  const analysisView = $('#analysis-view');
  const employeeView = $('#employee-view');
  const analysisSteps = [...document.querySelectorAll('#analysis-steps li')];
  const demoNotice = $('#demo-notice');
  let profile = null;
  let widgetRenderId = 0;

  const vapiWidgetReady = new Promise((resolve) => {
    const widgetScript = $('#vapi-widget-script');
    let settled = false;
    const timeout = window.setTimeout(() => finish(false), 10000);

    function finish(loaded) {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      if (loaded && customElements.get('vapi-widget')) resolve(true);
      else {
        console.error('[Dream Protocol Vapi Widget] Widget script failed to load.');
        resolve(false);
      }
    }

    if (customElements.get('vapi-widget')) {
      finish(true);
      return;
    }

    customElements.whenDefined('vapi-widget').then(() => finish(true));
    widgetScript.addEventListener('load', () => {
      if (customElements.get('vapi-widget')) finish(true);
    }, { once: true });
    widgetScript.addEventListener('error', () => finish(false), { once: true });
  });

  const cleanString = (value, limit = 200) => typeof value === 'string' ? value.trim().slice(0, limit) : '';
  const cleanList = (value, limit = 5) => Array.isArray(value)
    ? value.map((item) => cleanString(item)).filter(Boolean).slice(0, limit)
    : [];

  function normalizeUrl(value) {
    const trimmed = value.trim();
    const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const parsed = new URL(withProtocol);
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('invalid');
    return parsed.href;
  }

  function fallbackProfile(url) {
    const host = new URL(url).hostname.replace(/^www\./, '');
    const words = host.split('.')[0].split(/[-_]/).filter(Boolean);
    const company = words.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ') || 'Your Business';
    return {
      company,
      employeeName: 'Alex',
      role: 'AI Front Desk',
      greeting: `Thanks for calling ${company}. This is Alex. How can I help you today?`,
      business: { name: company, services: [], locations: [], faq: [] },
      found: {},
      isFallback: true,
      analysisId: null
    };
  }

  function parseProfile(data, url) {
    if (!data || data.success !== true || !data.business) throw new Error('unavailable');
    const fallback = fallbackProfile(url);
    const source = data.business;
    const agent = data.agent || {};
    const name = cleanString(source.name || source.company || source.businessName, 100);
    const business = {
      name,
      description: cleanString(source.description, 400),
      website: cleanString(source.website, 500),
      industry: cleanString(source.industry, 80),
      services: cleanList(source.services),
      hours: cleanString(source.hours, 240),
      locations: cleanList(source.locations),
      phone: cleanString(source.phone, 60),
      email: cleanString(source.email, 160),
      faq: Array.isArray(source.faq) ? source.faq.filter((item) => item && cleanString(item.question)).slice(0, 5).map((item) => ({ question: cleanString(item.question), answer: cleanString(item.answer, 500) })) : []
    };
    const found = {
      identity: Boolean(data.found?.identity && name),
      services: Boolean(data.found?.services && business.services.length),
      hours: Boolean(data.found?.hours && business.hours),
      locations: Boolean(data.found?.locations && business.locations.length),
      faq: Boolean(data.found?.faq && business.faq.length)
    };
    const company = found.identity ? name : fallback.company;
    return {
      company,
      employeeName: cleanString(agent.name, 40) || 'Alex',
      role: cleanString(agent.role, 80) || 'AI Front Desk',
      greeting: cleanString(agent.greeting, 500) || `Thanks for calling ${company}. This is Alex. How can I help you today?`,
      suggestedGoals: cleanList(agent.suggestedGoals, 6),
      analysisId: cleanString(data.analysisId, 100) || null,
      business,
      found,
      isFallback: false
    };
  }

  async function animateAnalysis(stopSignal) {
    analysisSteps.forEach((step) => step.classList.remove('done', 'active', 'missing'));
    for (const step of analysisSteps) {
      if (stopSignal.stopped) break;
      analysisSteps.forEach((item) => item.classList.remove('active'));
      step.classList.add('active');
      await wait(reducedMotion ? 1 : 270);
    }
  }

  function finishAnalysis(found, succeeded) {
    analysisSteps.forEach((step) => {
      step.classList.remove('active');
      const key = step.dataset.field;
      const discovered = key === 'website' ? succeeded : Boolean(found[key]);
      step.classList.toggle('done', discovered);
      step.classList.toggle('missing', !discovered);
    });
  }

  function addKnowledge(label, values) {
    if (!values || (Array.isArray(values) && !values.length)) return;
    const section = document.createElement('section');
    const heading = document.createElement('h4');
    heading.textContent = label;
    const content = document.createElement('p');
    content.textContent = Array.isArray(values) ? values.join(' · ') : values;
    section.append(heading, content);
    $('#knowledge-preview').append(section);
  }

  function renderProfile(current) {
    $('#employee-name').textContent = current.employeeName;
    $('#employee-company').textContent = `${current.role} for ${current.company}`;
    $('#employee-greeting').textContent = `“${current.greeting.replace(/^[“"]|[”"]$/g, '')}”`;
    const knowledge = $('#knowledge-preview');
    knowledge.replaceChildren();
    if (!current.isFallback) {
      if (current.found.services) addKnowledge('Knows about', current.business.services);
      if (current.found.locations) addKnowledge('Service area', current.business.locations);
      if (current.found.hours) addKnowledge('Hours', current.business.hours);
      if (current.business.phone) addKnowledge('Contact', current.business.phone);
    }
    $('#preview-label').textContent = current.isFallback ? 'Starting preview' : 'Your preview is ready';
    demoNotice.textContent = current.isFallback
      ? "We couldn't fully read that website, so live voice is unavailable. Scan a public business website to build a verified preview."
      : 'Built only from business information found on your website.';
    renderVoiceWidget(current);
  }

  function widgetOverrides(current) {
    const business = current.business || {};
    const unavailable = 'Not provided on the website';
    return {
      variableValues: {
        companyName: current.company,
        businessWebsite: business.website || '',
        businessDescription: business.description || unavailable,
        services: business.services?.length ? business.services.join(', ') : unavailable,
        businessHours: business.hours || unavailable,
        locations: business.locations?.length ? business.locations.join(', ') : unavailable,
        businessPhone: business.phone || unavailable
      }
    };
  }

  async function renderVoiceWidget(current) {
    const panel = $('#alex-widget-panel');
    const host = $('#vapi-widget-host');
    const errorMessage = $('#widget-error');
    host.replaceChildren();
    errorMessage.hidden = true;
    panel.hidden = current.isFallback;
    if (current.isFallback) return;
    const renderId = ++widgetRenderId;
    errorMessage.textContent = 'Loading live voice…';
    errorMessage.hidden = false;

    if (!await vapiWidgetReady) {
      if (renderId !== widgetRenderId) return;
      errorMessage.textContent = 'Live voice is temporarily unavailable.';
      return;
    }
    if (renderId !== widgetRenderId) return;

    const widget = document.createElement('vapi-widget');
    const attributes = {
      'public-key': config.vapiPublicKey,
      'assistant-id': config.vapiAssistantId,
      mode: 'voice',
      theme: 'dark',
      size: 'full',
      title: 'Talk with Alex',
      'start-button-text': 'Start conversation',
      'end-button-text': 'End conversation',
      'voice-show-transcript': 'true',
      'consent-required': 'true',
      'consent-content': 'Use your microphone to speak with the Dream Protocol AI demo. Conversation data is processed by our voice technology provider to provide the live experience.',
      'base-bg-color': '#0f1215',
      'accent-color': '#a8c5ff',
      'cta-button-color': '#d7ff68',
      'cta-button-text-color': '#0a0c0e',
      'border-radius': 'medium',
      'assistant-overrides': JSON.stringify(widgetOverrides(current))
    };
    Object.entries(attributes).forEach(([name, value]) => widget.setAttribute(name, value || ''));
    widget.addEventListener('error', (event) => {
      console.error('[Dream Protocol Vapi Widget]', event.detail);
      errorMessage.textContent = 'Live voice is temporarily unavailable.';
      errorMessage.hidden = false;
    });
    host.append(widget);
    errorMessage.hidden = true;
  }

  async function requestAnalysis(url) {
    if (!config.businessAnalysisEndpoint) throw new Error('unavailable');
    const response = await fetch(config.businessAnalysisEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ url })
    });
    if (!response.ok) throw new Error('unavailable');
    return response.json();
  }

  websiteForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const input = $('#business-url');
    let url;
    try {
      url = normalizeUrl(input.value);
      input.value = url;
      input.setCustomValidity('');
    } catch {
      input.setCustomValidity('Enter a complete public business website.');
      input.reportValidity();
      return;
    }

    const button = websiteForm.querySelector('button');
    button.disabled = true;
    websiteForm.hidden = true;
    employeeView.hidden = true;
    analysisView.hidden = false;
    const stopSignal = { stopped: false };
    const animation = animateAnalysis(stopSignal);
    let usedFallback = false;
    try {
      const data = await requestAnalysis(url);
      profile = parseProfile(data, url);
    } catch {
      profile = fallbackProfile(url);
      usedFallback = true;
    }
    stopSignal.stopped = true;
    await animation;
    finishAnalysis(profile.found, !usedFallback);
    await wait(reducedMotion ? 1 : 250);
    analysisView.hidden = true;
    employeeView.hidden = false;
    renderProfile(profile);
    button.disabled = false;
  });

  $('#reset-analysis').addEventListener('click', () => {
    profile = null;
    widgetRenderId += 1;
    $('#vapi-widget-host').replaceChildren();
    $('#alex-widget-panel').hidden = true;
    employeeView.hidden = true;
    analysisView.hidden = true;
    websiteForm.hidden = false;
    const input = $('#business-url');
    input.value = '';
    input.focus();
  });

  const leadForm = $('#lead-form');
  leadForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = leadForm.querySelector('button');
    const status = $('#form-status');
    const values = Object.fromEntries(new FormData(leadForm));
    button.disabled = true;
    status.textContent = 'Sending…';
    try {
      const response = await fetch('https://formsubmit.co/ajax/pooledlp@gmail.com', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ ...values, _subject: `Dream Protocol workflow — ${values.company}`, _template: 'table', _captcha: 'false', source_page: location.pathname })
      });
      if (!response.ok) throw new Error('send failed');
      leadForm.reset();
      status.textContent = 'Got it. We’ll follow up with a practical next step.';
    } catch {
      status.textContent = 'We couldn’t send that just now. Please try again in a moment.';
    } finally {
      button.disabled = false;
    }
  });
})();
