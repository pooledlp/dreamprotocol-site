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
  let alexVapi = null;
  let vapiSDKPromise = null;
  let alexEventHandlers = [];

  function loadVapiSDK() {
    if (typeof window.vapiSDK?.run === 'function') {
      console.log('[Dream Protocol Vapi] SDK ready');
      return Promise.resolve(window.vapiSDK);
    }
    if (vapiSDKPromise) return vapiSDKPromise;

    vapiSDKPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/gh/VapiAI/html-script-tag@latest/dist/assets/index.js';
      script.async = true;
      script.addEventListener('load', () => {
        if (typeof window.vapiSDK?.run === 'function') {
          console.log('[Dream Protocol Vapi] SDK ready');
          resolve(window.vapiSDK);
          return;
        }
        console.error('[Dream Protocol Vapi] HTML voice SDK failed to load');
        reject(new Error('Vapi SDK run function is unavailable'));
      }, { once: true });
      script.addEventListener('error', () => {
        console.error('[Dream Protocol Vapi] HTML voice SDK failed to load');
        reject(new Error('Vapi SDK script failed to load'));
      }, { once: true });
      document.head.append(script);
    });
    return vapiSDKPromise;
  }

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
      ? 'Live voice becomes available after we successfully read the business website.'
      : 'Built only from business information found on your website.';
    initializeAlexVoice(current);
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

  function removeAlexVoice() {
    alexEventHandlers.forEach(([event, handler]) => alexVapi?.off?.(event, handler));
    alexEventHandlers = [];
    if (alexVapi) {
      try {
        alexVapi.stop?.();
      } catch (error) {
        console.warn('[Dream Protocol Vapi] Unable to stop previous call', error);
      }
    }
    alexVapi = null;
    document.querySelectorAll('.vapi-btn').forEach((button) => button.remove());
    $('#alex-voice-control').replaceChildren();
  }

  function listenForAlexEvent(event, handler) {
    if (typeof alexVapi?.on !== 'function') return;
    alexVapi.on(event, handler);
    alexEventHandlers.push([event, handler]);
  }

  async function initializeAlexVoice(current) {
    const panel = $('#alex-widget-panel');
    const host = $('#alex-voice-control');
    const errorMessage = $('#widget-error');
    removeAlexVoice();
    errorMessage.hidden = true;
    panel.hidden = current.isFallback;
    if (current.isFallback) return;
    errorMessage.textContent = 'Loading live voice…';
    errorMessage.hidden = false;

    try {
      await loadVapiSDK();
      if (current !== profile) return;

      const buttonConfig = {
        position: 'bottom-center',
        offset: '24px',
        width: '260px',
        height: '64px',
        idle: { color: '#d7ff68', type: 'pill', title: 'Talk with Alex', subtitle: 'Start live conversation' },
        loading: { color: '#a8c5ff', type: 'pill', title: 'Connecting to Alex', subtitle: 'Please wait' },
        active: { color: '#ef4444', type: 'pill', title: 'Conversation live', subtitle: 'Tap to end' }
      };

      alexVapi = window.vapiSDK.run({
        apiKey: config.vapiPublicKey,
        assistant: config.vapiAssistantId,
        assistantOverrides: widgetOverrides(current),
        config: buttonConfig
      });
      if (!alexVapi) throw new Error('Vapi SDK did not return an instance');
      console.log('[Dream Protocol Vapi] Alex initialized');

      listenForAlexEvent('call-start', () => { errorMessage.hidden = true; });
      listenForAlexEvent('call-end', () => { errorMessage.hidden = true; });
      listenForAlexEvent('error', (error) => {
        console.error('[Dream Protocol Vapi] Call error', error);
        errorMessage.textContent = 'Live voice is temporarily unavailable.';
        errorMessage.hidden = false;
      });
      listenForAlexEvent('message', () => { errorMessage.hidden = true; });

      await new Promise((resolve) => window.requestAnimationFrame(() => window.requestAnimationFrame(resolve)));
      if (current !== profile) return;
      const button = document.querySelector('.vapi-btn');
      if (!button) throw new Error('Vapi voice button was not rendered');
      host.append(button);
      const buttonStyle = window.getComputedStyle(button);
      const bounds = button.getBoundingClientRect();
      if (buttonStyle.display === 'none' || buttonStyle.visibility === 'hidden' || bounds.width === 0 || bounds.height === 0) {
        throw new Error('Vapi voice button is not visibly rendered');
      }
      console.log('[Dream Protocol Vapi] Voice button rendered');
      errorMessage.hidden = true;
    } catch (error) {
      console.error('[Dream Protocol Vapi] Alex initialization failed', error);
      removeAlexVoice();
      errorMessage.textContent = 'Live voice is temporarily unavailable.';
      errorMessage.hidden = false;
    }
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
    removeAlexVoice();
    profile = null;
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
