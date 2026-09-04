import Vapi from '@vapi-ai/web';

const config = window.DREAMPROTOCOL_CONFIG || {};
const AUDIO_LOG = '[Dream Protocol audio]';
const SILENT_WAV = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQQAAACAgICA';
let vapi = null;
let listeners = [];
let completionSent = false;
let callbacks = {};
let audioContext = null;
let audioObserver = null;
let remoteAudio = new Set();
let audioElementsAtStart = new Set();

function diagnostic(message, details) {
  if (details === undefined) console.debug(AUDIO_LOG, message);
  else console.debug(AUDIO_LOG, message, details);
}

function isMobileBrowser() {
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

function removeListeners(instance = vapi) {
  if (instance) listeners.forEach(([event, handler]) => instance.off(event, handler));
  listeners = [];
}

function listen(event, handler) {
  vapi.on(event, handler);
  listeners.push([event, handler]);
}

async function closeAudioContext() {
  const context = audioContext;
  audioContext = null;
  if (context && context.state !== 'closed') {
    try { await context.close(); } catch (error) { diagnostic('AudioContext close failed.', error); }
  }
}

function resetRemoteAudio() {
  audioObserver?.disconnect();
  audioObserver = null;
  remoteAudio.clear();
  audioElementsAtStart.clear();
}

async function playRemoteAudio(audio) {
  remoteAudio.add(audio);
  audio.autoplay = true;
  audio.muted = false;
  audio.playsInline = true;
  audio.setAttribute('playsinline', '');
  audio.setAttribute('webkit-playsinline', '');
  diagnostic('Remote audio element detected.', {
    paused: audio.paused,
    muted: audio.muted,
    readyState: audio.readyState
  });
  try {
    await audio.play();
    diagnostic('Remote audio play() succeeded.', { paused: audio.paused, readyState: audio.readyState });
    callbacks.onAudioReady?.();
    return true;
  } catch (error) {
    diagnostic('Remote audio play() failed.', { name: error?.name, message: error?.message });
    if (error?.name === 'NotAllowedError') callbacks.onAudioBlocked?.();
    return false;
  }
}

function considerAudio(audio) {
  if (!(audio instanceof HTMLAudioElement) || audioElementsAtStart.has(audio) || remoteAudio.has(audio)) return;
  // Daily creates these elements after call setup. Ignoring every pre-existing element
  // keeps the prerecorded example player outside this compatibility workaround.
  void playRemoteAudio(audio);
}

function observeRemoteAudio() {
  audioElementsAtStart = new Set(document.querySelectorAll('audio'));
  audioObserver?.disconnect();
  audioObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (!(node instanceof Element)) continue;
        if (node.matches('audio')) considerAudio(node);
        node.querySelectorAll?.('audio').forEach(considerAudio);
      }
    }
  });
  audioObserver.observe(document.body, { childList: true, subtree: true });
}

async function complete() {
  if (completionSent) return;
  completionSent = true;
  const instance = vapi;
  removeListeners(instance);
  vapi = null;
  resetRemoteAudio();
  await closeAudioContext();
  callbacks.onState?.('ended');
  callbacks.onComplete?.();
}

function variables(profile) {
  const business = profile?.business || {};
  const unavailable = 'Not provided on the website';
  return {
    companyName: profile?.company || unavailable,
    businessWebsite: business.website || '',
    businessDescription: business.description || unavailable,
    services: business.services?.length ? business.services.join(', ') : unavailable,
    businessHours: business.hours || unavailable,
    locations: business.locations?.length ? business.locations.join(', ') : unavailable,
    businessPhone: business.phone || unavailable
  };
}

async function unlockAudioPlayback() {
  diagnostic('Browser environment.', { userAgent: navigator.userAgent, mobile: isMobileBrowser() });
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  const pending = [];
  if (AudioContextClass) {
    try {
      if (!audioContext || audioContext.state === 'closed') audioContext = new AudioContextClass();
      diagnostic('AudioContext before resume.', audioContext.state);
      if (audioContext.state === 'suspended') pending.push(audioContext.resume());
      const source = audioContext.createBufferSource();
      source.buffer = audioContext.createBuffer(1, 1, 22050);
      source.connect(audioContext.destination);
      source.start(0);
    } catch (error) {
      diagnostic('Web Audio unlock was unavailable.', error?.name);
    }
  }
  const silentAudio = new Audio(SILENT_WAV);
  silentAudio.muted = true;
  silentAudio.playsInline = true;
  silentAudio.setAttribute('playsinline', '');
  silentAudio.setAttribute('webkit-playsinline', '');
  pending.push(silentAudio.play().catch((error) => diagnostic('Silent media unlock was declined.', error?.name)));
  await Promise.allSettled(pending);
  silentAudio.pause();
  silentAudio.removeAttribute('src');
  diagnostic('AudioContext after resume.', audioContext?.state || 'unavailable');
}

window.DreamProtocolVoiceAdapter = {
  unlockAudioPlayback,

  async enableSound() {
    await unlockAudioPlayback();
    const results = await Promise.all([...remoteAudio].map(playRemoteAudio));
    const succeeded = results.some(Boolean) || [...remoteAudio].some((audio) => !audio.paused);
    if (succeeded) callbacks.onAudioReady?.();
    return succeeded;
  },

  async connect({ profile, onState, onTranscript, onComplete, onError, onAudioBlocked, onAudioReady }) {
    if (vapi) await this.disconnect();
    resetRemoteAudio();
    if (!config.vapiPublicKey || !config.vapiAssistantId) throw new Error('Missing Vapi public browser configuration.');
    callbacks = { onState, onTranscript, onComplete, onError, onAudioBlocked, onAudioReady };
    completionSent = false;
    vapi = new Vapi(config.vapiPublicKey);
    observeRemoteAudio();
    listen('call-start', () => {
      diagnostic('Vapi call-start.');
      onState?.('connected');
    });
    listen('call-start-progress', (event) => diagnostic('Vapi startup progress.', event));
    listen('call-start-success', (event) => diagnostic('Vapi startup succeeded.', event));
    listen('call-start-failed', (event) => diagnostic('Vapi startup failed.', event));
    listen('volume-level', (volume) => diagnostic('Remote volume level.', volume));
    listen('speech-start', () => onState?.('speaking'));
    listen('speech-end', () => onState?.('listening'));
    listen('call-end', () => void complete());
    listen('message', (message) => {
      if (message?.type !== 'transcript' || message.transcriptType !== 'final' || !message.transcript) return;
      const speaker = message.role === 'user' ? 'YOU' : message.role === 'assistant' ? 'ALEX' : null;
      if (speaker) onTranscript?.({ speaker, text: message.transcript });
    });
    listen('error', (error) => {
      console.error(AUDIO_LOG, 'Vapi error payload.', error);
      onError?.(error);
      const instance = vapi;
      removeListeners(instance);
      vapi = null;
      resetRemoteAudio();
      void closeAudioContext();
    });
    try {
      return await vapi.start(config.vapiAssistantId, { variableValues: variables(profile) });
    } catch (error) {
      const instance = vapi;
      removeListeners(instance);
      vapi = null;
      resetRemoteAudio();
      await closeAudioContext();
      throw error;
    }
  },

  async disconnect() {
    const current = vapi;
    if (current) {
      removeListeners(current);
      vapi = null;
      current.stop();
    }
    if (!completionSent && current) {
      completionSent = true;
    }
    resetRemoteAudio();
    await closeAudioContext();
    if (current) {
      callbacks.onState?.('ended');
      callbacks.onComplete?.();
    }
  }
};
