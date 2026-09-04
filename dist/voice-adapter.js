import Vapi from 'https://esm.sh/@vapi-ai/web@2.5.2';

const config = window.DREAMPROTOCOL_CONFIG || {};
let vapi = null;
let listeners = [];
let completionSent = false;
let callbacks = {};

function removeListeners() {
  if (vapi) listeners.forEach(([event, handler]) => vapi.off(event, handler));
  listeners = [];
}

function listen(event, handler) {
  vapi.on(event, handler);
  listeners.push([event, handler]);
}

function complete() {
  if (completionSent) return;
  completionSent = true;
  callbacks.onState?.('ended');
  callbacks.onComplete?.();
  removeListeners();
  vapi = null;
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

window.DreamProtocolVoiceAdapter = {
  async connect({ profile, onState, onTranscript, onComplete, onError }) {
    await this.disconnect();
    if (!config.vapiPublicKey || !config.vapiAssistantId) throw new Error('Missing Vapi public browser configuration.');
    callbacks = { onState, onTranscript, onComplete, onError };
    completionSent = false;
    vapi = new Vapi(config.vapiPublicKey);
    listen('call-start', () => onState?.('connected'));
    listen('speech-start', () => onState?.('speaking'));
    listen('speech-end', () => onState?.('listening'));
    listen('call-end', complete);
    listen('message', (message) => {
      if (message?.type !== 'transcript' || message.transcriptType !== 'final' || !message.transcript) return;
      const speaker = message.role === 'user' ? 'YOU' : message.role === 'assistant' ? 'ALEX' : null;
      if (speaker) onTranscript?.({ speaker, text: message.transcript });
    });
    listen('error', (error) => {
      console.error('[Dream Protocol voice adapter] Vapi provider error.', error);
      onError?.(error);
      removeListeners();
      vapi = null;
    });
    try {
      return await vapi.start(config.vapiAssistantId, { variableValues: variables(profile) });
    } catch (error) {
      removeListeners();
      vapi = null;
      throw error;
    }
  },

  async disconnect() {
    if (!vapi) return;
    const current = vapi;
    removeListeners();
    vapi = null;
    current.stop();
    complete();
  }
};
