(() => {
  'use strict';

  const $ = (selector) => document.querySelector(selector);
  const form = $('#scan-form');
  if (!form) return;

  const startingPlans = Object.freeze({
    reception: {
      name: 'AI receptionist',
      price: '$399/mo',
      setup: 'Setup from $995',
      description: 'One location, approved business knowledge, intake rules, routine-call testing and human handoff. Minutes and integrations are quoted separately.'
    },
    leads: {
      name: 'AI lead follow-up',
      price: '$499/mo',
      setup: 'Setup from $1,500',
      description: 'One agreed inbound lead source and one approved follow-up path. Consent, CRM access, third-party usage and additional paths require separate scoping.'
    },
    managed: {
      name: 'Managed AI operations',
      price: '$750/mo',
      setup: 'Onboarding quoted separately',
      description: 'Monthly review and up to four hours of support in the published scope for an existing AI workflow. Provider charges and extra changes are quoted separately.'
    }
  });

  const examples = Object.freeze({
    reception: {
      description: 'Answer approved questions, capture the request, and prepare a clear team handoff.',
      steps: [
        ['An incoming call is recognized', 'The AI greets the caller using the business name and approved knowledge.'],
        ['The request is captured', 'The agent gathers the question, callback context and preferred next step.'],
        ['Business rules are checked', 'Routine questions can be answered; exceptions are marked for staff review.'],
        ['Handoff is prepared', 'The team receives an example structured request. Nothing is sent in this simulation.']
      ]
    },
    leads: {
      description: 'Follow up on inquiries quickly, qualify the opportunity, then let your team decide what happens next.',
      steps: [
        ['A new inquiry arrives', 'An approved channel supplies a lead; this example creates no real record.'],
        ['The AI asks the right questions', 'Service fit, timing and callback preference are outlined.'],
        ['Consent and qualification are checked', 'The next message depends on agreed communication and opt-in rules.'],
        ['The team receives the context', 'A sample qualified summary is prepared. No email or SMS is sent.']
      ]
    },
    dispatch: {
      description: 'Gather service location and urgency, then prepare a dispatch-ready request for staff approval.',
      steps: [
        ['A service request comes in', 'The caller describes the issue and general service area.'],
        ['Priority is identified', 'The request is categorized using business-approved urgency rules.'],
        ['Information is organized', 'A sample dispatch note includes situation, contact preference and next step.'],
        ['A human reviews routing', 'A staff member would confirm capacity and dispatch. No actual job is created.']
      ]
    },
    operations: {
      description: 'Turn repetitive requests into organized next actions, while keeping sensitive decisions with people.',
      steps: [
        ['A routine request is received', 'A permitted business form or message supplies the request.'],
        ['Relevant business rules apply', 'The system checks the right template, owner and handoff requirements.'],
        ['A draft action is prepared', 'A sample task or reply is shown for human review.'],
        ['The team approves the next step', 'Real integrations would act only with appropriate permissions. None are called here.']
      ]
    }
  });

  let verifiedBusiness = null;
  let verifiedUrl = '';
  let currentSolution = 'reception';

  const cleanText = (value, max = 200) => typeof value === 'string' ? value.trim().slice(0, max) : '';
  const cleanList = (value, max = 5) => Array.isArray(value)
    ? value.map((item) => cleanText(item)).filter(Boolean).slice(0, max)
    : [];

  function normalizeUrl(raw) {
    if (typeof raw !== 'string' || raw.length > 300) throw new Error('Enter a valid public business website.');
    const input = raw.trim();
    if (!input || /\s/.test(input) || (/^[a-z][a-z0-9+.-]*:/i.test(input) && !/^https?:\/\//i.test(input))) {
      throw new Error('Enter a valid public business website.');
    }
    const url = new URL(/^https?:\/\//i.test(input) ? input : 'https://' + input);
    const host = url.hostname.toLowerCase();
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password ||
        url.port && !['80', '443'].includes(url.port) || !host.includes('.') ||
        /^(localhost|.*\.localhost|.*\.local|.*\.internal)$/.test(host) ||
        /^\d+\.\d+\.\d+\.\d+$/.test(host) ||
        !host.split('.').every((part) => /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(part))) {
      throw new Error('Use a public business website domain, such as example.com.');
    }
    // A visitor's private query strings and deep paths never leave this studio.
    // The analyzer only needs the public business domain.
    url.pathname = '/';
    url.search = '';
    url.hash = '';
    return url.href;
  }

  function showStatus(target, message, level = '') {
    target.textContent = message;
    target.classList.remove('error', 'success');
    if (level) target.classList.add(level);
  }

  function readProfile(json, requestedUrl) {
    if (!json || json.success !== true || !json.business || typeof json.business !== 'object') {
      throw new Error('The scanner could not verify this website. Try a different public business URL.');
    }
    const item = json.business;
    const name = cleanText(item.name || item.company || item.businessName, 110);
    const result = {
      name,
      industry: cleanText(item.industry, 80),
      description: cleanText(item.description, 400),
      hours: cleanText(item.hours, 200),
      services: cleanList(item.services),
      locations: cleanList(item.locations),
      url: requestedUrl
    };
    if (!result.name && !result.description && !result.services.length) {
      throw new Error('We could not find enough public business information for a verified demo.');
    }
    return result;
  }

  function renderBusiness(profile) {
    $('#business-name').textContent = profile.name || 'Business profile';
    $('#business-summary').textContent = profile.description || 'Business details verified from the public website. Missing details are not assumed.';
    $('#business-industry').textContent = profile.industry || 'Not found';
    $('#business-hours').textContent = profile.hours || 'Not found';
    $('#business-services').textContent = profile.services.length ? profile.services.join(', ') : 'Not found';
    $('#business-locations').textContent = profile.locations.length ? profile.locations.join(', ') : 'Not found';
    $('#voice-link').href = '/?business=' + encodeURIComponent(profile.url) + '#demo';
    $('#lead-company').value = profile.name || '';
    $('#business-panel').hidden = false;
  }

  async function runScan(rawUrl) {
    const url = normalizeUrl(rawUrl);
    verifiedBusiness = null;
    verifiedUrl = '';
    $('#business-panel').hidden = true;
    const button = $('#scan-button');
    const status = $('#scan-status');
    button.disabled = true;
    showStatus(status, 'Reading public website details…');
    window.DPTrack?.('demo_started');
    try {
      const response = await fetch('https://api.dreamprotocol.ai/analyze-business', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        signal: AbortSignal.timeout(45000),
        body: JSON.stringify({ url })
      });
      if (!response.ok) throw new Error('The public website scanner is unavailable right now.');
      const data = await response.json();
      const parsed = readProfile(data, url);
      verifiedUrl = url;
      verifiedBusiness = parsed;
      renderBusiness(parsed);
      showStatus(status, 'Public website analysis complete. Review the details and try the voice demo.', 'success');
      window.DPTrack?.('demo_scanned');
      return parsed;
    } catch (error) {
      const message = error?.name === 'TimeoutError' ? 'Website scan timed out. Please try again.' :
        error?.message || 'Scan unsuccessful. Please try again.';
      showStatus(status, message, 'error');
      window.DPTrack?.('demo_scan_failed');
      throw error;
    } finally {
      button.disabled = false;
    }
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      const url = normalizeUrl($('#business-url').value);
      $('#business-url').value = url;
      await runScan(url);
    } catch (error) {
      if (!$('#scan-status').classList.contains('error')) showStatus($('#scan-status'), error?.message || 'Invalid website.', 'error');
    }
  });

  function runWorkflow(type) {
    const key = Object.prototype.hasOwnProperty.call(examples, type) ? type : 'reception';
    const scenario = examples[key];
    $('#workflow-type').value = key;
    $('#workflow-description').textContent = scenario.description;
    const list = $('#workflow-steps');
    list.replaceChildren();
    for (const step of scenario.steps) {
      const li = document.createElement('li');
      const heading = document.createElement('strong');
      const body = document.createElement('p');
      heading.textContent = step[0];
      body.textContent = step[1];
      li.append(heading, body);
      list.appendChild(li);
    }
    $('#flow-state').textContent = 'SIMULATED';
    $('#systems-touched').textContent = 'None — no real systems changed';
    return scenario.steps.map((step) => ({ title: step[0], description: step[1] }));
  }

  $('#workflow-type').addEventListener('change', (event) => {
    const scenario = examples[event.target.value] || examples.reception;
    $('#workflow-description').textContent = scenario.description;
    $('#flow-state').textContent = 'READY';
  });
  $('#run-workflow').addEventListener('click', () => runWorkflow($('#workflow-type').value));

  function selectSolution(value) {
    const key = Object.prototype.hasOwnProperty.call(startingPlans, value) ? value : 'reception';
    currentSolution = key;
    const offer = startingPlans[key];
    document.querySelectorAll('[data-solution]').forEach((button) => {
      const selected = button.dataset.solution === key;
      button.classList.toggle('active', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    $('#scope-title').textContent = offer.name;
    $('#scope-price').textContent = offer.price;
    $('#scope-setup').textContent = offer.setup;
    $('#scope-description').textContent = offer.description;
    return offer;
  }
  document.querySelectorAll('[data-solution]').forEach((button) => {
    button.addEventListener('click', () => selectSolution(button.dataset.solution));
  });

  function focusLead(solution) {
    if (solution) selectSolution(solution);
    $('#plan').scrollIntoView({ behavior: 'smooth', block: 'start' });
    $('#lead-name').focus({ preventScroll: true });
    return { message: 'Lead form ready. The visitor must enter contact details, consent and press Request my automation plan.' };
  }

  const lead = $('#live-lead-form');
  lead.addEventListener('submit', async (event) => {
    event.preventDefault();
    const status = $('#lead-status');
    if (!lead.reportValidity()) return;
    if ($('#lead-extra').value) return;
    if (!$('#lead-consent').checked) {
      showStatus(status, 'Please confirm contact permission before submitting.', 'error');
      return;
    }
    const submit = $('#lead-submit');
    const payload = {
      name: cleanText($('#lead-name').value, 100),
      email: cleanText($('#lead-email').value, 160),
      company: cleanText($('#lead-company').value, 120),
      workflow: cleanText($('#lead-goal').value, 700),
      selected_solution: startingPlans[currentSolution].name,
      source: 'Dream Protocol Live studio',
      scanned_public_website: verifiedUrl || 'Not scanned',
      _subject: 'Dream Protocol Live — automation plan request'
    };
    submit.disabled = true;
    showStatus(status, 'Sending your requested consultation details…');
    window.DPTrack?.('lead_submit');
    try {
      const response = await fetch('https://formsubmit.co/ajax/pooledlp@gmail.com', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) throw new Error('The form service is not available right now.');
      const data = await response.json();
      if (data?.success === false || data?.success === 'false') throw new Error('The form service could not accept the request.');
      showStatus(status, 'Request sent. We will reply to the work email you provided.', 'success');
      window.DPTrack?.('lead_success');
      lead.reset();
      if (verifiedBusiness?.name) $('#lead-company').value = verifiedBusiness.name;
    } catch (error) {
      showStatus(status, 'Could not send your request. Please use the contact page or try again.', 'error');
      window.DPTrack?.('lead_error');
    } finally {
      submit.disabled = false;
    }
  });

  window.DreamProtocolLive = Object.freeze({
    runScan,
    runWorkflow,
    selectSolution,
    focusLead,
    getBusiness: () => verifiedBusiness ? { ...verifiedBusiness, services: [...verifiedBusiness.services], locations: [...verifiedBusiness.locations] } : null,
    getPlans: () => structuredClone(startingPlans)
  });

  const incoming = new URLSearchParams(window.location.search).get('business');
  if (incoming) {
    try { $('#business-url').value = normalizeUrl(incoming); } catch {}
  }
})();
