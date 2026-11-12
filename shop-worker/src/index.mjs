const base = 'https://shop.dreamprotocol.ai';

const json = (value,status=200) => new Response(JSON.stringify(value),{
  status,
  headers:{
    'content-type':'application/json; charset=utf-8',
    'cache-control':'no-store',
    'x-content-type-options':'nosniff'
  }
});

export default {
  async fetch(request,env) {
    const url = new URL(request.url);
    const path = url.pathname;
    if (path === '/health') return json({
      service:'dream-commerce',
      hosting:'cloudflare-workers',
      ready:true,
      liveCheckout:false,
      fulfillmentConnected:false
    });
    if (path === '/password' || path.startsWith('/password/')) {
      return Response.redirect(base+'/',302);
    }
    if (path === '/checkout' || path.startsWith('/checkout/') ||
        path.startsWith('/api/checkout') || path.startsWith('/api/order')) {
      return json({ok:false,error:'Checkout is unavailable until live payments, verified inventory and supplier fulfillment are connected.'},503);
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return json({ok:false,error:'Method not allowed'},405);
    }
    const response = await env.ASSETS.fetch(request);
    const headers = new Headers(response.headers);
    headers.set('x-content-type-options','nosniff');
    headers.set('referrer-policy','strict-origin-when-cross-origin');
    headers.set('x-robots-tag','noindex, nofollow');
    headers.set('permissions-policy','camera=(), microphone=(), geolocation=()');
    return new Response(response.body,{
      status:response.status,
      statusText:response.statusText,
      headers
    });
  }
};
