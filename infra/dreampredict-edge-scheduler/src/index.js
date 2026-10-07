const DEFAULT_SCAN_URL = 'https://api.dreamprotocol.ai/dream-predict/scan';
const TIMEOUT_MS = 45_000;

async function runScan(env, trigger = 'cron') {
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort('scan timeout'), TIMEOUT_MS);

  try {
    const response = await fetch(env.SCAN_URL || DEFAULT_SCAN_URL, {
      method: 'GET',
      headers: {
        'accept': 'application/json',
        'user-agent': 'DreamPredict-Edge-Scheduler/1.0'
      },
      cf: { cacheTtl: 0, cacheEverything: false },
      signal: controller.signal
    });

    const body = await response.json().catch(() => ({}));
    if (!response.ok || body?.ok === false) {
      throw new Error(body?.error || `scan HTTP ${response.status}`);
    }

    const structural = Array.isArray(body?.scan?.arbOpportunities)
      ? body.scan.arbOpportunities
      : [];
    const cross = body?.scan?.crossVenue || {};

    console.log(JSON.stringify({
      type: 'dreampredict_scan',
      trigger,
      ok: true,
      durationMs: Date.now() - startedAt,
      version: body?.version || null,
      lastScanAt: body?.lastScanAt || body?.scan?.asOf || null,
      scannedEvents: body?.scan?.scannedEvents || 0,
      scannedMarkets: body?.scan?.scannedMarkets || 0,
      structuralCandidates: structural.length,
      structuralQualified: structural.filter(x => x?.qualified).length,
      polymarketMarkets: cross?.scannedPolymarketMarkets || 0,
      strictCrossMatches: cross?.strictMatches || 0,
      crossVenueQualified: cross?.qualifiedArbs || 0,
      shadowCaptures: body?.shadow?.captures || 0
    }));

    return body;
  } catch (error) {
    console.error(JSON.stringify({
      type: 'dreampredict_scan',
      trigger,
      ok: false,
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error)
    }));
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export default {
  async scheduled(controller, env) {
    await runScan(env, `cron:${controller.cron}`);
  },

  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === '/health') {
      return Response.json({
        ok: true,
        service: 'dreampredict-edge-scheduler',
        mode: 'cloudflare-cron',
        cadence: 'every minute',
        scanEndpoint: 'configured'
      });
    }

    return new Response('DreamPredict edge scheduler', {
      headers: { 'content-type': 'text/plain; charset=utf-8' }
    });
  }
};
