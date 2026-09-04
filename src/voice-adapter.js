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
let outputAudio = null;
let remoteAudio = null;
let remoteSourceTimer = null;

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
  if (remoteSourceTimer) clearInterval(remoteSourceTimer);
  remoteSourceTimer = null;
  if (outputAudio) {
    outputAudio.pause();
    outputAudio.srcObject = null;
    outputAudio.removeAttribute('src');
    outputAudio.remove();
  }
  outputAudio = null;
  remoteAudio = null;
}

async function playOutputAudio(vapiAudio = remoteAudio) {
  if (!outputAudio?.srcObject) return false;
  try {
    outputAudio.muted = false;
    await outputAudio.play();
    diagnostic('output sink play success');
    if (vapiAudio) vapiAudio.muted = true;
    callbacks.onAudioReady?.();
    return true;
  } catch (error) {
    diagnostic('output sink play failure', { name: error?.name, message: error?.message });
    if (error?.name === 'NotAllowedError') callbacks.onAudioBlocked?.();
    return false;
  }
}

function attachRemoteStream(audio) {
  if (!outputAudio || !audio.srcObject) return false;
  outputAudio.removeAttribute('src');
  outputAudio.srcObject = audio.srcObject;
  diagnostic('remote srcObject attached');
  if (remoteSourceTimer) clearInterval(remoteSourceTimer);
  remoteSourceTimer = null;
  void playOutputAudio(audio);
  return true;
}

function considerAudio(audio) {
  if (!(audio instanceof HTMLAudioElement) || audio === remoteAudio) return;
  remoteAudio = audio;
  diagnostic('Vapi remote player detected');
  if (attachRemoteStream(audio)) return;
  // srcObject is a property, so setting it does not produce an observable DOM mutation.
  // Poll briefly after the SDK mounts its player to catch the remote track arriving.
  if (remoteSourceTimer) clearInterval(remoteSourceTimer);
  let attempts = 0;
  remoteSourceTimer = setInterval(() => {
    attempts += 1;
    if (attachRemoteStream(audio) || attempts >= 300) {
      clearInterval(remoteSourceTimer);
      remoteSourceTimer = null;
    }
  }, 100);
}

function observeRemoteAudio() {
  audioObserver?.disconnect();
  audioObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (!(node instanceof Element)) continue;
        if (node.matches('audio[data-participant-id]')) considerAudio(node);
        node.querySelectorAll?.('audio[data-participant-id]').forEach(considerAudio);
      }
    }
  });
  audioObserver.observe(document.body, { childList: true, subtree: true });
  document.querySelectorAll('audio[data-participant-id]').forEach(considerAudio);
}

async function complete() {
  if (completionSent) return;
  completionSent = true;
  const instance = vapi;
  removeListeners(instance);
  vapi = null;
  instance?.stop();
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
  resetRemoteAudio();
  outputAudio = document.createElement('audio');
  outputAudio.autoplay = true;
  outputAudio.playsInline = true;
  outputAudio.muted = false;
  outputAudio.setAttribute('playsinline', '');
  outputAudio.setAttribute('webkit-playsinline', '');
  outputAudio.setAttribute('aria-hidden', 'true');
  outputAudio.style.display = 'none';
  outputAudio.src = SILENT_WAV;
  document.body.append(outputAudio);
  diagnostic('output sink created');

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
  pending.push(outputAudio.play().catch((error) => diagnostic('Silent media unlock was declined.', { name: error?.name, message: error?.message })));
  await Promise.allSettled(pending);
  outputAudio?.pause();
  diagnostic('AudioContext after resume.', audioContext?.state || 'unavailable');
}

window.DreamProtocolVoiceAdapter = {
  unlockAudioPlayback,

  async enableSound() {
    return playOutputAudio();
  },

  async connect({ profile, onState, onTranscript, onComplete, onError, onAudioBlocked, onAudioReady }) {
    if (vapi) await this.disconnect();
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
      instance?.stop();
      resetRemoteAudio();
      void closeAudioContext();
    });
    const instance = vapi;
    try {
      const result = await instance.start(config.vapiAssistantId, { variableValues: variables(profile) });
      if (!result) throw new Error('Vapi call did not start.');
      return result;
    } catch (error) {
      removeListeners(instance);
      if (vapi === instance) vapi = null;
      instance.stop();
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
