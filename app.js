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
  const voiceConsent = $('#voice-consent');
  const voiceView = $('#voice-view');
  const sessionSummary = $('#session-summary');
  const endCall = $('#end-call');
  const startConversation = $('#start-conversation');
  const enableSound = $('#enable-sound');
  const retryMicrophone = $('#retry-microphone');
  let activeAdapter = null;
  let transcripts = [];
  let completing = false;

  function showConsent() {
    if (!profile) return;
    employeeView.hidden = true;
    voiceView.hidden = true;
    sessionSummary.hidden = true;
    voiceConsent.hidden = false;
    $('#consent-message').textContent = `Use your microphone to speak with the AI Front Desk for ${profile.company}. This live browser demo uses Vapi to process the conversation.`;
    startConversation.focus();
  }

  function renderTranscript(target, entries) {
    target.replaceChildren(...entries.map(({ speaker, text }) => {
      const item = document.createElement('li');
      const label = document.createElement('strong');
      label.textContent = speaker;
      item.append(label, document.createTextNode(text));
      return item;
    }));
  }

  function addTranscript(entry) {
    if (!entry || !['YOU', 'ALEX'].includes(entry.speaker) || typeof entry.text !== 'string') return;
    const text = entry.text.trim().slice(0, 2000);
    if (!text) return;
    const previous = transcripts[transcripts.length - 1];
    if (previous?.speaker === entry.speaker && previous.text === text) return;
    transcripts.push({ speaker: entry.speaker, text });
    transcripts = transcripts.slice(-30);
    $('#live-transcript').hidden = false;
    renderTranscript($('#transcript-list'), transcripts);
    $('#transcript-list').lastElementChild?.scrollIntoView({ block: 'nearest' });
  }

  function finishConversation() {
    if (completing) return;
    completing = true;
    activeAdapter = null;
    endCall.hidden = true;
    voiceConsent.hidden = true;
    voiceView.hidden = true;
    sessionSummary.hidden = false;
    $('#transcript-recap').hidden = !transcripts.length;
    renderTranscript($('#recap-list'), transcripts);
    talkButton.disabled = false;
    enableSound.hidden = true;
    retryMicrophone.hidden = true;
  }

  function showVoiceFailure(error) {
    console.error('[Dream Protocol voice] Unable to start or continue the Vapi conversation.', error);
    voiceConsent.hidden = true;
    sessionSummary.hidden = true;
    voiceView.hidden = false;
    $('#voice-state').textContent = 'Conversation unavailable';
    $('#voice-title').textContent = "We couldn't start the live conversation.";
    $('#voice-message').innerHTML = 'You can still <a class="text-link" href="#hear">hear the example below</a>.';
    endCall.hidden = true;
    activeAdapter = null;
    talkButton.disabled = false;
    enableSound.hidden = true;
    retryMicrophone.hidden = true;
  }

  function showMicrophoneFailure(error) {
    console.error('[Dream Protocol audio] getUserMedia failed.', { name: error?.name, message: error?.message });
    const messages = {
      NotAllowedError: 'Microphone access is blocked. Use the microphone permission control in your browser address bar, allow Dream Protocol, then try again.',
      NotFoundError: 'No microphone was detected.',
      NotReadableError: 'Your microphone is currently unavailable or being used by another application.',
      SecurityError: 'Your browser prevented microphone access.'
    };
    if (!messages[error?.name]) return showVoiceFailure(error);
    voiceConsent.hidden = true;
    sessionSummary.hidden = true;
    voiceView.hidden = false;
    $('#voice-state').textContent = 'Microphone unavailable';
    $('#voice-title').textContent = error.name === 'NotAllowedError' ? 'Microphone access is blocked for Dream Protocol.' : 'We could not access your microphone.';
    $('#voice-message').textContent = messages[error.name];
    endCall.hidden = true;
    enableSound.hidden = true;
    retryMicrophone.hidden = false;
    activeAdapter = null;
    talkButton.disabled = false;
  }

  async function microphonePermissionState() {
    if (!navigator.permissions?.query) return 'unsupported';
    try {
      const status = await navigator.permissions.query({ name: 'microphone' });
      console.debug('[Dream Protocol audio] Microphone permission result.', status.state);
      return status.state;
    } catch (error) {
      console.debug('[Dream Protocol audio] Microphone permission query unsupported.', error?.name);
      return 'unsupported';
    }
  }

  async function preflightMicrophone() {
    const permission = await microphonePermissionState();
    if (permission === 'denied') {
      const error = new Error('Microphone permission is denied.');
      error.name = 'NotAllowedError';
      throw error;
    }
    if (permission === 'prompt') $('#voice-message').textContent = 'Allow microphone access to talk with Alex.';
    else $('#voice-message').textContent = 'Waiting for microphone permission…';
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      console.debug('[Dream Protocol audio] getUserMedia succeeded.');
    } catch (error) {
      console.debug('[Dream Protocol audio] getUserMedia failed.', { name: error?.name, message: error?.message });
      throw error;
    } finally {
      stream?.getTracks().forEach((track) => track.stop());
    }
  }

  async function startVoice() {
    const adapter = window.DreamProtocolVoiceAdapter;
    // Invoke playback APIs before the first await so mobile/WebKit sees the direct tap.
    const audioUnlock = adapter?.unlockAudioPlayback?.();
    voiceConsent.hidden = true;
    sessionSummary.hidden = true;
    voiceView.hidden = false;
    $('#voice-state').textContent = 'Preparing conversation';
    $('#voice-title').textContent = `${profile.employeeName} is getting ready.`;
    $('#voice-message').textContent = 'Your browser will ask for microphone access.';
    $('#live-transcript').hidden = true;
    $('#transcript-list').replaceChildren();
    transcripts = [];
    completing = false;
    talkButton.disabled = true;
    startConversation.disabled = true;
    retryMicrophone.hidden = true;
    enableSound.hidden = true;
    try {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) throw new Error('Microphone access is unsupported in this browser or context.');
      if (!config.vapiPublicKey || !config.vapiAssistantId) throw new Error('Vapi browser configuration is missing.');
      if (!adapter || typeof adapter.connect !== 'function') throw new Error('The voice adapter did not load.');
      await audioUnlock;
      await preflightMicrophone();
      activeAdapter = adapter;
      $('#voice-state').textContent = 'Connecting to Alex';
      $('#voice-message').textContent = 'Microphone ready. Starting the conversation…';
      endCall.hidden = false;
      await adapter.connect({
        profile,
        onState(state) {
          const labels = { connected: 'Conversation live', listening: 'Listening…', speaking: `${profile.employeeName} is speaking`, ended: 'Conversation ended' };
          $('#voice-state').textContent = labels[state] || 'Conversation live';
          if (state === 'connected' || state === 'listening') {
            $('#voice-title').textContent = `${profile.employeeName} is listening.`;
            $('#voice-message').textContent = 'Speak naturally. End the conversation whenever you’re ready.';
          }
        },
        onTranscript: addTranscript,
        onComplete: finishConversation,
        onError: showVoiceFailure,
        onAudioBlocked() {
          $('#voice-title').textContent = `${profile.employeeName} is connected. Tap to enable sound.`;
          $('#voice-message').textContent = 'Your browser needs one more tap before it can play Alex’s voice.';
          enableSound.hidden = false;
        },
        onAudioReady() {
          enableSound.hidden = true;
        }
      });
    } catch (error) {
      await adapter?.disconnect?.();
      if (['NotAllowedError', 'NotFoundError', 'NotReadableError', 'SecurityError'].includes(error?.name)) showMicrophoneFailure(error);
      else showVoiceFailure(error);
    } finally {
      startConversation.disabled = false;
    }
  }

  talkButton.addEventListener('click', showConsent);
  $('#start-another-call').addEventListener('click', showConsent);
  startConversation.addEventListener('click', startVoice);
  retryMicrophone.addEventListener('click', startVoice);
  enableSound.addEventListener('click', async () => {
    enableSound.disabled = true;
    const succeeded = await activeAdapter?.enableSound?.();
    enableSound.disabled = false;
    enableSound.hidden = Boolean(succeeded);
    if (succeeded) {
      $('#voice-title').textContent = `${profile.employeeName} is listening.`;
      $('#voice-message').textContent = 'Speak naturally. End the conversation whenever you’re ready.';
    }
  });
  $('#cancel-conversation').addEventListener('click', () => {
    voiceConsent.hidden = true;
    employeeView.hidden = false;
    talkButton.focus();
  });
  endCall.addEventListener('click', async () => {
    endCall.disabled = true;
    try {
      if (activeAdapter && typeof activeAdapter.disconnect === 'function') await activeAdapter.disconnect();
      finishConversation();
    } catch (error) {
      console.error('[Dream Protocol voice] Unable to end the Vapi conversation cleanly.', error);
      finishConversation();
    } finally {
      endCall.disabled = false;
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
