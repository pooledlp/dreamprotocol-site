# Dream Protocol interactive integrations

The homepage remains a static GitHub Pages site. Browser-safe production settings live in `window.DREAMPROTOCOL_CONFIG` before `app.js` loads:

```js
window.DREAMPROTOCOL_CONFIG = {
  businessAnalysisEndpoint: "https://api.dreamprotocol.ai/analyze-business",
  vapiPublicKey: "ec40770e-0ff1-482c-929e-5288315e24b1",
  vapiAssistantId: "30ccf544-cd70-4ba6-8b23-fcd9ff5a4fec"
};
```

`vapiPublicKey` is intentionally a **public browser key**, not a server credential. Never put a Vapi private key, an OpenAI key, or any other provider secret in browser-delivered files.

## Business analysis

The scanner sends `{"url":"https://example.com/"}` to `https://api.dreamprotocol.ai/analyze-business`. The analysis service must return evidence-based business fields. Missing fields remain empty; the browser does not invent them. The backend remains responsible for URL validation, SSRF protection, crawl limits, content sanitization, and CORS.

## Vapi browser voice

After a verified scan, the result panel loads a same-origin browser bundle of the pinned official Vapi Web SDK (`@vapi-ai/web@2.7.1`) from `/assets/vapi.bundle.js` and creates a Vapi instance with the browser-safe public key. The bundle is produced at build time with esbuild. Dream Protocol does not use the older HTML script-tag wrapper or a runtime cross-origin module import. The current SDK receives the verified scanner profile directly and does not request a voice-session backend. Before starting the call, the browser supplies these `assistantOverrides.variableValues`:

- `companyName`
- `businessWebsite`
- `businessDescription`
- `services`
- `businessHours`
- `locations`
- `businessPhone`

Except for the intentionally empty website value, unavailable scanner values are sent as `Not provided on the website`. This makes absence explicit to the assistant rather than fabricating context. If analysis falls back rather than returning a verified profile, the voice SDK is not loaded and no button is initialized.

Dream Protocol's visible button starts and stops the current Vapi Web SDK directly with `start(assistantId, assistantOverrides)` and `stop()`. This preserves the original Android user gesture across microphone permission instead of proxy-clicking a hidden widget button.

The call explicitly sets `firstMessageMode: "assistant-speaks-first"` and supplies the scanned greeting as `firstMessage`. The UI listens for call-start progress, call start/end, assistant audio attachment, speech start/end, and provider errors. On audio attachment, Dream Protocol explicitly unmutes the SDK's audio player, sets playback volume to 1.0, requests the default output sink when supported, and retries `play()` if the element is paused. If the SDK reports `audio-start-failed`, the call is stopped and the visitor gets a fresh "Try audio" gesture. A 45-second watchdog handles stalled connections.

Dream Protocol does not create a second WebRTC stack or replace Vapi's media transport. Microphone capture, assistant media transport, and remote track creation remain Vapi/browser responsibilities; Dream Protocol only controls call initiation, playback readiness, volume, and UI state.

### Required Vapi restrictions

The public key **MUST remain restricted in the Vapi dashboard** to:

- allowed origin `https://dreamprotocol.ai`
- allowed origin `https://www.dreamprotocol.ai`
- allowed assistant ID `30ccf544-cd70-4ba6-8b23-fcd9ff5a4fec` (Dream Protocol Demo - Alex only)

Review Vapi recording, storage, retention, and jurisdictional consent settings before launch. The page deliberately makes no recording or storage promise.

## Static deployment

The site build bundles the pinned Vapi Web SDK before generating pages. GitHub Actions installs the declared npm dependencies, runs the bundle step, validates the resulting same-origin asset, and then packages it with the rest of the static site. Run the JavaScript syntax check with:

```sh
npm run check
```

### Voice browser QA

Test on a secure origin in Edge desktop, Chrome desktop, Firefox desktop, Safari desktop, Chrome Android, Chrome iOS, and Safari iPhone:

1. Scan `https://pannuholistic.com` and confirm its verified company, services, description, and available contact/location data appear in the preview.
2. Select the `Talk with Alex` button, allow the normal browser microphone prompt, and confirm the call begins.
3. Confirm Alex is audible and user microphone audio reaches Alex.
4. Ask “What services do you offer?” and confirm the response uses the scanned services rather than invented information.
5. End and start a second call without reloading. Also test permission already allowed and explicitly blocked using the widget's standard recovery experience.

## Lead delivery

The contact form retains its existing FormSubmit delivery. If compliance requirements grow, replace it with a first-party endpoint and document validation, rate limiting, and retention.
