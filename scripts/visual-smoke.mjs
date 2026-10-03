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
    const fontState=await page.evaluate(()=>({
      body:getComputedStyle(document.body).fontFamily,
      heading:getComputedStyle(document.querySelector('h1')).fontFamily,
      loaded:[...document.fonts].filter(face=>face.status==='loaded').map(face=>face.family.replace(/["']/g,''))
    }));
    assert(fontState.body.includes('DM Sans'),`Body font stack lost DM Sans at ${width}px`);
    assert(fontState.heading.includes('Manrope'),`Heading font stack lost Manrope at ${width}px`);
    assert(fontState.loaded.includes('DM Sans'),`DM Sans webfont did not load at ${width}px: ${JSON.stringify(fontState.loaded)}`);
    assert(fontState.loaded.includes('Manrope'),`Manrope webfont did not load at ${width}px: ${JSON.stringify(fontState.loaded)}`);
    await page.screenshot({path:`${output}/home-${width}.png`});
    const geometry=await page.evaluate(()=>({
      overflow:document.documentElement.scrollWidth>innerWidth+1,
      overflowing:[...document.querySelectorAll('body *')].map(el=>({tag:el.tagName,cls:el.className,left:el.getBoundingClientRect().left,right:el.getBoundingClientRect().right})).filter(el=>el.left< -1||el.right>innerWidth+1).slice(0,30),
      cta:document.querySelector('.hero-primary').getBoundingClientRect().toJSON(),
      productIndex:document.querySelector('.cinematic-reel').getBoundingClientRect().toJSON()
    }));
    assert(!geometry.overflow,`Homepage overflows at ${width}px: ${JSON.stringify(geometry.overflowing)}`);
    assert(geometry.cta.bottom<=height,`Primary CTA is below first viewport at ${width}px`);
    assert(geometry.productIndex.left>=-1 && geometry.productIndex.right<=width+1,`Homepage cinematic reel mispositioned at ${width}px`);
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
    await page.waitForURL('**/#product-proof');
    assert(await page.locator('#product-proof').isVisible());
    assert(await page.locator('.presence-thesis').isVisible());
    assert(await page.locator('.cinematic-reel').isVisible());
    assert.equal(await page.locator('[data-reel-button]').count(),3);
    await page.locator('[data-reel-button="1"]').click();
    assert(await page.locator('[data-reel-scene="1"]').evaluate(el=>el.classList.contains('is-active')));
    const boardFilmGeometry=await page.evaluate(()=>({
      stage:document.querySelector('.film-board-stage').getBoundingClientRect().toJSON(),
      chair:document.querySelector('.film-chair').getBoundingClientRect().toJSON(),
      chairScrollWidth:document.querySelector('.film-chair').scrollWidth,
      chairClientWidth:document.querySelector('.film-chair').clientWidth,
      link:document.querySelector('.scene-board .reel-product-link').getBoundingClientRect().toJSON()
    }));
    assert(boardFilmGeometry.chair.left>=boardFilmGeometry.stage.left-1 && boardFilmGeometry.chair.right<=boardFilmGeometry.stage.right+1,`DreamBoard chair escapes stage at ${width}px`);
    assert(boardFilmGeometry.chairScrollWidth<=boardFilmGeometry.chairClientWidth+1,`DreamBoard chair text clips at ${width}px`);
    assert(boardFilmGeometry.link.right<=width+1,`DreamBoard product link clips at ${width}px`);
    assert.equal(await page.locator('[data-proof-target]').count(),3);
    await page.locator('[data-proof-target="board"]').click();
    assert(await page.locator('[data-proof-panel="board"]').isVisible());
    await page.locator('[data-proof-target="perio"]').click();
    assert(await page.locator('[data-proof-panel="perio"]').isVisible());
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`Cinematic homepage overflows at ${width}px`);
    await page.locator('.cinematic-reel').screenshot({path:`${output}/cinematic-hero-${width}.png`});
    await page.locator('.product-theater').screenshot({path:`${output}/product-proof-${width}.png`});
    await page.locator('.presence-thesis').screenshot({path:`${output}/presence-thesis-${width}.png`});
    await page.locator('[data-product-jump="board"]').click();
    assert(await page.locator('[data-proof-panel="board"]').isVisible());
    await page.goto(origin+'/about/',{waitUntil:'networkidle'});
    await page.evaluate(()=>document.fonts.ready);
    assert(await page.locator('.founder-proof-section').isVisible());
    const founderGeometry=await page.evaluate(()=>({
      overflow:document.documentElement.scrollWidth>innerWidth+1,
      photo:document.querySelector('.founder-proof-photo').getBoundingClientRect().toJSON(),
      imageWidth:document.querySelector('.founder-proof-photo img').clientWidth,
      imageHeight:document.querySelector('.founder-proof-photo img').clientHeight,
      naturalWidth:document.querySelector('.founder-proof-photo img').naturalWidth,
      imageSrc:document.querySelector('.founder-proof-photo img').getAttribute('src')
    }));
    assert(!founderGeometry.overflow,`About page overflows at ${width}px`);
    assert(founderGeometry.photo.left>=-1 && founderGeometry.photo.right<=width+1,`Founder photo mispositioned at ${width}px`);
    assert(founderGeometry.imageWidth>0 && founderGeometry.imageHeight>0 && founderGeometry.naturalWidth>0,`Founder image failed to render at ${width}px`);
    assert.equal(founderGeometry.imageSrc,'/public/dustin-poole-founder.webp');
    await page.locator('.founder-proof-section').screenshot({path:`${output}/founder-${width}.png`});
    await page.goto(origin+'/dreamboard/',{waitUntil:'networkidle'});
    await page.evaluate(()=>document.fonts.ready);
    assert((await page.locator('h1').innerText()).includes('Your board is in session.'));
    assert(await page.locator('.dreamboard-console').isVisible());
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`DreamBoard overflows at ${width}px`);
    assert(await page.locator('.dreamboard-console').evaluate(el=>el.scrollWidth<=el.clientWidth+1),`DreamBoard console clips at ${width}px`);
    await page.screenshot({path:`${output}/dreamboard-${width}.png`});
    await page.goto(origin+'/ai-workforce/',{waitUntil:'networkidle'});
    await page.evaluate(()=>document.fonts.ready);
    assert((await page.locator('h1').innerText()).includes('Let it earn the next one.'));
    assert(await page.locator('.workforce-signature-list').isVisible());
    const workforceGeometry=await page.evaluate(()=>({
      overflow:document.documentElement.scrollWidth>innerWidth+1,
      signature:document.querySelector('.workforce-signature-list').getBoundingClientRect().toJSON(),
      firstRole:document.querySelector('.workforce-signature-list article').getBoundingClientRect().toJSON(),
      bench:document.querySelector('.workforce-bench-list').getBoundingClientRect().toJSON()
    }));
    assert(!workforceGeometry.overflow,`DreamWorkforce overflows at ${width}px`);
    assert(workforceGeometry.signature.left>=-1 && workforceGeometry.signature.right<=width+1,`DreamWorkforce signature roles mispositioned at ${width}px`);
    assert(workforceGeometry.firstRole.width>Math.min(250,width*.72),`DreamWorkforce first role collapsed at ${width}px`);
    assert(workforceGeometry.bench.left>=-1 && workforceGeometry.bench.right<=width+1,`DreamWorkforce role index mispositioned at ${width}px`);
    await page.screenshot({path:`${output}/dreamworkforce-${width}.png`});
    await page.goto(origin+'/client-login/',{waitUntil:'networkidle'});
    await page.evaluate(()=>document.fonts.ready);
    assert((await page.locator('h1').innerText()).includes('One secure place.'));
    assert(await page.locator('.client-login-console').isVisible());
    const portalGeometry=await page.evaluate(()=>({
      overflow:document.documentElement.scrollWidth>innerWidth+1,
      console:document.querySelector('.client-login-console').getBoundingClientRect().toJSON(),
      rail:document.querySelector('.client-login-status-rail').getBoundingClientRect().toJSON(),
      bodyFont:getComputedStyle(document.body).fontFamily,
      headingFont:getComputedStyle(document.querySelector('h1')).fontFamily,
      loaded:[...document.fonts].filter(face=>face.status==='loaded').map(face=>face.family.replace(/["']/g,''))
    }));
    assert(!portalGeometry.overflow,`Client portal overflows at ${width}px`);
    assert(portalGeometry.console.left>=-1 && portalGeometry.console.right<=width+1,`Client login console is mispositioned at ${width}px`);
    assert(portalGeometry.rail.left>=-1 && portalGeometry.rail.right<=width+1,`Client portal status rail is mispositioned at ${width}px`);
    assert(portalGeometry.bodyFont.includes('DM Sans'),`Client portal body font mismatch at ${width}px`);
    assert(portalGeometry.headingFont.includes('Manrope'),`Client portal heading font mismatch at ${width}px`);
    assert(portalGeometry.loaded.includes('DM Sans') && portalGeometry.loaded.includes('Manrope'),`Client portal webfonts did not load at ${width}px`);
    await page.evaluate(()=>scrollTo(0,0));
    await page.screenshot({path:`${output}/client-login-${width}.png`});
    await page.locator('#client-login-email').fill('client@example.com');
    await page.locator('#client-login-password').fill('not-transmitted');
    await page.locator('#client-login-button').click();
    assert.equal(await page.locator('#client-login-password').inputValue(),'');
    assert((await page.locator('#client-login-status').innerText()).includes('Private workspace access required.'));
    await page.screenshot({path:`${output}/client-login-access-${width}.png`});
    await page.goto(origin+'/contact/?service=AI%20receptionist',{waitUntil:'networkidle'});
    assert((await page.locator('[name="workflow"]').inputValue()).includes('AI receptionist'));
    await page.screenshot({path:`${output}/contact-${width}.png`});
    assert(await page.locator('#lead-form').evaluate(form=>form.scrollWidth<=form.clientWidth+1),`Form content clips at ${width}px`);
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
