import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');
const live = read('live/index.html');
const controller = read('assets/live.js');
const webmcp = read('assets/webmcp.js');
const build = read('scripts/build.mjs');
const app = read('app.js');

test('Live Studio preserves accessible, consent-based flow', () => {
  for (const id of [
    'scan-form', 'business-url', 'scan-status', 'business-panel',
    'voice-link', 'workflow-type', 'workflow-steps', 'run-workflow',
    'scope-title', 'live-lead-form', 'lead-email', 'lead-consent', 'lead-status'
  ]) assert(live.includes('id="' + id + '"'), 'Missing Live Studio control: ' + id);
  assert(live.includes('type="checkbox" required'), 'Consent checkbox must be required');
  assert(live.includes('aria-live="polite"'), 'Status changes should be announced to assistive tech');
  assert(live.includes('/assets/live.js') && live.includes('/assets/webmcp.js'));
  assert.equal((live.match(/<h1(?:\s|>)/g) || []).length, 1);
});

test('Business scanner uses verified backend and never invents a fallback profile', () => {
  assert(controller.includes('https://api.dreamprotocol.ai/analyze-business'));
  assert(controller.includes('json.success !== true'));
  assert(controller.includes('Not found'));
  assert(!controller.includes('fallbackProfile('));
  assert(controller.includes('textContent'));
  assert(!controller.includes('innerHTML'), 'Untrusted business fields must not be rendered as HTML');
});

test('Voice demo reuses existing Vapi assistant with explicit start gesture', () => {
  assert(controller.includes("'/?business='"));
  assert(app.includes('incomingDemoWebsite'));
  assert(app.includes('websiteForm.requestSubmit()'));
  assert(app.includes('alexVapi.start(config.vapiAssistantId, widgetOverrides(profile))'));
});

test('Workflow demos do not execute external actions', () => {
  assert(controller.includes('None — no real systems changed'));
  assert(controller.includes('No email or SMS is sent.'));
  assert(controller.includes('No actual job is created.'));
  assert(controller.includes('simulation'));
});

test('Live inquiry needs visitor submission and includes approved offer scope', () => {
  assert(controller.includes("lead.addEventListener('submit'"));
  assert(controller.includes("$('#lead-consent').checked"));
  assert(controller.includes('https://formsubmit.co/ajax/pooledlp@gmail.com'));
  assert(controller.includes("window.DPTrack?.('lead_success')"));
  assert(controller.includes("selected_solution"));
});

test('WebMCP exposes six safe tools with progressive enhancement', () => {
  assert(webmcp.includes("document.modelContext?.registerTool"));
  assert(!webmcp.includes('navigator.modelContext'));
  const names = ['analyze_business', 'build_demo_agent', 'compare_solutions',
    'estimate_pricing', 'simulate_workflow', 'request_consultation'];
  for (const name of names) assert(webmcp.includes("name: '" + name + "'"));
  assert(webmcp.includes('submitted: false'));
  assert(webmcp.includes('systemsModified: 0'));
});

test('Site builder publishes Live Studio without replacing existing homepage', () => {
  assert(build.includes("pages.push({slug:'live',url:origin+'/live/'});"));
  assert(build.includes('href="/live/"'));
  assert(build.includes('src="/assets/webmcp.js"'));
});
