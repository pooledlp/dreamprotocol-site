# Dream Protocol private analytics command center

The public site is on GitHub Pages. This separate Cloudflare Worker accepts **anonymous, non-sensitive website events** into D1 and serves a private metrics dashboard at:

**https://command.dreamprotocol.ai/**

The public, write-only collector lives at **https://metrics.dreamprotocol.ai/collect**.

## Required Cloudflare setup (not automatically deployed by this pull request)

1. In Cloudflare, use the account that manages `dreamprotocol.ai`. Have the two subdomains **metrics** and **command** proxied by Cloudflare. Do not redirect either to GitHub Pages.
2. In `analytics-worker/`, run `npx wrangler login` and `npx wrangler d1 create dreamprotocol-metrics`. Copy the D1 database ID into a real `wrangler.toml` copied from `wrangler.toml.example` (keep your account-specific file uncommitted).
3. Create the `migrations` directory and use `npx wrangler d1 migrations apply dreamprotocol-metrics --remote` to initialize the schema.
4. In Cloudflare Zero Trust > Access > Applications, create a **Self-hosted** application for **command.dreamprotocol.ai**. Permit **only your own email** via an email OTP or identity provider policy. Copy its **Application AUD Tag** and your **team-name.cloudflareaccess.com** domain.
5. Run `npx wrangler secret put ACCESS_TEAM_DOMAIN` (value: `team-name.cloudflareaccess.com`), `npx wrangler secret put ACCESS_AUD` (the Application AUD Tag), and `npx wrangler secret put ACCESS_ALLOWED_EMAIL` (the single email allowed to view dashboard).
6. Run `npx wrangler deploy`. Confirm `https://command.dreamprotocol.ai/` redirects to Cloudflare Access login and only opens when you authenticate as that email.
7. Test a page load, a CTA click, a demo scan, and a *real* test inquiry. Verify both the dashboard counts and delivery to the form recipient.

**Never route Cloudflare Access protection across the entire worker.** Protect only the `command.dreamprotocol.ai` hostname. The `metrics.dreamprotocol.ai` collector has a narrow Origin allowlist and must be reachable by the public site.

Even if Access is misconfigured or bypassed, the Worker refuses command dashboard requests unless there is a **verified Cloudflare Access JWT** with a matching audience, team issuer, signature, unexpired token, and explicitly permitted email. No password or admin token is shipped with the site.

## Tracked milestones

- Page views, anonymous session estimates, top pages and traffic sources
- CTA clicks and popular offer links
- Business-scan start/success/failure and voice-demo initiation
- Lead form attempts, successful provider acknowledgments, failed submissions
- Country (Cloudflare country code) and coarse device category

Stored fields are **event, random session ID, path, UTM campaign/source/medium, referring hostname, limited CTA classification, country, device, timestamp**. No IP address, full user agent, submitted form content, voice conversation, customer names, or scanned website URLs. Visitor DNT/GPC preference is respected client-side. New data starts **after deployment**, not retroactively.

## Dashboard verification and limits

The `Delivered leads` count means the third-party form provider acknowledged the browser request; it does **not** prove an email arrived or a sale closed. Check FormSubmit email activation, recipient inbox, and spam filters separately. The public site currently sends to the existing FormSubmit address. Do not replace it until a verified new endpoint exists.

A secret URL alone is not authentication. Cloudflare Access does the login, and the Worker validates every request. The Worker is fail-closed until those secrets and a D1 binding are correctly configured. Browser-side analytics can be blocked by users or browser extensions. Sessions are estimates and traffic can include residual bots. D1 data retention is not automatically capped; periodically delete older rows according to your privacy policy. To clear events older than 90 days:

```sql
DELETE FROM analytics_events WHERE created_at < datetime('now', '-90 days');
```

Run the maintenance query with `npx wrangler d1 execute dreamprotocol-metrics --remote --command="DELETE FROM analytics_events WHERE created_at < datetime('now', '-90 days');"`. Update the public privacy notice before turning the collection on.
