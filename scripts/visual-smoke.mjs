import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright';

const origin='http://127.0.0.1:4173';
const output='_visual';
fs.mkdirSync(output,{recursive:true});
const server=spawn(process.execPath,['scripts/serve.mjs'],{stdio:'inherit'});
let browser;
try {
  for(let attempt=0;attempt<50;attempt++){
    try {if((await fetch(origin)).ok)break;} catch {}
    if(attempt===49)throw Error('Preview server did not start');
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  browser=await chromium.launch();
  for(const [width,height] of [[1440,900],[1165,747],[820,1180],[390,844],[320,740]]){
    const page=await browser.newPage({viewport:{width,height},reducedMotion:'reduce'});
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    // Visual checks must never initiate a voice session or submit a lead.
    await page.route(/api\.dreamprotocol\.ai|formsubmit\.co|api\.vapi\.ai/,route=>route.abort());
    await page.goto(origin,{waitUntil:'networkidle'});
    await page.evaluate(()=>document.fonts.ready);
    await page.screenshot({path:`${output}/home-${width}.png`});
    const geometry=await page.evaluate(()=>({
      overflow:document.documentElement.scrollWidth>innerWidth+1,
      cta:document.querySelector('.hero-primary').getBoundingClientRect().toJSON(),
      guides:document.querySelectorAll('.home-insights .guide-card').length
    }));
    assert(!geometry.overflow,`Homepage overflows at ${width}px`);
    assert(geometry.cta.bottom<=height,`Primary CTA is below first viewport at ${width}px`);
    assert.equal(geometry.guides,3);
    const menu=page.locator('.menu-button');
    if(await menu.isVisible()){
      await menu.click();
      assert.equal(await menu.getAttribute('aria-expanded'),'true');
      await page.keyboard.press('Escape');
      assert.equal(await menu.getAttribute('aria-expanded'),'false');
      await menu.click();
      await page.locator('#primary-nav a[href="/pricing/"]').click();
      await page.waitForURL('**/pricing/');
      await page.goBack();
      await page.waitForURL(origin+'/');
    }
    await page.locator('.hero-primary').click();
    await page.waitForURL('**/#demo');
    assert(await page.locator('#demo').isVisible());
    await page.locator('.home-insights').screenshot({path:`${output}/guides-${width}.png`});
    await page.goto(origin+'/contact/?service=AI%20receptionist',{waitUntil:'networkidle'});
    assert((await page.locator('[name="workflow"]').inputValue()).includes('AI receptionist'));
    await page.screenshot({path:`${output}/contact-${width}.png`});
    await page.locator('#lead-form').screenshot({path:`${output}/form-${width}.png`});
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`Contact overflows at ${width}px`);
    assert.deepEqual(errors,[],`Uncaught browser errors at ${width}px`);
    await page.close();
    console.log(`Visual smoke passed at ${width}x${height}`);
  }
} finally {
  await browser?.close();
  server.kill();
}
