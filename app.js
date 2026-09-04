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
  let nativeVapiButton = null;
  let alexCallActive = false;
  let vapiSDKPromise = null;
  let alexEventHandlers = [];
  const alexStartButton = $('#alex-start-button');

  let heroSeconds = 24;
  const heroTimer = $('.call-time');
  if (heroTimer && !reducedMotion) {
    window.setInterval(() => {
      heroSeconds += 1;
      heroTimer.textContent = `${String(Math.floor(heroSeconds / 60)).padStart(2, '0')}:${String(heroSeconds % 60).padStart(2, '0')}`;
    }, 1000);
  }

  alexStartButton.addEventListener('click', () => {
    if (!nativeVapiButton) return;
    console.log('[Dream Protocol Vapi] proxying user click to native Vapi control');
    nativeVapiButton.click();
  });

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

  function addKnowledge(label, values, type = '') {
    if (!values || (Array.isArray(values) && !values.length)) return;
    const section = document.createElement('section');
    const heading = document.createElement('h4');
    heading.textContent = label;
    section.className = type;
    const content = document.createElement(Array.isArray(values) ? 'ul' : 'p');
    if (Array.isArray(values)) values.forEach((value) => {
      const item = document.createElement('li');
      item.textContent = value;
      content.append(item);
    });
    else content.textContent = values;
    section.append(heading, content);
    $('#knowledge-preview').append(section);
  }

  function renderProfile(current) {
    $('#employee-name').textContent = current.employeeName;
    $('#employee-company').textContent = `${current.role} for ${current.company}`;
    $('#preview-speaker').textContent = current.employeeName;
    $('#employee-greeting').textContent = `“${current.greeting.replace(/^[“"]|[”"]$/g, '')}”`;
    const knowledge = $('#knowledge-preview');
    knowledge.replaceChildren();
    if (!current.isFallback) {
      if (current.found.services) addKnowledge('Services learned', current.business.services, 'services-knowledge');
      if (current.found.locations) addKnowledge('Locations', current.business.locations, 'locations-knowledge');
      if (current.found.hours) addKnowledge('Hours', current.business.hours, 'hours-knowledge');
      if (current.business.phone || current.business.email) addKnowledge('Contact ready', [current.business.phone, current.business.email].filter(Boolean), 'contact-knowledge');
    }
    $('#service-count').textContent = current.business.services?.length ? `${current.business.services.length} discovered` : 'Not found';
    $('#hours-status').textContent = current.found.hours ? 'Verified ✓' : 'Not found';
    $('#location-count').textContent = current.business.locations?.length ? `${current.business.locations.length} found` : 'Not found';
    $('#contact-status').textContent = current.business.phone || current.business.email ? 'Ready ✓' : 'Not found';
    $('#preview-label').textContent = current.isFallback ? 'Starting preview' : 'Your preview is ready';
    demoNotice.textContent = current.isFallback
      ? 'Live voice becomes available after we successfully read the business website.'
      : 'Built only from business information found on your website.';
    initializeAlexVoice(current);
    window.requestAnimationFrame(() => employeeView.classList.add('is-revealed'));
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
    if (alexVapi && alexCallActive) {
      try {
        alexVapi.stop?.();
      } catch (error) {
        console.warn('[Dream Protocol Vapi] Unable to stop previous call', error);
      }
    }
    alexVapi = null;
    alexCallActive = false;
    nativeVapiButton = null;
    document.querySelectorAll('.vapi-btn').forEach((button) => button.remove());
    $('#alex-voice-control').replaceChildren();
    alexStartButton.disabled = true;
    alexStartButton.textContent = 'Loading voice…';
  }

  function listenForAlexEvent(event, handler) {
    if (typeof alexVapi?.on !== 'function') return;
    alexVapi.on(event, handler);
    alexEventHandlers.push([event, handler]);
  }

  function waitForVapiButton(timeoutMs = 5000) {
    return new Promise((resolve) => {
      const existing = document.querySelector('.vapi-btn');
      if (existing) {
        resolve(existing);
        return;
      }

      const observer = new MutationObserver(() => {
        const button = document.querySelector('.vapi-btn');
        if (!button) return;
        observer.disconnect();
        clearTimeout(timer);
        resolve(button);
      });

      observer.observe(document.body, { childList: true, subtree: true });
      const timer = setTimeout(() => {
        observer.disconnect();
        resolve(null);
      }, timeoutMs);
    });
  }

  async function initializeAlexVoice(current) {
    const panel = $('#alex-widget-panel');
    const errorMessage = $('#widget-error');
    removeAlexVoice();
    panel.hidden = current.isFallback;
    if (current.isFallback) return;
    errorMessage.textContent = 'Preparing live voice…';

    try {
      await loadVapiSDK();
      if (current !== profile) return;

      const buttonConfig = {
        position: 'bottom-right',
        offset: '24px',
        width: '260px',
        height: '64px',
        idle: { color: '#d7ff68', type: 'pill', title: 'Talk with Alex', subtitle: 'Start live conversation' },
        loading: { color: '#a8c5ff', type: 'pill', title: 'Connecting to Alex', subtitle: 'Please wait' },
        active: { color: '#ef4444', type: 'pill', title: 'Conversation live', subtitle: 'Tap to end' }
      };

      console.log('[Dream Protocol Vapi] calling vapiSDK.run');
      alexVapi = window.vapiSDK.run({
        apiKey: config.vapiPublicKey,
        assistant: config.vapiAssistantId,
        assistantOverrides: widgetOverrides(current),
        config: buttonConfig
      });
      if (!alexVapi) throw new Error('Vapi SDK did not return an instance');
      console.log('[Dream Protocol Vapi] run returned instance');

      listenForAlexEvent('call-start', () => {
        alexCallActive = true;
        alexStartButton.textContent = 'End conversation';
        errorMessage.textContent = 'Speak with Alex using your microphone.';
      });
      listenForAlexEvent('call-end', () => {
        alexCallActive = false;
        alexStartButton.textContent = 'Talk to Alex';
        errorMessage.textContent = 'Speak with Alex using your microphone.';
      });
      listenForAlexEvent('error', (error) => {
        console.error('[Dream Protocol Vapi] Call error', error);
        alexCallActive = false;
        alexStartButton.textContent = 'Try again';
        errorMessage.textContent = 'Live voice is temporarily unavailable.';
      });

      console.log('[Dream Protocol Vapi] waiting for button');
      const button = await waitForVapiButton(5000);
      if (current !== profile) return;
      if (!button) {
        console.error('[Dream Protocol Vapi] SDK initialized but .vapi-btn was not detected within 5 seconds');
        alexStartButton.textContent = 'Try again';
        errorMessage.textContent = 'Live voice is temporarily unavailable.';
        return;
      }

      console.log('[Dream Protocol Vapi] button detected');
      await new Promise((resolve) => window.requestAnimationFrame(resolve));
      const buttonStyle = window.getComputedStyle(button);
      const bounds = button.getBoundingClientRect();
      if (buttonStyle.display === 'none' || buttonStyle.visibility === 'hidden' || bounds.width === 0 || bounds.height === 0) {
        console.error('[Dream Protocol Vapi] .vapi-btn was detected but is not visibly rendered');
        alexStartButton.textContent = 'Try again';
        errorMessage.textContent = 'Live voice is temporarily unavailable.';
        return;
      }
      nativeVapiButton = button;
      nativeVapiButton.classList.add('vapi-native-hidden');
      alexStartButton.disabled = false;
      alexStartButton.textContent = 'Talk to Alex';
      errorMessage.textContent = 'Speak with Alex using your microphone.';
      console.log('[Dream Protocol Vapi] Dream Protocol voice control ready');
    } catch (error) {
      console.error('[Dream Protocol Vapi] Alex initialization failed', error);
      removeAlexVoice();
      alexStartButton.textContent = 'Try again';
      errorMessage.textContent = 'Live voice is temporarily unavailable.';
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
    employeeView.classList.remove('is-revealed');
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

  window.addEventListener('pagehide', removeAlexVoice);

  const audio = $('.audio-card audio');
  if (audio) {
    audio.addEventListener('play', () => audio.closest('.audio-card').classList.add('is-playing'));
    ['pause', 'ended'].forEach((event) => audio.addEventListener(event, () => audio.closest('.audio-card').classList.remove('is-playing')));
  }

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
