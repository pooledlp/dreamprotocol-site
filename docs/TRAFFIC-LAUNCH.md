# Dream Protocol traffic launch

Prepared September 13, 2026. This change improves search discovery and inquiry attribution; it does not activate advertising or publish social posts. No traffic or ranking increase is guaranteed.

## What was found

- The live homepage had no links to four existing service pages.
- The sitemap listed only the homepage.
- Service-page contact buttons pointed to the retired `/#assessment` fragment.
- The service pages depended on a runtime Tailwind CDN and had outdated scope/copy.
- Inquiries identified the submission page but did not preserve the campaign or original landing page.
- Sitemap requests succeeded with curl but returned 403 with Python's default user agent. This is a request-specific edge response, not proof that Googlebot is blocked. Inspect Search Console URL Inspection and Cloudflare events before changing bot protection.
- No Search Console or visitor analytics data was available for this audit. Index coverage, traffic counts, search demand, and conversion rates remain unverified.

## Website changes

Refresh four service pages and add AI training and home-services receptionist pages. Publish specific, differentiated scope, current pricing, FAQs, and contact links. Include all seven commercial pages in the sitemap, add visible homepage links, use canonical URLs with trailing slashes, and add Organization/Service/Breadcrumb structured data. The unrelated BTC tool is outside this service acquisition change.

Preserve the existing demo and lead delivery. `attribution.js` keeps the campaign, landing path, and external referrer hostname in sessionStorage for the current tab and attaches them to an inquiry. It does not send pageview events or install analytics. It excludes referrer query strings and stores no form values. Use campaign labels, never customer names or email addresses, in UTM parameters. Browser storage can be disabled; the page must still work.

## Immediate promotion package

Proposed first audience: home-service owners, especially plumbing and HVAC. Confirm the priority market before paid targeting. The campaign hypothesis is that a personalized front-desk demo gives an owner a concrete reason to visit. Demand and cost estimates have not been measured.

Landing page: https://dreamprotocol.ai/ai-receptionist-for-home-services/

LinkedIn link:
https://dreamprotocol.ai/ai-receptionist-for-home-services/?utm_source=linkedin&utm_medium=organic_social&utm_campaign=front_desk_demo

Partner link:
https://dreamprotocol.ai/ai-receptionist-for-home-services/?utm_source=partner&utm_medium=referral&utm_campaign=front_desk_demo

Founder post, ready for review:

> Running a plumbing, HVAC, or other home-service business? Try an AI front desk using your own website.
>
> I built Dream Protocol’s demo so you can hear a conversation shaped around the business information it finds. The production service is scoped around your intake questions, call routing, and team handoffs.
>
> Enter your website and try it: [use the LinkedIn link above]
>
> Front-desk service starts at $399/month, with setup from $995. Usage and integrations are quoted upfront. I’d like feedback from owners on which calls take the most time to handle.

Partner outreach draft, only for appropriate existing contacts and only after explicit send authorization:

> I’m building AI front desks for small businesses through Dream Protocol. There’s a demo that starts with a business website and lets the owner try a conversation based on the information it finds. If you work with plumbing or HVAC owners who struggle with call intake, would you be open to trying it and telling me where the handoff needs improvement? [use the partner link above]

Suggested 72-hour sequence, subject to publishing/account access:

1. Verify the deployed landing pages, sitemap, and contact flow. Use Search Console URL Inspection to check live accessibility, then submit the sitemap and request indexing of the main landing page. This is a discovery request, not a ranking guarantee.
2. Publish one founder demo post with the tracked LinkedIn link. Show an actual demo recording with permission to use the business example; make no invented outcome claims.
3. Share the partner link with relevant existing contacts after authorizing outreach. If posting in a trade community, follow its promotion rules and answer a concrete intake question.
4. Review actual inquiries and manually label qualified leads. Keep the audience and offer focused until there is evidence to expand.

Do not activate paid ads until region, budget, account, and conversion measurement are confirmed. Neither money nor authorization from another task is assumed here.

## Measurement and next actions

Primary outcome: qualified inquiry or booked conversation, manually verified. A demo click is not a lead. Attribution now appears in form delivery; visitors without inquiries remain unmeasured. Connect the owner's analytics property before assessing page-to-lead conversion rates. Verify actual inbox receipt separately; automated checks simulate the provider and do not send messages.

Search Console actions require access to the verified domain property. Compare impressions, clicks, queries, and indexed pages over the following weeks. Investigate exclusions before adding more pages. Do not create city pages without real local service information or claim ratings/testimonials that do not exist.

References:
- Google SEO Starter Guide: https://developers.google.com/search/docs/fundamentals/seo-starter-guide
- Request recrawling: https://developers.google.com/search/docs/crawling-indexing/ask-google-to-recrawl
- Sitemap submission and lastmod guidance: https://developers.google.com/search/blog/2023/06/sitemaps-lastmod-ping

## Validation before publishing

- All seven sitemap pages passed canonical, single-H1, JSON-LD parsing, and internal link/fragment checks.
- All seven pages passed Chromium checks at 390px and 1440px, with no horizontal overflow or browser exceptions.
- Simulated successful and failed inquiries passed; failure retained the entered details. No actual test email was sent.
- Campaign attribution survived service-page-to-homepage navigation. A new campaign cleared stale campaign fields. Blocked browser storage did not break the page.
- JavaScript syntax checks passed for the application and attribution scripts; the homepage uses the updated content-hashed application asset.
- Live voice calls and actual email delivery were not exercised by these checks.
