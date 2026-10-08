import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright';

const origin='http://127.0.0.1:4173';
const output='_visual';
const dreamPredictMock=()=>({
  ok:true,
  mode:'SHADOW',
  version:'dream-arb-v3',
  strategy:'Dream Arb',
  focus:'ARB_FIRST',
  realMoney:false,
  execution:{live:false,orderSubmission:false,atomicExecution:false,reason:'Shadow validation in progress.'},
  guardrails:{minNetEdge:.02,safetyMargin:.005,maxContracts:10,horizonHours:24,mutuallyExclusiveBasketAssumption:false,nestedThresholdsOnly:true},
  scanner:{automated:true,intervalSeconds:45},
  crypto:{enabled:false,mode:'PAUSED',realMoney:false},
  forecastLab:{
    enabled:true,version:'weather-edge-lab-v1',goal:100,
    modelScans:22,lastModelAt:Date.now()-5*60*1000,
    pricedMarkets:24,qualifiedSignals:3,sourceErrors:[],lastError:null,
    evaluations:{
      total:549,completed:496,pending:53,distinctContracts:26,distinctEvents:5,
      repeatedContracts:470,qualifiedCompleted:99,qualifiedDistinctContracts:9,
      qualifiedDistinctEvents:4,qualifiedPositive:2,qualifiedWinRate:2/99,
      hypotheticalNetOneContract:-22.51
    },
    paper:{open:7,completed:0,realized:0,openRisk:20.32,totalNet:-1.76,
      wins:0,losses:0,positions:[]},
    topSignals:[{
      ticker:'KXHIGHTSFO-26OCT08-B77.5',city:'San Francisco',
      title:'San Francisco high temperature',subtitle:'77.5 degree bucket',
      side:'yes',probability:.3099,ask:.14,bid:.13,conservativeEdge:.0861,
      qualified:true,reason:'INDEPENDENT FORECAST EDGE',nws:79,openMeteo:79.5,
      disagreementF:.5,closeTime:new Date(Date.now()+8*3600000).toISOString()
    }]
  },
  shadow:{
    captures:3,
    theoreticalLockedProfit:1.26,
    recent:[
      {eventTitle:'NBA total points ladder',contracts:8,capital:7.12,lockedProfit:.48,netEdge:.06,capturedAt:Date.now()-25*60*1000},
      {eventTitle:'US temperature threshold',contracts:7,capital:6.44,lockedProfit:.42,netEdge:.06,capturedAt:Date.now()-9*60*1000},
      {eventTitle:'Cross-venue sports total',contracts:6,capital:5.58,lockedProfit:.36,netEdge:.06,capturedAt:Date.now()-2*60*1000}
    ]
  },
  scan:{
    scannedEvents:81,
    scannedMarkets:640,
    qualifiedArbs:2,
    qualifiedStructuralArbs:1,
    arbOpportunities:[
      {
        kind:'NESTED_THRESHOLD',eventTicker:'KXTEST',eventTitle:'NBA total points ladder',category:'SPORTS',
        strikeType:'greater',lowerStrike:221.5,upperStrike:224.5,grossCost:.87,estimatedFees:.03,safetyMargin:.005,
        guaranteedMinimumPayout:1,netEdge:.095,netEdgeCents:9.5,depth:8,qualified:true,qualification:'STRUCTURAL ARB',
        legs:[
          {ticker:'KXTEST-221',title:'Game total over 221.5',side:'yes',ask:.42,fee:.01,size:12,strike:221.5},
          {ticker:'KXTEST-224',title:'Game total over 224.5',side:'no',ask:.45,fee:.02,size:8,strike:224.5}
        ]
      },
      {
        kind:'NESTED_THRESHOLD',eventTicker:'KXWATCH',eventTitle:'Weather threshold ladder',category:'WEATHER',
        strikeType:'greater',lowerStrike:70,upperStrike:72,grossCost:.95,estimatedFees:.03,safetyMargin:.005,
        guaranteedMinimumPayout:1,netEdge:.015,netEdgeCents:1.5,depth:14,qualified:false,qualification:'EDGE BELOW MINIMUM',
        legs:[
          {ticker:'KXWATCH-70',title:'High temperature above 70',side:'yes',ask:.48,fee:.01,size:20,strike:70},
          {ticker:'KXWATCH-72',title:'High temperature above 72',side:'no',ask:.47,fee:.02,size:14,strike:72}
        ]
      }
    ],
    crossVenue:{
      enabled:true,catalogCached:false,catalogAgeMs:0,scannedPolymarketMarkets:342,candidateMatches:17,timeVerifiedMatches:8,
      ruleVerifiedMatches:5,strictMatches:4,pricedMatches:3,qualifiedArbs:1,
      opportunities:[
        {
          kind:'CROSS_VENUE',eventTicker:'KXNBA',eventTitle:'Lakers vs Warriors total points',category:'CROSS VENUE',
          grossCost:.88,estimatedFees:.025,safetyMargin:.005,guaranteedMinimumPayout:1,netEdge:.09,netEdgeCents:9,
          depth:6,qualified:true,qualification:'CROSS-VENUE ARB',matchConfidence:.91,timeVerified:true,ruleVerified:true,
          legs:[
            {venue:'KALSHI',ticker:'KXNBA-O228',title:'Lakers vs Warriors over 228.5',side:'yes',ask:.43,fee:.01,size:9},
            {venue:'POLYMARKET',ticker:'poly-no-token',title:'Lakers vs Warriors over 228.5',side:'no',ask:.45,fee:.015,size:6}
          ]
        },
        {
          kind:'CROSS_VENUE',eventTicker:'KXMLB',eventTitle:'Padres vs Brewers total runs',category:'CROSS VENUE',
          grossCost:.93,estimatedFees:.025,safetyMargin:.005,guaranteedMinimumPayout:1,netEdge:.04,netEdgeCents:4,
          depth:5,qualified:false,qualification:'RULE PARITY UNPROVEN',matchConfidence:.74,timeVerified:true,ruleVerified:false,
          legs:[
            {venue:'KALSHI',ticker:'KXMLB-O75',title:'Padres vs Brewers over 7.5',side:'yes',ask:.47,fee:.01,size:8},
            {venue:'POLYMARKET',ticker:'poly-no-mlb',title:'Padres vs Brewers over 7.5',side:'no',ask:.46,fee:.015,size:5}
          ]
        }
      ],
      closestMatches:[
        {kalshiEventTitle:'49ers vs Rams',kalshiMarketTitle:'Total points over 45.5',polymarketEventTitle:'49ers vs Rams',polymarketQuestion:'Will total points exceed 45.5?',score:.82,numbersCompatible:true,directionCompatible:true},
        {kalshiEventTitle:'Padres vs Brewers',kalshiMarketTitle:'Full game over 7.5',polymarketEventTitle:'Brewers vs Padres',polymarketQuestion:'Total runs over 7.5',score:.74,numbersCompatible:true,directionCompatible:true},
        {kalshiEventTitle:'Fed decision',kalshiMarketTitle:'Rate cut over 25 bps',polymarketEventTitle:'Federal Reserve',polymarketQuestion:'Will the Fed cut by 25 bps?',score:.61,numbersCompatible:true,directionCompatible:false}
      ],
      errors:[]
    },
    liquidityOpportunities:[
      {qualification:'WATCH',ticker:'KXNBA-LIQ',description:'Active liquidity incentive',reward:250,rewardPerDay:35.71,targetSize:100,endDate:new Date(Date.now()+2*86400000).toISOString()}
    ],
    errors:[]
  },
  lastScanAt:Date.now()-12000,
  lastError:null
});

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
    const dreamPredictRequests=[];
    page.on('pageerror',error=>errors.push(error.message));
    // Visual checks must never initiate a voice session, submit a lead, or force a DreamPredict scan.
    await page.route(/api\.dreamprotocol\.ai|formsubmit\.co|api\.vapi\.ai/,route=>{
      const url=route.request().url();
      if(url.includes('api.dreamprotocol.ai'))dreamPredictRequests.push(url);
      if(url.includes('/dream-predict/status')){
        return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(dreamPredictMock())});
      }
      return route.abort();
    });
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
      productIndex:document.querySelector('.hero-film').getBoundingClientRect().toJSON()
    }));
    assert(!geometry.overflow,`Homepage overflows at ${width}px: ${JSON.stringify(geometry.overflowing)}`);
    assert(geometry.cta.bottom<=height,`Primary CTA is below first viewport at ${width}px`);
    assert(geometry.productIndex.left<width && geometry.productIndex.right>width*.55,`Homepage hero film mispositioned at ${width}px`);
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
    assert(await page.locator('.hero-film').isVisible());
    await page.waitForFunction(() => {
      const video=document.querySelector('.hero-film video');
      return Boolean(video && video.readyState>=2 && video.videoWidth>0 && video.videoHeight>0 && video.currentTime>0.15);
    }, null, {timeout:15000});
    const playbackState=await page.locator('.hero-film video').evaluate(video=>({
      paused:video.paused,
      currentTime:video.currentTime,
      readyState:video.readyState,
      videoWidth:video.videoWidth,
      videoHeight:video.videoHeight,
      currentSrc:video.currentSrc
    }));
    assert(playbackState.readyState>=2 && playbackState.videoWidth===1080 && playbackState.videoHeight===1920 && playbackState.currentTime>0.15,
      `Hero video is not actually playing at ${width}px: ${JSON.stringify(playbackState)}`);
    const heroVideoState=await page.locator('.hero-film video').evaluate(video=>({
      readyState:video.readyState,
      currentSrc:video.currentSrc,
      poster:video.poster,
      width:video.videoWidth,
      height:video.videoHeight
    }));
    assert(heroVideoState.currentSrc.includes('7989667-hd_1080_1920_25fps.mp4'),`Hero video source mismatch at ${width}px: ${JSON.stringify(heroVideoState)}`);
    assert(heroVideoState.poster.includes('pexels-photo-7989667.jpeg'),`Hero video poster missing at ${width}px`);
    const heroFilmBackground=await page.locator('.hero-film').evaluate(el=>getComputedStyle(el).backgroundImage);
    assert(heroFilmBackground.includes('pexels-photo-7989667.jpeg'),`Hero film poster fallback missing at ${width}px`);
    assert.equal(await page.locator('[data-film-event]').count(),4);
    assert.equal(await page.locator('[data-proof-target]').count(),3);
    await page.locator('[data-proof-target="board"]').click();
    assert(await page.locator('[data-proof-panel="board"]').isVisible());
    await page.locator('[data-proof-target="perio"]').click();
    assert(await page.locator('[data-proof-panel="perio"]').isVisible());
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`Cinematic homepage overflows at ${width}px`);
    await page.locator('.hero-film').screenshot({path:`${output}/cinematic-hero-${width}.png`});
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
    await page.waitForFunction(()=>document.querySelector('#healthText')?.textContent==='LIVE',null,{timeout:5000});
    const dreamPredictGeometry=await page.evaluate(()=>({
      overflow:document.documentElement.scrollWidth>innerWidth+1,
      hero:document.querySelector('.hero').getBoundingClientRect().toJSON(),
      rail:document.querySelector('.tickerRail').getBoundingClientRect().toJSON(),
      cards:document.querySelectorAll('.opCard').length,
      title:document.querySelector('#heroTitle')?.textContent||'',
      qualified:document.querySelector('#railQualified')?.textContent||'',
      universe:document.querySelector('#funnelUniverse')?.textContent||'',
      dashboardRole:[...document.querySelectorAll('.autoRows b')].map(x=>x.textContent).find(x=>x==='READ ONLY')||''
    }));
    assert(!dreamPredictGeometry.overflow,`DreamPredict overflows at ${width}px: ${JSON.stringify(dreamPredictGeometry)}`);
    assert(dreamPredictGeometry.hero.left>=-1 && dreamPredictGeometry.hero.right<=width+1,`DreamPredict hero mispositioned at ${width}px`);
    assert(dreamPredictGeometry.rail.left>=-1 && dreamPredictGeometry.rail.right<=width+1,`DreamPredict status rail mispositioned at ${width}px`);
    assert(dreamPredictGeometry.cards>=4,`DreamPredict opportunity matrix did not render at ${width}px`);
    assert(dreamPredictGeometry.title.includes('Math broke'),`DreamPredict hero did not enter qualified state at ${width}px`);
    assert.equal(dreamPredictGeometry.qualified,'3','Header should show model signal count, not arb count');
    assert.equal(dreamPredictGeometry.universe,'342');
    assert.equal(await page.locator('#forecastProgress').innerText(),'26 / 100',
      'Forecast goal should use distinct contracts, not repeated quote checks');
    assert.equal(await page.locator('#forecastTotalMarks').innerText(),'496');
    assert.equal(await page.locator('#forecastPaperCounts').innerText(),'7 / 0');
    assert.equal(await page.locator('#railEdge').innerText(),'26');
    assert.equal(await page.locator('#railCaptures').innerText(),'0');
    assert.equal(await page.locator('#sprintProgressText').count(),0,
      'Retired baseline 11/100 progress must not appear in active dashboard');
    assert.equal(dreamPredictGeometry.dashboardRole,'READ ONLY');
    assert(!dreamPredictRequests.some(url=>url.includes('/dream-predict/scan')),`DreamPredict dashboard forced a scan at ${width}px: ${JSON.stringify(dreamPredictRequests)}`);
    await page.evaluate(()=>scrollTo(0,0));
    await page.screenshot({path:`${output}/dreampredict-${width}.png`});
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
