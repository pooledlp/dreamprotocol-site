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

Refresh four service pages and add AI training and home-services receptionist pages. Publish specific, differentiated scope, current pricing, FAQs, and contact links. Include the original seven commercial pages in the sitemap, add visible homepage links, use canonical URLs with trailing slashes, and add Organization/Service/Breadcrumb structured data. The unrelated BTC tool is outside this service acquisition change.

Preserve the existing demo and lead delivery. `attribution.js` keeps the campaign, landing path, and external referrer hostname in sessionStorage for the current tab and attaches them to an inquiry. It does not send pageview events or install analytics. It excludes referrer query strings and stores no form values. Use campaign labels, never customer names or email addresses, in UTM parameters. Browser storage can be disabled; the page must still work.

## Bay Area promotion package

Confirmed by the owner: the entire San Francisco Bay Area, all business audiences, explicitly including tax companies, CPAs, accounting firms, and bookkeepers. Include all nine counties: San Francisco, San Mateo, Santa Clara, Alameda, Contra Costa, Marin, Sonoma, Napa, and Solano. The homepage and regional page welcome businesses across industries; home services are one audience, not the exclusive target.

Regional landing page: https://dreamprotocol.ai/bay-area-ai-services/

Use a relevant example for each audience while keeping the same regional coverage. These are campaign hypotheses, not verified search demand or conversion forecasts.

| Audience | Message | Campaign content label | Page section |
| --- | --- | --- | --- |
| Home services | Capture service requests while the crew is working. | home_services | home-services |
| Medical/dental | Organize administrative callbacks and reviewable staff handoffs. | medical_dental | medical-dental |
| Tax firms, CPAs, accounting and bookkeeping | Organize client intake, document requests, and routine admin follow-ups. | tax_accounting | tax-accounting |
| Professional services | Reduce repeated drafting and new-client admin. | professional_services | professional-services |
| Property/facilities | Route maintenance requests with useful context. | property_facilities | property-facilities |
| Retail/hospitality | Handle routine questions and connect internal handoffs. | retail_hospitality | retail-hospitality |
| Other businesses, nonprofits, education teams | Bring a repeated task or team AI training need. | other_businesses | other-businesses |

### Tracked links

General founder post:
https://dreamprotocol.ai/bay-area-ai-services/?utm_source=linkedin&utm_medium=organic_social&utm_campaign=bay_area_ai&utm_content=all_businesses

Partner referral:
https://dreamprotocol.ai/bay-area-ai-services/?utm_source=partner&utm_medium=referral&utm_campaign=bay_area_ai&utm_content=all_businesses

For each audience, replace `utm_content=all_businesses` with its campaign content label and append the page section, e.g.:
https://dreamprotocol.ai/bay-area-ai-services/?utm_source=linkedin&utm_medium=organic_social&utm_campaign=bay_area_ai&utm_content=medical_dental#medical-dental

### Founder post, ready for review

> Bay Area business owners: where is your team losing time to repeat work?
>
> I built Dream Protocol to help businesses train their teams on AI, connect existing tools, automate routine handoffs, and set up AI front desks.
>
> Whether you run a tax company, CPA or bookkeeping firm, law office, agency, store, restaurant, service business, or any other business, the starting point is the same: bring one task you want to improve.
>
> You can also try a front-desk demo using your own business website. Explore the options here: [use the general founder link above]
>
> Serving the entire San Francisco Bay Area. Workshops are $750; AI front desks start at $399/month with setup from $995. Scope, usage, and integrations are agreed upfront.

### Partner message draft

> I’m building practical AI services for businesses across the Bay Area through Dream Protocol: team training, workflow automation, integrations, and AI front desks. If a business you work with has a repeated admin task or a team training need, I’d welcome an introduction. There’s also a website-based front-desk demo they can try here: [use the partner link above]

### Suggested launch sequence

1. Verify the regional page in Search Console and submit the expanded sitemap. Request indexing of the regional page after checking accessibility.
2. Publish the general founder post, then rotate audience-specific examples using the corresponding tracked links. Keep the full Bay Area as the region for every audience.
3. Use the partner draft with relevant existing contacts after explicit send authorization. Adapt any community post to its audience and promotion rules.
4. Label actual inquiries by audience and requested service. Compare qualified conversations, not just clicks. Coverage stays broad; messaging can improve from observed results.

Region and audience scope are now confirmed. Paid-ad budget, account access, and conversion measurement remain unconfirmed in this task. No ads, social posts, or outreach are activated by this document.

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

## Bay Area expansion

Added a regional page covering all nine Bay Area counties and seven audience examples, including a general invitation for other businesses. Added homepage regional copy, service-page links, and areaServed metadata. Sitemap now contains eight commercial pages. No physical office address or local business listing is asserted.
