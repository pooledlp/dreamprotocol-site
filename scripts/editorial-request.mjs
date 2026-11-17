const permanent = new Set(['insufficient_quota', 'credit_balance_exhausted', 'billing_hard_limit_reached', 'billing_not_active', 'organization_usage_limit_exceeded', 'project_usage_limit_exceeded']);
const safe = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(value) ? value : 'unknown';
export function retryDelay(value, attempt, now = Date.now(), random = Math.random) {
  const seconds = Number(value);
  const specified = value ? (/^\d+(\.\d+)?$/.test(value) ? seconds * 1000 : Date.parse(value) - now) : NaN;
  return Math.max(1000 * 2 ** (attempt - 1) + random() * 1000, Number.isFinite(specified) ? Math.max(0, specified) : 0);
}
export function createRequester(key, {fetchImpl = fetch, sleep = ms => new Promise(r => setTimeout(r, ms)), log = console.warn, now = Date.now, random = Math.random, model = 'gpt-5.4', effort = 'medium', maxCalls = 3, initialCalls = 0} = {}) {
  let calls = initialCalls, attempts = 0;
  return {
    get calls() { return calls; }, get attempts() { return attempts; },
    async request(body) {
      if (++calls > maxCalls) throw Error('Request limit reached');
      for (let attempt = 1; attempt <= 3; attempt++) {
        attempts++;
        let response;
        try {
          response = await fetchImpl('https://api.openai.com/v1/responses', {
            method: 'POST', headers: {Authorization: 'Bearer ' + key, 'Content-Type': 'application/json'},
            body: JSON.stringify({model, store: false, reasoning: {effort}, ...body}),
            signal: AbortSignal.timeout(240000)
          });
        } catch {
          // Delivery is ambiguous. Do not risk repeating paid work after a timeout.
          throw Error('AI transport failure or timeout; not retried because completion is unknown.');
        }
        let data;
        try { data = await response.json(); } catch { data = null; }
        if (response.ok) {
          if (!data) throw Error('AI returned invalid JSON; not retried.');
          return data;
        }
        const code = safe(data?.error?.code), type = safe(data?.error?.type);
        const account = permanent.has(code) || permanent.has(type);
        const retryable = !account && (response.status === 429 || [500, 502, 503, 504].includes(response.status));
        const diagnostic = `AI service HTTP ${response.status}; code=${code}; type=${type}; request_id=${safe(response.headers.get('x-request-id'))}; attempt=${attempt}/3`;
        const delay = retryDelay(response.headers.get('retry-after'), attempt, now(), random);
        if (!retryable || attempt === 3 || delay > 60000) {
          const guidance = account ? 'Account action required: check API project credits and usage limits; retries cannot resolve this.' :
            response.status === 401 || response.status === 403 ? 'Check repository API key and project/model permissions.' :
            retryable ? 'Retry budget exhausted or server wait exceeds 60 seconds; retry in a later authorized workflow attempt.' : 'Check API request/model configuration; not retryable.';
          throw Error(`${diagnostic}. ${guidance}`);
        }
        log(`${diagnostic}; retry_in_ms=${Math.ceil(delay)}`);
        await sleep(delay);
      }
    }
  };
}
