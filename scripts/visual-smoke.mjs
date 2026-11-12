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
    // Never send a real inquiry, start a paid voice session, or call a production AI backend.
    await page.route(/api\.dreamprotocol\.ai|formsubmit\.co|api\.vapi\.ai/,route=>route.abort());
    await page.goto(origin,{waitUntil:'domcontentloaded'});
    await page.waitForTimeout(900);
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
      productIndex:document.querySelector('.dp-momentum').getBoundingClientRect().toJSON()
    }));
    assert(!geometry.overflow,`Homepage overflows at ${width}px: ${JSON.stringify(geometry.overflowing)}`);
    assert(geometry.cta.bottom<=height,`Primary CTA is below first viewport at ${width}px`);
    assert(geometry.productIndex.left<width && geometry.productIndex.right>width*.55,`Homepage new artwork mispositioned at ${width}px`);
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
    assert.equal(await page.locator('.hero-live-phone').getAttribute('href'),'tel:+16282513616');
    assert(await page.locator('.hero-live-phone').isVisible(), 'Public live demo phone is visible');
    await page.locator('.hero-primary').click();
    await page.waitForURL('**/contact/?source=home-hero');
    assert(await page.locator('#lead-form').isVisible(), 'Primary CTA opens a real inquiry form');
    await page.goto(origin+'/#day-in-motion',{waitUntil:'domcontentloaded'});
    assert.equal(await page.locator('.conversion-gateway .cg-card').count(),3, 'Homepage presents three specific sales entry points');
    assert(await page.locator('#day-in-motion').isVisible(), 'New business-day story is visible');
    assert.equal(await page.locator('[data-day-select]').count(),4);
    await page.locator('[data-day-select="2"]').click();
    assert(await page.locator('[data-day-panel="2"]').isVisible(), 'Day story responds to tab selection');
    assert.equal(await page.locator('[data-day-select="2"]').getAttribute('aria-selected'),'true');
    await page.goto(origin+'/ai-receptionist-offer/',{waitUntil:'domcontentloaded'});
    assert(await page.locator('#total').isVisible(), 'Sales calculator remains visible');
    await page.goto(origin,{waitUntil:'domcontentloaded'});
    await page.locator('.hero-conversion-note a[href="#demo"]').click();
    await page.waitForURL('**/#demo');
    assert(await page.locator('#demo').isVisible());
    assert.equal(await page.locator('.live-phone-demo a[href="tel:+16282513616"]').count(),1, 'Secondary live phone CTA is present');
    assert(await page.locator('#product-proof').isVisible());
    assert(await page.locator('.presence-thesis').isVisible());
    assert(await page.locator('.dp-momentum').isVisible(), 'Custom business story must render');
    assert.equal(await page.locator('.dp-momentum video').count(),0,
      'Hero must not load any video or stock footage');
    assert.equal(await page.locator('.dp-momentum img').count(),0,
      'Hero must not include stock portraits or photos');
    assert.equal(await page.locator('[data-momentum-select]').count(),3,
      'Three user-controlled examples must be available');
    assert.equal(await page.locator('[data-momentum-select="calls"]').getAttribute('aria-pressed'),'true');
    await page.locator('[data-momentum-select="booking"]').click();
    assert.equal(await page.locator('[data-momentum-select="booking"]').getAttribute('aria-pressed'),'true');
    assert((await page.locator('[data-momentum-result]').innerText()).includes('Availability checked'),
      'Example switches to booking without repeating a film loop');
    await page.locator('[data-momentum-select="followup"]').click();
    assert((await page.locator('[data-momentum-title]').innerText()).includes('Nothing'),
      'User can explore a third business moment');
    const art=await page.locator('.momentum-stage').evaluate(el=>({
      width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height,
      background:getComputedStyle(el).backgroundColor
    }));
    assert(art.width>200 && art.height>190,
      'The outcome visual must remain prominent at each screen width');
    assert.equal(await page.locator('[data-proof-target]').count(),3);
    await page.locator('[data-proof-target="board"]').click();
    assert(await page.locator('[data-proof-panel="board"]').isVisible());
    await page.locator('[data-proof-target="perio"]').click();
    assert(await page.locator('[data-proof-panel="perio"]').isVisible());
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`Cinematic homepage overflows at ${width}px`);
    await page.locator('.dp-momentum').screenshot({path:`${output}/work-in-motion-${width}.png`});
    await page.locator('.proof-stories').screenshot({path:`${output}/product-proof-${width}.png`});
    await page.locator('.presence-thesis').screenshot({path:`${output}/presence-thesis-${width}.png`});
    await page.locator('[data-proof-target="board"]').click();
    assert(await page.locator('[data-proof-panel="board"]').isVisible());
    await page.goto(origin+'/about/',{waitUntil:'networkidle'});
    await page.evaluate(()=>document.fonts.ready);
    assert(await page.locator('.founder-proof-section').isVisible());
    assert((await page.locator('.founder-proof-copy').innerText()).includes('The system is only as good'));
    const exposedName=['Dustin','Poole'].join(' ');
    assert(!(await page.content()).includes(exposedName),'About page must not expose a personal name in page content or metadata');
    assert.equal(await page.locator('.founder-proof-section img').count(),0,'About page must not render a personal portrait');
    const aboutGeometry=await page.locator('.founder-proof-copy').boundingBox();
    assert(aboutGeometry && aboutGeometry.width>0 && aboutGeometry.x>=-1 && aboutGeometry.x+aboutGeometry.width<=width+1,
      `About principles layout mispositioned at ${width}px: ${JSON.stringify(aboutGeometry)}`);
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`About page overflows at ${width}px`);
    await page.locator('.founder-proof-section').screenshot({path:`${output}/operating-principles-${width}.png`});

    await page.goto(origin+'/services/',{waitUntil:'networkidle'});
    await page.evaluate(()=>document.fonts.ready);
    const serviceCardState=await page.locator('.pale-section .service-card').first().evaluate(card=>{
      const rgb=value=>{
        const nums=(value.match(/[\d.]+/g)||[]).slice(0,3).map(Number);
        return nums.length===3?nums:null;
      };
      const luminance=value=>{
        const v=rgb(value);
        if(!v)return null;
        const c=v.map(x=>{x/=255;return x<=.04045?x/12.92:Math.pow((x+.055)/1.055,2.4)});
        return .2126*c[0]+.7152*c[1]+.0722*c[2];
      };
      const ratio=(a,b)=>{
        const x=luminance(a),y=luminance(b);
        if(x==null||y==null)return 0;
        return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);
      };
      const bg=getComputedStyle(card).backgroundColor;
      const title=getComputedStyle(card.querySelector('h3')).color;
      const copy=getComputedStyle(card.querySelector('.service-card-body>p:not(.eyebrow)')).color;
      const price=getComputedStyle(card.querySelector('.card-price')).color;
      return {bg,title,copy,price,titleContrast:ratio(title,bg),copyContrast:ratio(copy,bg),priceContrast:ratio(price,bg)};
    });
    assert(serviceCardState.titleContrast>=4.5,`Service card heading contrast failed at ${width}px: ${JSON.stringify(serviceCardState)}`);
    assert(serviceCardState.copyContrast>=4.5,`Service card body contrast failed at ${width}px: ${JSON.stringify(serviceCardState)}`);
    assert(serviceCardState.priceContrast>=4.5,`Service card price contrast failed at ${width}px: ${JSON.stringify(serviceCardState)}`);
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`Services page overflows at ${width}px`);
    await page.screenshot({path:`${output}/services-${width}.png`});

    await page.goto(origin+'/dreamperio/',{waitUntil:'networkidle'});
    await page.evaluate(()=>document.fonts.ready);
    const dreamPerioText=await page.locator('main').innerText();
    assert(dreamPerioText.includes('LIVE CLIENT DEPLOYMENT'),'DreamPerio must state live client deployment');
    assert(dreamPerioText.includes('Book a DreamPerio demo'),'DreamPerio must use production demo CTA');
    assert(!/early access/i.test(dreamPerioText),'DreamPerio must not advertise early access');
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`DreamPerio overflows at ${width}px`);
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

    // One shared branded sales path across all five high-intent verticals.
    for(const route of [
      'ai-receptionist-for-dental-offices',
      'ai-receptionist-for-veterinary-clinics',
      'ai-receptionist-for-home-services',
      'ai-receptionist-for-tax-accounting',
      'ai-receptionist-for-property-management'
    ]){
      await page.goto(origin+'/'+route+'/',{waitUntil:'networkidle'});
      await page.evaluate(()=>document.fonts.ready);
      assert.equal(await page.locator('h1').count(),1,`${route}: only one H1`);
      assert(await page.locator('.site-header').isVisible(),`${route}: shared site navigation`);
      assert(await page.locator('.sales-hero-panel').isVisible(),`${route}: branded call path`);
      assert(await page.locator('.sales-offer-box').isVisible(),`${route}: published starting price`);
      assert.equal(await page.locator('.sales-vertical-card').count(),4,`${route}: related industry routes`);
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${route}: no viewport overflow at ${width}px`);
      if(route==='ai-receptionist-for-dental-offices')
        await page.screenshot({path:`${output}/dental-sales-${width}.png`});
      await page.locator('.sales-hero .button').first().click();
      await page.waitForURL('**/contact/?*');
      assert((await page.locator('[name="workflow"]').inputValue()).includes('AI receptionist -'),`${route}: prefilled inquiry`);
      assert.equal(await page.locator('[name="service_interest"]').inputValue(),'AI phone receptionist');
    }
    await page.goto(origin+'/pricing/',{waitUntil:'networkidle'});
    assert(await page.locator('.sales-price-feature a[href="/ai-receptionist-offer/"]').isVisible(),'Pricing links to front desk offer');
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`Pricing: no overflow at ${width}px`);

    // Monthly service plans remain one consistent Dream Protocol journey.
    await page.goto(origin+'/monthly-ai-plans/',{waitUntil:'networkidle'});
    await page.evaluate(()=>document.fonts.ready);
    assert.equal(await page.locator('.monthly-plan-card').count(),3,'Published monthly package choices');
    assert((await page.locator('h1').innerText()).includes('AI on duty.'));
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`Monthly plans overflow at ${width}px`);
    await page.screenshot({path:`${output}/monthly-plans-${width}.png`});
    await page.locator('.monthly-plan-card .button').first().click();
    await page.waitForURL('**/start-monthly-ai/?*');
    assert.equal(await page.locator('[name="service_interest"]').inputValue(),'AI phone receptionist');
    assert(await page.locator('.monthly-activation .site-header').count()===0); // Shared header stays outside main activation wrapper.
    assert(await page.locator('.site-header').isVisible());
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`Monthly enrollment overflows at ${width}px`);
    await page.screenshot({path:`${output}/monthly-enrollment-${width}.png`});
    await page.goto(origin+'/start-monthly-ai/?service=Managed%20AI%20Operations',{waitUntil:'networkidle'});
    assert.equal(await page.locator('[name="service_interest"]').inputValue(),'Managed AI operations');
    await page.goto(origin+'/ai-receptionist-offer/',{waitUntil:'networkidle'});
    await page.locator('.offer-page .offer-actions .button').first().click();
    await page.waitForURL('**/start-monthly-ai/?*');
    assert.equal(await page.locator('[name="service_interest"]').inputValue(),'AI phone receptionist');
    await page.goto(origin+'/ai-workforce/',{waitUntil:'networkidle'});
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
    await page.goto(origin+'/kalshi/',{waitUntil:'domcontentloaded'});
    assert.equal(await page.locator('#retired-headline').innerText(),'DreamPredict has been retired.');
    assert.equal(await page.locator('script').count(),0,'Retired dashboard must not run trading JavaScript');
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Retired DreamPredict page overflows');
    await page.screenshot({path:`${output}/dreampredict-retired-${width}.png`});
    await page.goto(origin+'/contact/?service=AI%20receptionist',{waitUntil:'networkidle'});
    assert((await page.locator('[name="workflow"]').inputValue()).includes('AI receptionist'));
    await page.screenshot({path:`${output}/contact-${width}.png`});
    assert(await page.locator('#lead-form').evaluate(form=>form.scrollWidth<=form.clientWidth+1),`Form content clips at ${width}px`);
    await page.locator('#lead-form').screenshot({path:`${output}/form-${width}.png`});
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`Contact overflows at ${width}px`);
    // The Live Studio is a production sitemap route. Verify its essential
    // actions in the same real Chromium/mobile viewports, without touching APIs.
    await page.goto(origin+'/live/',{waitUntil:'domcontentloaded'});
    assert.equal(await page.locator('h1').count(),1,`Live Studio H1 at ${width}px`);
    await page.locator('#run-workflow').click();
    assert.equal(await page.locator('#workflow-steps li').count(),4,`Workflow simulation at ${width}px`);
    await page.locator('[data-solution="leads"]').click();
    assert.equal((await page.locator('#scope-price').textContent()).trim(),'$499/mo',`Published lead price at ${width}px`);
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`Live Studio overflows at ${width}px`);
    await page.screenshot({path:`${output}/live-studio-${width}.png`,fullPage:true});
    assert.deepEqual(errors,[],`Uncaught browser errors at ${width}px`);
    await page.close();
    console.log(`Visual smoke passed at ${width}x${height}`);
  }
} finally {
  await browser?.close();
  server.kill();
}
