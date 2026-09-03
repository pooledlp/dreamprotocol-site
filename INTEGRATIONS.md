# Dream Protocol interactive integrations

The homepage is a static site. Production services are isolated behind `window.DREAMPROTOCOL_CONFIG`, which can be assigned before `app.js` loads. The page supplies the intended analyzer hostname as its default; DNS, TLS, and the reverse proxy must be deployed before enabling the production scanner:

```html
<script>
window.DREAMPROTOCOL_CONFIG = {
  businessAnalysisEndpoint: "https://api.dreamprotocol.ai/analyze-business",
  voiceSessionEndpoint: "/api/voice/session"
};
</script>
```

A deployment may override either URL with a same-origin or CORS-enabled HTTPS endpoint. Do not place provider secrets, private API keys, or durable credentials in this object or any other browser-delivered file.

## Business analysis

The browser sends:

```http
POST https://api.dreamprotocol.ai/analyze-business
Content-Type: application/json

{"url":"https://example.com/"}
```

The response uses a normalized, evidence-based contract:

```json
{
  "success": true,
  "analysisId": "short-lived-reference",
  "business": {
    "name": "North Bay Plumbing",
    "services": ["Emergency plumbing", "Drain cleaning"],
    "hours": "Mo-Fr 08:00-17:00",
    "locations": ["San Rafael, CA"]
  },
  "agent": {"name": "Alex", "role": "AI Front Desk", "greeting": "Thanks for calling North Bay Plumbing. This is Alex. How can I help you today?"},
  "found": {"identity": true, "services": true, "hours": true, "locations": true, "faq": false}
}
```

Fields not backed by extracted website evidence must be absent, empty, or have a matching `found` value of `false`. The UI displays checkmarks and knowledge categories only when these flags agree with non-empty normalized data.

The backend—not the browser—must normalize and validate URLs, allow only public HTTP/HTTPS destinations, resolve and block private/loopback/link-local/internal addresses (including redirects and DNS rebinding), enforce crawl/page/size limits and timeouts, and sanitize fetched content before model use or storage. The frontend never fetches the submitted site directly. If analysis is unavailable, it presents an explicitly generic starting profile without exposing technical errors.

## Secure voice session

The browser sends the approved preview context to `voiceSessionEndpoint`. The backend must authenticate/rate-limit as appropriate and return only short-lived, client-safe session material. Permanent Vapi, SignalWire, telephony, or model-provider secrets must remain server-side.

Provider-specific browser code belongs in a replaceable adapter, not in the page controller:

```js
window.DreamProtocolVoiceAdapter = {
  async connect({ session, onState, onComplete }) {
    // Consume the ephemeral `session` response and connect provider media.
    // Call onState("connected" | "listening" | "speaking" | "ended").
    // Call onComplete({ completedActions: [...] }) with verified outcomes only.
  },
  async disconnect() {
    // Close media and return { completedActions: [...] } if verified.
  }
};
```

The UI passes the endpoint response through to this adapter, so changing providers does not require rewriting the business-analysis or demo state flow. End-of-call actions are rendered only when returned by the adapter/session; the site does not infer CRM, appointment, or messaging outcomes.

Before production voice launch, review microphone consent, recording disclosure and jurisdictional consent requirements, retention, transcript access, deletion controls, abuse/rate limits, and session expiration.

## Lead delivery

The final contact form retains the existing FormSubmit delivery destination. It sends name, company, phone, email, workflow, source page, and FormSubmit delivery settings. If lead ownership or compliance requirements grow, replace this browser-side destination with a first-party server endpoint, add server-side validation/rate limiting, and document retention.
