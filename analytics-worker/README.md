# Dream Protocol private analytics command center

The public site is on GitHub Pages. This separate Cloudflare Worker accepts **anonymous, non-sensitive website events** into D1 and serves a private metrics dashboard at:

**https://command.dreamprotocol.ai/**

The public, write-only collector lives at **https://metrics.dreamprotocol.ai/collect**.

## One-time activation with GitHub Actions

The public site is already deployed. The analytics Worker **does not go live** until Cloudflare configuration succeeds. You can activate it entirely through GitHub and Cloudflare dashboards without a local terminal.

1. Confirm `dreamprotocol.ai` is an active Cloudflare zone and that **no existing DNS CNAMEs** conflict with `metrics.dreamprotocol.ai` or `command.dreamprotocol.ai`. The Worker now uses Cloudflare **Custom Domains**, which create records and HTTPS certificates automatically.
2. Cloudflare > Workers & Pages > D1: create a database named `dreamprotocol-metrics`. Copy the **Database ID** (UUID) into GitHub repository Settings > Secrets and variables > Actions > **Variables** as `DP_D1_DATABASE_ID`. The workflow applies database migrations.
3. Cloudflare > Zero Trust > Access > Applications: create a **Self-hosted** Access application for **only** `command.dreamprotocol.ai`. Use email OTP or your identity provider and an **allow policy for your own email only**. Copy the application's **AUD tag** and your `team-name.cloudflareaccess.com` Access team domain.
4. Create a Cloudflare API token scoped to this account with **Workers Scripts Edit, D1 Edit, Workers Routes Edit** and the **Zone: Workers Routes Edit** permission as needed for Custom Domains. In GitHub Actions **Secrets**, add `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `DP_ACCESS_TEAM_DOMAIN`, `DP_ACCESS_AUD`, and `DP_ACCESS_ALLOWED_EMAIL` (exact personal email address you allowed in the Access app). Secrets stay in GitHub, never in site JavaScript or commits.
5. In GitHub > Actions > **Deploy private analytics** > **Run workflow**, run the manual deploy. It checks prerequisites, creates a temporary Wrangler config, runs D1 migrations, deploys both custom domains, uploads the Access verification secrets, then checks public collector reachability and anonymous dashboard denial.
6. Open **https://command.dreamprotocol.ai/** and sign in through Cloudflare Access. Verify that a website visit and a CTA or demo interaction show in 7-day metrics. Submit a labeled test inquiry and check the **actual recipient inbox** before counting any customer leads.

The manual workflow fails with a readable error when any required repository configuration is absent. It never logs sensitive secret values. The Worker additionally verifies a signed Cloudflare Access JWT (issuer, audience, email, expiration and signature) on every dashboard request. Dashboard access fails closed until fully configured.

If using your own computer instead: `cd analytics-worker`, copy `wrangler.toml.example` to `wrangler.toml`, set the database UUID, run `npx wrangler d1 migrations apply dreamprotocol-metrics --remote`, `npx wrangler deploy` and set the three Access secrets with `npx wrangler secret put`.

The private collector records no page content or contact details. A daily Cloudflare cron automatically deletes data older than 90 days.

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

A secret URL alone is not authentication. Cloudflare Access does the login, and the Worker validates every request. The Worker is fail-closed until those secrets and a D1 binding are correctly configured. Browser-side analytics can be blocked by users or browser extensions. Sessions are estimates and traffic can include residual bots. D1 data is automatically purged after 90 days by the scheduled Worker cron, provided Cloudflare Cron Triggers are active. To clear events older than 90 days:

```sql
DELETE FROM analytics_events WHERE created_at < datetime('now', '-90 days');
```

Run the maintenance query with `npx wrangler d1 execute dreamprotocol-metrics --remote --command="DELETE FROM analytics_events WHERE created_at < datetime('now', '-90 days');"`. Update the public privacy notice before turning the collection on.
