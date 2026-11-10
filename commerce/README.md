# Dream Commerce — autonomous retail product lab

A separate Dream Protocol commerce experiment at \`https://dreamprotocol.ai/commerce/\`. Built as a research-only preview. The company website, Vapi voice demonstration, and current AI products stay untouched.

## Current implementation
- Mobile-responsive candidate catalog with real category filters and test-potential sorting; no fake prices, fake testimonials, counterfeit listings, or checkout.
- Research data in \`catalog.json\`. Every candidate is marked **unverified** and no order can be placed.
- \`engine.mjs\` scores candidates, prepares Three short-form / Pinterest / SEO marketing briefs, and writes machine-readable output at \`generated/marketing-plan.json\` and \`generated/campaign-drafts.csv\`.
- GitHub Actions draft-generation task can refresh these artifacts every day without posting or spending anything.
- Separate e-commerce lead flow returns business owners to Dream Protocol's existing contact system.

## Full-autopilot integration plan
1. Connect and activate a Shopify merchant account and connect a custom subdomain such as shop.dreamprotocol.ai.
2. Import products ONLY after obtaining supplier permission, ordering/verifying samples, confirming shipping areas and timeframes, and calculating contribution margin.
3. Shopify manages live checkout, payments, fraud checks and orders; supplier dropship/Collective integration synchronizes approved inventory, shipping and tracking.
4. A server-side AI operator, preferably Cloudflare Workers with durable queues and an audit log, subscribes to authenticated Shopify webhooks. Shopify webhooks must be HMAC-verified and idempotent, and secrets must never be in public GitHub Pages files.
5. AI drafts FAQ answers and marketing creative; approved platform integrations handle compliant posting and customer messaging. Customer-service escalation, refund policy, and advertising approvals require business rules.
6. Run a contribution-profit calculation per SKU and campaign: net sales minus landed product costs, shipping, payment fees, refunds, creator commission and advertising. Shut off scheduled spending automatically at predefined caps.
7. Use real attributed visits, conversion, refund rate, delivery delays, chargebacks, and support load to inform weekly product decisions.
8. Record transparent operations metrics (with no sensitive customer info) for Dream Protocol's B2B automation demo.

## Rules
The shop is not live until the merchant platform, fulfillment, payments and policies are connected and tested. Access to a GitHub repo does not grant access to Shopify, Meta, TikTok, Google Merchant Center, or supplier accounts. Do not invent checkout buttons or implied stock. Do not buy ads without an explicit spend limit. Avoid misleading claims, bogus reviews, non-consensual messaging, and intellectual-property violations.

## Development
- Run \`node commerce/engine.mjs\` to generate campaign drafts.
- Existing website's GitHub Pages packaging must copy \`commerce/\` into \`_site/commerce/\`.
- \`commerce/index.html\` is intentionally \`noindex\` until the store is connected and ready.

## November 9: focused test launch
The public research preview now contains only three candidate concepts: an astronaut galaxy projector, a touch-activated flapping bird cat toy, and an interactive rolling cat ball. **None is an imported offer**. Shopify Collective import controls must be used by the merchant on the curated Shopify shelf; do not recreate supplier items with product creation APIs. See `launch-playbook.md` for creative, economic and operational gates.
