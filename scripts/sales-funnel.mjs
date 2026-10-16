/**
 * Shared conversion components. Renders inside the existing Dream Protocol
 * layout; never introduces a competing header, footer or design system.
 */
export const verticalLinks = (verticals, esc, current = '') => {
  const items = verticals.filter(v => v.slug !== current);
  return `<div class="sales-vertical-grid">${items.map(v => `<a class="sales-vertical-card" href="/${esc(v.slug)}/"><span class="eyebrow">${esc(v.eyebrow)}</span><strong>${esc(v.label)}</strong><small>${esc(v.description)}</small><span class="sales-card-arrow" aria-hidden="true">Explore ↗</span></a>`).join('')}</div>`;
};

export const verticalLanding = (v, esc, verticals) => {
  const contact = '/contact/?service='+encodeURIComponent('AI receptionist - '+v.label)+'&source='+encodeURIComponent(v.source+'-industry');
  const flow = v.steps.map(([title,description],i) => `<article class="sales-step"><span class="sales-step-num">${String(i+1).padStart(2,'0')}</span><h3>${esc(title)}</h3><p>${esc(description)}</p></article>`).join('');
  const faq = v.faq.map(([question,answer]) => `<details><summary>${esc(question)}<span aria-hidden="true">+</span></summary><p>${esc(answer)}</p></details>`).join('');
  return `
<div class="sales-page" data-sales-vertical="${esc(v.source)}">
<section class="page-hero shell sales-hero">
 <div class="sales-hero-copy">
  <p class="eyebrow">${esc(v.eyebrow)} / BAY AREA</p>
  <h1>${esc(v.headline).replace('\\n','<br>')}</h1>
  <p>${esc(v.lead)}</p>
  <div class="actions"><a class="button" href="${contact}">Get my AI receptionist ↗</a><a class="text-link" href="/#demo">Try the live voice demo ↗</a></div>
  <p class="sales-fineprint">Plans from $399/month · Setup from $995 · Usage and integrations quoted upfront</p>
 </div>
 <div class="sales-hero-panel" aria-label="Illustrative front desk workflow">
   <span class="sales-console-top"><i></i>DREAMWORKFORCE / CALL TO ACTION</span>
   <div class="sales-console-event"><small>INBOUND INQUIRY</small><strong>${esc(v.frictions[0])}</strong></div>
   <div class="sales-console-arrow" aria-hidden="true">↓</div>
   <div class="sales-console-event active"><small>APPROVED AI WORKFLOW</small><strong>Answer → Collect → Route to team</strong></div>
   <div class="sales-console-status"><span>Human handoff built in</span><span>Example, not live call data</span></div>
 </div>
</section>
<section class="section shell sales-problem"><div class="section-heading"><p class="eyebrow">THE PROBLEM</p><h2>Good inquiries.<br><em>Bad timing.</em></h2><p>A front desk should help your team serve customers, not interrupt the work that earns their trust.</p></div>
 <div class="sales-problem-list">${v.frictions.map((p,i)=>`<div><span>0${i+1}</span><p>${esc(p)}</p></div>`).join('')}</div>
</section>
<section class="section pale-section"><div class="shell"><div class="section-heading"><p class="eyebrow">WHAT DREAMWORKFORCE DOES</p><h2>One call.<br><em>A useful next step.</em></h2><p>Approved knowledge and documented rules are the difference between an impressive demo and a dependable business workflow.</p></div>
<div class="sales-steps">${flow}</div></div></section>
<section class="section shell"><div class="sales-example"><div><p class="eyebrow">ILLUSTRATIVE SCENARIO</p><h2>Picture this call.</h2><p>${esc(v.scenario)}</p><p class="sales-fineprint">${esc(v.handoff)}</p></div><div class="sales-offer-box"><span class="eyebrow">START WITH ONE LOCATION</span><strong>$399<small> / month from</small></strong><p>Setup from $995. Final price depends on call volume, integrations and approved workflows.</p><a class="button" href="${contact}">Request my tailored demo ↗</a><a class="text-link" href="/ai-receptionist-offer/">Compare the core offer ↗</a></div></div></section>
<section class="section shell sales-faq"><div class="section-heading"><p class="eyebrow">BEFORE YOU BUY</p><h2>Answers without the hype.</h2></div><div class="sales-faq-list">${faq}</div></section>
<section class="section shell sales-related"><div class="section-heading"><p class="eyebrow">BUILT FOR BUSINESS</p><h2>Different work.<br><em>Same reliable system.</em></h2><p>DreamWorkforce can be tailored to other industries and existing business tools.</p></div>${verticalLinks(verticals,esc,v.slug)}</section>
<section class="cta-band"><div class="shell sales-bottom-cta"><div><p class="eyebrow">START WITH YOUR REAL PHONE WORKFLOW</p><h2>Your next inquiry deserves an answer.</h2><p>Tell us about your call volume and handoff process. We'll scope the first useful version.</p></div><div class="cta-actions"><a class="button" href="${contact}">Get a practical build plan ↗</a><a class="text-link" href="/#demo">Hear the live demo ↗</a></div></div></section>
</div>`;
};
