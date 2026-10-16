# Dream Protocol: Monthly Revenue Operating System

Internal operations document, October 2026. Not customer contract terms.

## Public recurring services
- AI Receptionist: from **$399/month**, setup from **$995** for a single location, with business knowledge, call flow, intake and transfer rules. Volume and overages quoted separately.
- AI Lead Follow-up: from **$499/month**, setup from **$1,500** for a lead source and one follow-up flow. Consent, CRM, SMS and email integrations scoped separately.
- Managed AI Operations: from **$750/month**, published scope includes monthly review and up to four support or improvement hours. Onboarding and larger work scoped.

These are independent offers, not a discounted bundle. Do not invent inclusions, usage limits, contract length or cancellation terms.

## Quote-to-subscription journey
1. Visitor selects a service on the monthly plans page.
2. A request enters the existing lead inbox using the dedicated form, with subscription subject and originating source. It does NOT collect payment.
3. Contact the business owner to clarify the first workflow, volume, permissions, legal/data requirements and handoff.
4. Deliver written commercial terms: one-time setup, ongoing subscription, usage allowance and overages, integration scope, payment method, contract and cancellation, support and privacy.
5. Only after customer approval activate payment, begin setup, and test failover and staff handoff before going live.
6. Review observed results after launch. Never count an inquiry as MRR.

## Stripe connection gate
Stripe is not confirmed connected. Until it is connected and the owner approves billing terms, there is NO live subscription checkout on the site. Never hard-code fake Stripe payment links or collect payment cards in a normal contact form.

When connected: create approved USD recurring products and prices, setup invoices, cancellation and failure-handling rules, and customer receipts. Keep secret keys out of GitHub. If integrating webhooks, verify signatures and use idempotency keys.

## Weekly recurring revenue dashboard
Track: qualified leads, discovery calls, proposals, accepted contracts, paying subscribers, cancellations, upgrades, live MRR, collected cash, setup revenue, per-client vendor/voice/AI costs, support time, gross margin, answer rate and human handoff performance. Record source and industry attribution.

Illustrative monthly gross recurring billing:
- Five receptionist customers: **$1,995**
- Ten receptionist customers: **$3,990**
- Five receptionist and three follow-up customers: **$3,492**
- Add two managed-operations subscriptions: **$4,992**

These are scenarios, not forecasts or profit. Actual plans are scoped, billed, renewed and canceled under approved agreements.

## Margin protection
Price to include expected voice minutes, inference, telecom, hosting, third-party integrations, support and possible usage spikes. Document what a monthly allowance actually covers. Expiring ChatGPT agentic credits are not production API usage credits and should not subsidize customer operations.

## Retention and service quality
- First week: review missed calls, failed handoffs, knowledge mistakes and routing issues.
- First month: measure response times, qualified intake, follow-up completion and exception patterns against a real baseline.
- Each quarter: check service usage, approved knowledge, pricing, customer satisfaction and renewals.
- Do not imply results, ROI, approval, or testimonials without actual evidence and permission.
- Keep sensitive patient, financial and client records out of public website tools. Healthcare deployment requires properly agreed secure workflows and BAAs.

## First reply to a subscription prospect
Subject: Your Dream Protocol monthly AI plan

Hi [first name],

Thanks for reaching out about [service] for [business]. Can we spend 15 minutes looking at the calls or repeated workflow you want to improve and the systems you use today?

Afterward I'll send a written scope showing your setup, recurring service fees, usage assumptions and human handoff, before any payment starts.

Does [two real availability options] work?

Thanks,
Dream Protocol
hello@dreamprotocol.ai

## Customer acquisition
Use FIRST-10-CUSTOMERS-PLAYBOOK.md for individualized, lawful outreach. Do not automate indiscriminate cold-email campaigns. Start with a measured pilot, collect a real result, then add an approved and accurately described customer story if permission is granted.
