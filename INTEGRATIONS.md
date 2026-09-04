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

The replaceable `window.DreamProtocolVoiceAdapter` uses the official `@vapi-ai/web` SDK. It receives the verified scanner profile directly; it does not request a voice-session backend. The browser calls the configured assistant with these `assistantOverrides.variableValues`:

- `companyName`
- `businessWebsite`
- `businessDescription`
- `services`
- `businessHours`
- `locations`
- `businessPhone`

Except for the intentionally empty website fallback, unavailable scanner values are sent as `Not provided on the website`. This makes absence explicit to the assistant rather than fabricating context.

The adapter maps Vapi `call-start`, `speech-start`, `speech-end`, and `call-end` events into provider-neutral UI states. It accepts only final Vapi transcript messages for the visible `YOU` / `ALEX` history. Provider errors are logged to the developer console while the visitor sees a safe fallback message.

The visitor must confirm the in-page microphone notice before the adapter is initialized or Vapi is started. Ending a conversation stops Vapi and removes all SDK listeners, allowing another call in the same browser session without duplicate handlers.

### Required Vapi restrictions

The public key **MUST remain restricted in the Vapi dashboard** to:

- allowed origin `https://dreamprotocol.ai`
- allowed origin `https://www.dreamprotocol.ai`
- allowed assistant ID `30ccf544-cd70-4ba6-8b23-fcd9ff5a4fec` (Dream Protocol Demo - Alex only)

Review Vapi recording, storage, retention, and jurisdictional consent settings before launch. The page deliberately makes no recording or storage promise.

## Static bundle

The pinned SDK and esbuild versions are declared in `package.json`. Run:

```sh
npm install
npm run build
```

esbuild bundles `src/voice-adapter.js` and `@vapi-ai/web` into the browser ESM file at `dist/voice-adapter.js`; Node.js is not needed in production. The committed deployment artifact currently imports the exact pinned SDK version from esm.sh so GitHub Pages remains runnable even when this repository's restricted development proxy prevents downloading npm packages. A successful release build replaces that artifact with the self-contained bundle.

## Lead delivery

The contact form retains its existing FormSubmit delivery. If compliance requirements grow, replace it with a first-party endpoint and document validation, rate limiting, and retention.
