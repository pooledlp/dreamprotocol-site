# DreamProtocol interactive demo integrations

The homepage remains a static, deployable site. Its interactive product UI is deliberately separated from production services through `window.DREAMPROTOCOL_CONFIG`.

## Business analysis

Set `businessAnalysisEndpoint` at runtime to a same-origin or CORS-enabled HTTPS endpoint:

```html
<script>
window.DREAMPROTOCOL_CONFIG = {
  businessAnalysisEndpoint: "/api/analyze-business",
  voiceSessionEndpoint: "/api/voice/session"
};
</script>
```

`POST businessAnalysisEndpoint` receives:

```json
{ "url": "https://example.com" }
```

The server should validate the URL, block private/internal network targets, crawl only permitted public pages, and return verified business data. The current UI consumes `company` and `greeting`; the integration can be expanded to industry, services, hours, location, FAQs, and contact details. When this endpoint is absent, the page explicitly presents sample configuration data rather than representing it as a real scan.

## Browser voice

`POST voiceSessionEndpoint` receives the selected company, role, voice, and greeting. It must create a short-lived browser session with the selected provider (for example, Vapi) and return only ephemeral client-safe connection data. Provider private keys must stay on the server. The browser UI does not simulate a successful production conversation when the endpoint is absent.

The production integration still needs to connect the returned provider session to WebRTC/audio, forward provider status and transcript events into the UI, and map the provider's end-of-call report into the summary. Microphone consent, retention notices, consent-to-record requirements, and deletion controls should be reviewed before launch.

## Lead delivery and analytics

Lead delivery continues through the existing FormSubmit destination. The concise form adds source page, selected industry, entered website, ROI inputs, demo completion, and a non-sensitive session identifier.

The site emits every conversion event both to `window.dataLayer` (when one is already present) and as a `dreamprotocol:analytics` browser event. This avoids adding a second analytics vendor. A tag manager can consume:

- `hero_build_ai_clicked`
- `talk_to_ai_clicked`
- `website_scan_started`
- `website_scan_completed`
- `demo_started`
- `demo_completed`
- `roi_calculated`
- `lead_form_started`
- `lead_submitted`

Calendar events should be wired when a calendar provider is selected; no calendar integration exists in this repository today.
