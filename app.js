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
    $('#talk-button').firstChild.textContent = `Talk to ${current.employeeName} `;
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
      ? "We couldn't fully read that website, so here's a basic starting point. A production Dream Protocol employee would be configured with your verified services, hours, locations, and workflows."
      : 'Built only from business information found on your website.';
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
    employeeView.hidden = true;
    analysisView.hidden = true;
    websiteForm.hidden = false;
    const input = $('#business-url');
    input.value = '';
    input.focus();
  });

  const talkButton = $('#talk-button');
  const voiceView = $('#voice-view');
  const endCall = $('#end-call');
  let activeSession = null;
  let activeAdapter = null;

  function safeActions(value) {
    if (!Array.isArray(value)) return [];
    return value
      .filter((action) => typeof action === 'string' || (action && typeof action.label === 'string' && action.completed === true))
      .map((action) => typeof action === 'string' ? action : action.label)
      .map((action) => action.replace(/[<>]/g, '').slice(0, 120))
      .filter(Boolean)
      .slice(0, 6);
  }

  function showSummary(actions) {
    const completed = safeActions(actions);
    if (!completed.length) return;
    const list = $('#summary-actions');
    list.replaceChildren(...completed.map((label) => {
      const item = document.createElement('li');
      item.textContent = label;
      return item;
    }));
    voiceView.hidden = true;
    $('#session-summary').hidden = false;
  }

  async function startVoice() {
    employeeView.hidden = true;
    voiceView.hidden = false;
    $('#voice-state').textContent = 'Preparing your conversation';
    $('#voice-title').textContent = `${profile.employeeName} is getting ready.`;
    $('#voice-message').textContent = 'This usually takes a moment.';
    talkButton.disabled = true;
    try {
      if (!config.voiceSessionEndpoint) throw new Error('unavailable');
      const response = await fetch(config.voiceSessionEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ analysisId: profile.analysisId, company: profile.company, employeeName: profile.employeeName, greeting: profile.greeting })
      });
      if (!response.ok) throw new Error('unavailable');
      activeSession = await response.json();
      const adapter = window.DreamProtocolVoiceAdapter;
      if (!adapter || typeof adapter.connect !== 'function') throw new Error('unavailable');
      activeAdapter = adapter;
      await adapter.connect({
        session: activeSession,
        onState(state) {
          const labels = { connected: 'Conversation live', listening: 'Listening', speaking: `${profile.employeeName} is speaking`, ended: 'Conversation complete' };
          $('#voice-state').textContent = labels[state] || 'Conversation live';
        },
        onComplete(result = {}) {
          showSummary(result.completedActions || result.actions || activeSession.completedActions);
        }
      });
      $('#voice-state').textContent = 'Conversation live';
      $('#voice-title').textContent = `${profile.employeeName} is listening.`;
      $('#voice-message').textContent = 'Speak naturally. End the conversation whenever you’re ready.';
      endCall.hidden = false;
    } catch {
      $('#voice-state').textContent = 'Let’s try that another way';
      $('#voice-title').textContent = 'A live conversation isn’t available right now.';
      $('#voice-message').innerHTML = 'You can still <a class="text-link" href="#hear">hear an example conversation</a> or tell us about your workflow below.';
      endCall.hidden = true;
    } finally {
      talkButton.disabled = false;
    }
  }

  talkButton.addEventListener('click', startVoice);
  endCall.addEventListener('click', async () => {
    let result = {};
    if (activeAdapter && typeof activeAdapter.disconnect === 'function') result = await activeAdapter.disconnect() || {};
    endCall.hidden = true;
    showSummary(result.completedActions || result.actions || activeSession?.completedActions);
    if (!safeActions(result.completedActions || result.actions || activeSession?.completedActions).length) {
      $('#voice-state').textContent = 'Conversation complete';
      $('#voice-title').textContent = 'Thanks for talking with us.';
      $('#voice-message').textContent = 'Your live session has ended.';
    }
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
