# DreamPredict Edge Scheduler

Cloudflare-native background scheduler for DreamPredict.

## What it does

- Runs every minute through a Cloudflare Cron Trigger.
- Calls the real DreamPredict scan endpoint even when no dashboard is open.
- Enforces a 45-second timeout so one scan cannot hang indefinitely.
- Emits structured Worker logs with market counts, strict cross-venue matches, qualified arbs, and shadow captures.
- Exposes only a read-only `/health` endpoint. There is no public endpoint that can trigger a scan.

## Deploy

From this directory:

```bash
npm install
npx wrangler login
npm run check
npm run deploy
```

Cloudflare should then show the cron `* * * * *` under Worker Settings > Triggers > Cron Triggers.

Test locally:

```bash
npm run dev
curl "http://localhost:8787/cdn-cgi/local/scheduled?format=json"
```

## Cutover

Keep `.github/workflows/dreampredict-scan.yml` enabled until this Worker has completed successful scheduled runs. After Cloudflare Cron is verified, remove or disable the GitHub heartbeat to avoid redundant scans.

## Best final architecture

This scheduler is a bridge because the production API Worker source is not currently in this repository. The final version should move the same `scheduled()` handler into the Worker that already owns `/dream-predict/scan` and call the scan function directly instead of making an HTTP hop.
