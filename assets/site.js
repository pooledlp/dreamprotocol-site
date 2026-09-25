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
      '.contact-path'
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
        '.cinematic-contact .lead-form'
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
    button.disabled=true;
    status.textContent='Sending…';
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
      form.reset();
      status.textContent='Got it. We’ll follow up with a practical next step.';
    } catch {
      status.textContent='We couldn’t send that just now. Your details are still here. Try again or email hello@dreamprotocol.ai.';
    } finally {
      button.disabled=false;
    }
  });
})();
