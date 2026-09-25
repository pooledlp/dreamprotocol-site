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

After a verified scan, the result panel loads Vapi's official HTML Script Tag SDK from jsDelivr and initializes its voice button with `window.vapiSDK.run(...)`; there is no React custom element, local Vapi SDK bundle, or custom audio/WebRTC adapter. It receives the verified scanner profile directly and does not request a voice-session backend. Before initializing the button, the browser supplies these `assistantOverrides.variableValues`:

- `companyName`
- `businessWebsite`
- `businessDescription`
- `services`
- `businessHours`
- `locations`
- `businessPhone`

Except for the intentionally empty website value, unavailable scanner values are sent as `Not provided on the website`. This makes absence explicit to the assistant rather than fabricating context. If analysis falls back rather than returning a verified profile, the voice SDK is not loaded and no button is initialized.

The HTML script-tag package creates the underlying Vapi instance, but Dream Protocol's visible button now starts and stops the call directly through that instance with `start(assistantId, assistantOverrides)` and `stop()`. This avoids proxy-clicking Vapi's hidden floating button, which can lose the original user gesture around Android microphone permission. The native floating button is hidden when it appears, but it is not required for the call to start.

The call explicitly sets `firstMessageMode: "assistant-speaks-first"` and supplies the scanned greeting as `firstMessage`. The UI listens for call-start progress, call start/end, speech start/end, and provider errors so visitors see connection state instead of a silent spinner. A 45-second watchdog stops a stalled attempt and restores a retry state.

Dream Protocol does not preflight `getUserMedia`, create or unlock an `AudioContext`, observe or mirror Vapi audio elements, or select output sinks. Microphone permission and media transport remain Vapi/browser responsibilities; only call initiation and UI state are controlled directly.

### Required Vapi restrictions

The public key **MUST remain restricted in the Vapi dashboard** to:

- allowed origin `https://dreamprotocol.ai`
- allowed origin `https://www.dreamprotocol.ai`
- allowed assistant ID `30ccf544-cd70-4ba6-8b23-fcd9ff5a4fec` (Dream Protocol Demo - Alex only)

Review Vapi recording, storage, retention, and jurisdictional consent settings before launch. The page deliberately makes no recording or storage promise.

## Static deployment

No voice build step is required. The site remains deployable directly to GitHub Pages. Run the JavaScript syntax check with:

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
