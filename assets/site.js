(() => {
  'use strict';

  const body = document.body;
  const canEnhance = Boolean(document.documentElement && typeof document.querySelectorAll === 'function');
  const media = query => typeof matchMedia === 'function' ? matchMedia(query) : {matches:false};

  if (canEnhance) {
    const root = document.documentElement;
    const finePointer = media('(pointer:fine)').matches && !media('(prefers-reduced-motion: reduce)').matches;

    // Site-wide motion language: subtle, fast, and never required for usability.
    const revealTargets = [
      '.page-hero > *',
      '.section-heading',
      '.service-card',
      '.price-card',
      '.guide-card',
      '.feature',
      '.region-card',
      '.wide-note',
      '.example-panel',
      '.scope-panel',
      '.faq-section details',
      '.founder-grid > *',
      '.article-body > *',
      '.process-grid article',
      '.related-note',
      '.lead-form',
      '.audio-card',
      '.home-trust-rail > .shell > div',
      '.architecture-step',
      '.production-card',
      '.opportunity-card',
      '.production-flow',
      '.service-card-visual',
      '.architecture-console',
      '.arch-node',
      '.architecture-ledger > div',
      '.manifesto-band > .shell > *',
      '.contact-path',
      '.ops-sim-heading > *',
      '.ops-simulator',
      '.delivery-metrics > div',
      '.proof-card'
    ].join(',');

    const reveal = [...document.querySelectorAll(revealTargets)];
    reveal.forEach((el,i) => {
      el.classList.add('dp-reveal');
      el.style.setProperty('--reveal-delay', (i % 6) * 45 + 'ms');
    });

    if (typeof IntersectionObserver !== 'undefined' && !media('(prefers-reduced-motion: reduce)').matches) {
      const observer = new IntersectionObserver(entries => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add('dp-visible');
          observer.unobserve(entry.target);
        }
      }, {threshold:.08, rootMargin:'0px 0px -40px'});
      reveal.forEach(el => observer.observe(el));
    } else {
      reveal.forEach(el => el.classList.add('dp-visible'));
    }

    // Cursor-reactive glow on high-value surfaces.
    if (finePointer) {
      const reactive = [...document.querySelectorAll([
        '.page-hero',
        '.service-card',
        '.price-card',
        '.guide-card',
        '.wide-note',
        '.example-panel',
        '.scope-panel',
        '.lead-form',
        '.feature',
        '.region-card',
        '.automation-core',
        '.demo-command-center',
        '.architecture-console',
        '.service-card-visual',
        '.production-card',
        '.proof-card',
        '.opportunity-card',
        '.recording-console',
        '.platform-window',
        '.cinematic-contact .lead-form',
        '.ops-simulator'
      ].join(','))];
      for (const el of reactive) {
        el.classList.add('dp-reactive');
        el.addEventListener('pointermove', e => {
          const rect=el.getBoundingClientRect();
          el.style.setProperty('--mx', (e.clientX-rect.left)+'px');
          el.style.setProperty('--my', (e.clientY-rect.top)+'px');
        }, {passive:true});
      }
    }

    // Header scroll progress + compact state.
    if (typeof addEventListener === 'function' && typeof requestAnimationFrame === 'function') {
      let ticking=false;
      const syncScroll=()=>{
        const viewport=typeof innerHeight === 'number' ? innerHeight : 0;
        const y=typeof scrollY === 'number' ? scrollY : 0;
        const max=Math.max(1,document.documentElement.scrollHeight-viewport);
        const p=Math.min(1,Math.max(0,y/max));
        root.style.setProperty('--scroll-progress',(p*100).toFixed(2)+'%');
        root.style.setProperty('--page-y',Math.min(1,y/900).toFixed(3));
        document.querySelector('.site-header')?.classList.toggle('is-scrolled',y>24);
        ticking=false;
      };
      addEventListener('scroll',()=>{
        if(!ticking){ticking=true;requestAnimationFrame(syncScroll);}
      },{passive:true});
      syncScroll();
    }

    // Small parallax shift in hero/system art only on desktops.
    if (finePointer) {
      const stage=document.querySelector('.hero-cockpit,.automation-core,.detail-art,.region-visual,.founder-photo');
      const hero=document.querySelector('.home-hero,.page-hero');
      hero?.addEventListener('pointermove',e=>{
        if(!stage)return;
        const r=hero.getBoundingClientRect();
        const x=((e.clientX-r.left)/r.width-.5)*8;
        const y=((e.clientY-r.top)/r.height-.5)*8;
        stage.style.setProperty('--tilt-x',x.toFixed(2)+'px');
        stage.style.setProperty('--tilt-y',y.toFixed(2)+'px');
      },{passive:true});
      hero?.addEventListener('pointerleave',()=>{
        stage?.style.setProperty('--tilt-x','0px');
        stage?.style.setProperty('--tilt-y','0px');
      },{passive:true});
    }

    // Animated DreamProtocol operating view. This is explicitly an illustrative
    // simulation, not customer telemetry, so the motion can tell the workflow story
    // without presenting synthetic activity as production data.
    const opsSimulator=document.querySelector('[data-ops-simulator]');
    if (opsSimulator) {
      const tabs=[...opsSimulator.querySelectorAll('[data-ops-target]')];
      const scenes=[...opsSimulator.querySelectorAll('[data-ops-scene]')];
      const reduced=media('(prefers-reduced-motion: reduce)').matches;
      let current=0;
      let timer=null;
      let paused=false;

      const activate=(next)=>{
        if(!scenes.length)return;
        current=(next+scenes.length)%scenes.length;
        scenes.forEach((scene,index)=>{
          const active=index===current;
          scene.hidden=!active;
          scene.classList.toggle('is-active',active);
        });
        tabs.forEach((tab,index)=>{
          const active=index===current;
          tab.setAttribute('aria-selected',String(active));
          tab.tabIndex=active?0:-1;
        });
      };

      const stop=()=>{
        if(timer){clearInterval(timer);timer=null;}
      };
      const start=()=>{
        stop();
        if(reduced||paused||scenes.length<2)return;
        timer=setInterval(()=>activate(current+1),5200);
      };

      tabs.forEach((tab,index)=>{
        tab.addEventListener('click',()=>{
          activate(index);
          start();
        });
        tab.addEventListener('keydown',event=>{
          if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
          event.preventDefault();
          const next=event.key==='Home'?0:event.key==='End'?tabs.length-1:current+(event.key==='ArrowRight'?1:-1);
          activate(next);
          tabs[current]?.focus();
          start();
        });
      });

      opsSimulator.addEventListener('pointerenter',()=>{paused=true;stop();},{passive:true});
      opsSimulator.addEventListener('pointerleave',()=>{paused=false;start();},{passive:true});
      opsSimulator.addEventListener('focusin',()=>{paused=true;stop();});
      opsSimulator.addEventListener('focusout',()=>{
        if(!opsSimulator.contains(document.activeElement)){paused=false;start();}
      });
      activate(0);
      start();
    }
  }

    // Cinematic sitewide experience: section presence, magnetic CTAs,
    // and a small system-status beacon. All effects are progressive enhancement.
    body.dataset.dpExperience='cinematic';

    const presenceTargets=[...document.querySelectorAll([
      'main > section',
      'main > .section',
      '.page-hero',
      '.recording-stage',
      '.platform-preview'
    ].join(','))];
    presenceTargets.forEach((el,index)=>{
      el.classList.add('dp-presence');
      el.style.setProperty('--dp-section-order',String(index));
    });

    if(typeof IntersectionObserver!=='undefined'){
      const presenceObserver=new IntersectionObserver(entries=>{
        for(const entry of entries){
          entry.target.classList.toggle('is-current',entry.isIntersecting&&entry.intersectionRatio>.16);
        }
      },{threshold:[0,.16,.42],rootMargin:'-12% 0px -18%'});
      presenceTargets.forEach(el=>presenceObserver.observe(el));
    }else{
      presenceTargets.forEach(el=>el.classList.add('is-current'));
    }

    if(finePointer){
      const magnets=[...document.querySelectorAll('.button,.demo-float-cta')];
      for(const el of magnets){
        el.addEventListener('pointermove',event=>{
          const r=el.getBoundingClientRect();
          const x=((event.clientX-r.left)/r.width-.5)*6;
          const y=((event.clientY-r.top)/r.height-.5)*5;
          el.style.setProperty('--mag-x',x.toFixed(2)+'px');
          el.style.setProperty('--mag-y',y.toFixed(2)+'px');
        },{passive:true});
        el.addEventListener('pointerleave',()=>{
          el.style.setProperty('--mag-x','0px');
          el.style.setProperty('--mag-y','0px');
        },{passive:true});
      }

      const header=document.querySelector('.site-header');
      header?.addEventListener('pointermove',event=>{
        const r=header.getBoundingClientRect();
        header.style.setProperty('--header-x',((event.clientX-r.left)/r.width*100).toFixed(1)+'%');
      },{passive:true});
    }

    if(!document.querySelector('.dp-protocol-beacon')){
      const beacon=document.createElement('div');
      beacon.className='dp-protocol-beacon';
      beacon.setAttribute('aria-hidden','true');
      beacon.innerHTML='<i></i><i></i><i></i>';
      document.body.append(beacon);
    }

  // Homepage-specific navigation/demo behavior remains owned by app.js.
  if (body.dataset.home === 'true') return;

  const toggle = document.querySelector('.menu-button');
  const nav = document.querySelector('#primary-nav');
  const close = () => {
    nav?.classList.remove('open');
    toggle?.setAttribute('aria-expanded','false');
  };
  toggle?.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') !== 'true';
    toggle.setAttribute('aria-expanded',String(open));
    nav?.classList.toggle('open',open);
  });
  nav?.addEventListener('click',close);
  document.addEventListener('keydown',e => {
    if(e.key==='Escape' && nav?.classList.contains('open')) {
      close();
      toggle?.focus();
    }
  });

  const form = document.querySelector('#lead-form');
  if (!form) return;
  const service = new URLSearchParams(location.search).get('service');
  if(service) form.elements.workflow.value = `I'm interested in ${service.slice(0,100)}. `;
  form.addEventListener('submit',async e => {
    e.preventDefault();
    const button=form.querySelector('button');
    const status=document.querySelector('#form-status');
    const values=Object.fromEntries(new FormData(form));
    const originalButton=button.innerHTML;
    let sent=false;

    button.disabled=true;
    button.classList.remove('is-sent');
    button.innerHTML='Sending… <span aria-hidden="true">→</span>';
    status.classList.remove('is-success','is-error');
    status.textContent='Sending your request…';

    try {
      const response=await fetch('https://formsubmit.co/ajax/pooledlp@gmail.com',{
        method:'POST',
        headers:{'Content-Type':'application/json',Accept:'application/json'},
        signal:AbortSignal.timeout(20000),
        body:JSON.stringify({
          ...values,
          _subject:`Dream Protocol workflow — ${values.company}`,
          _template:'table',
          _captcha:'false',
          source_page:location.pathname,
          ...(window.DREAMPROTOCOL_ATTRIBUTION||{})
        })
      });
      if(!response.ok)throw Error('Delivery failed');
      const result=await response.json();
      if(result.success!==true&&result.success!=='true')throw Error('Delivery failed');

      sent=true;
      button.classList.add('is-sent');
      button.innerHTML='Sent <span aria-hidden="true">✓</span>';
      status.classList.add('is-success');
      status.innerHTML='<strong>✓ Request sent</strong><span>Thanks. We’ll review your workflow and get back to you shortly.</span>';
      status.scrollIntoView?.({behavior:media('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'nearest'});
      setTimeout(()=>form.reset(),1200);
    } catch {
      status.classList.add('is-error');
      status.innerHTML='<strong>Couldn’t send.</strong><span>Try again or email <a href="mailto:hello@dreamprotocol.ai">hello@dreamprotocol.ai</a>.</span>';
      button.innerHTML=originalButton;
      status.scrollIntoView?.({behavior:media('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'nearest'});
    } finally {
      if(!sent)button.disabled=false;
    }
  });
})();
