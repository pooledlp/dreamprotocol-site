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

The result panel embeds Vapi's official Web Widget in voice mode. The widget script is pinned to `@vapi-ai/client-sdk-react@0.3.1` and loaded from unpkg; there is no local Vapi SDK bundle or custom audio/WebRTC adapter. It receives the verified scanner profile directly and does not request a voice-session backend. Before mounting the widget, the browser serializes these `assistantOverrides.variableValues`:

- `companyName`
- `businessWebsite`
- `businessDescription`
- `services`
- `businessHours`
- `locations`
- `businessPhone`

Except for the intentionally empty website value, unavailable scanner values are sent as `Not provided on the website`. This makes absence explicit to the assistant rather than fabricating context. If analysis falls back rather than returning a verified profile, the voice widget is not mounted.

The widget owns microphone permission, audio playback, call controls, and its visible transcript. It uses dark mode, Dream Protocol's blue and lime accent colors, full size, and the widget's supported consent prompt. Provider `error` events are logged to the developer console while the visitor sees a short retry message.

Dream Protocol does not preflight `getUserMedia`, create or unlock an `AudioContext`, observe or mirror Vapi audio elements, select output sinks, or implement browser-specific recovery. Browser media behavior is delegated to Vapi's supported widget.

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
2. Select the widget's start control, accept its consent step, allow the normal browser microphone prompt, and confirm the call begins.
3. Confirm Alex is audible, user microphone audio reaches Alex, and the widget displays the transcript.
4. Ask “What services do you offer?” and confirm the response uses the scanned services rather than invented information.
5. End and start a second call without reloading. Also test permission already allowed and explicitly blocked using the widget's standard recovery experience.

## Lead delivery

The contact form retains its existing FormSubmit delivery. If compliance requirements grow, replace it with a first-party endpoint and document validation, rate limiting, and retention.
