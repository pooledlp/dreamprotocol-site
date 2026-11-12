import test from 'node:test';
import assert from 'node:assert/strict';
import worker from './src/index.mjs';

const env = {ASSETS:{fetch:async()=>new Response('<h1>Dream Commerce</h1>',{headers:{'content-type':'text/html'}})}};

test('health states that live checkout and fulfillment are disabled',async()=>{
  const r = await worker.fetch(new Request('https://shop.dreamprotocol.ai/health'),env);
  assert.equal(r.status,200);
  const body = await r.json();
  assert.equal(body.liveCheckout,false);
  assert.equal(body.fulfillmentConnected,false);
});
test('old Shopify password route points visitors to our shop',async()=>{
  const r = await worker.fetch(new Request('https://shop.dreamprotocol.ai/password'),env);
  assert.equal(r.status,302);
  assert.equal(r.headers.get('location'),'https://shop.dreamprotocol.ai/');
});
test('checkout and fulfillment APIs cannot take unfulfillable orders',async()=>{
  for (const path of ['/checkout','/api/checkout','/api/order']) {
    const r = await worker.fetch(new Request('https://shop.dreamprotocol.ai'+path,{method:'POST'}),env);
    assert.equal(r.status,503);
  }
});
test('static pages are served with secure indexing headers',async()=>{
  const r = await worker.fetch(new Request('https://shop.dreamprotocol.ai/'),env);
  assert.equal(r.status,200);
  assert.match(await r.text(),/Dream Commerce/);
  assert.equal(r.headers.get('x-robots-tag'),'noindex, nofollow');
});
