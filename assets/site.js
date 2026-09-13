(() => {
  'use strict';
  // The homepage retains the existing demo, navigation, and lead-delivery integration.
  if (document.body.dataset.home === 'true') return;
  const toggle = document.querySelector('.menu-button');
  const nav = document.querySelector('#primary-nav');
  const close = () => { nav.classList.remove('open'); toggle.setAttribute('aria-expanded','false'); };
  toggle?.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') !== 'true';
    toggle.setAttribute('aria-expanded',String(open));
    nav.classList.toggle('open',open);
  });
  nav?.addEventListener('click',close);
  document.addEventListener('keydown',e => { if(e.key==='Escape' && nav?.classList.contains('open')) { close(); toggle.focus(); } });
  const form = document.querySelector('#lead-form');
  if (!form) return;
  const service = new URLSearchParams(location.search).get('service');
  if(service) form.elements.workflow.value = `I'm interested in ${service.slice(0,100)}. `;
  form.addEventListener('submit',async e => {
    e.preventDefault();
    const button=form.querySelector('button');
    const status=document.querySelector('#form-status');
    const values=Object.fromEntries(new FormData(form));
    button.disabled=true; status.textContent='Sending…';
    try {
      const response=await fetch('https://formsubmit.co/ajax/pooledlp@gmail.com',{
        method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},signal:AbortSignal.timeout(20000),
        body:JSON.stringify({...values,_subject:`Dream Protocol workflow — ${values.company}`,_template:'table',_captcha:'false',source_page:location.pathname,...(window.DREAMPROTOCOL_ATTRIBUTION||{})})
      });
      if(!response.ok)throw Error('Delivery failed');
      const result=await response.json();
      if(result.success!==true&&result.success!=='true')throw Error('Delivery failed');
      form.reset();status.textContent='Got it. We’ll follow up with a practical next step.';
    } catch { status.textContent='We couldn’t send that just now. Your details are still here. Try again or email hello@dreamprotocol.ai.'; }
    finally{button.disabled=false;}
  });
})();
