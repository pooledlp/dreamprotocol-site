(() => {
 'use strict';
 const stage=document.querySelector('.momentum-stage');
 if(!stage)return;
 const buttons=[...document.querySelectorAll('[data-momentum-select]')];
 const overline=stage.querySelector('[data-momentum-overline]');
 const title=stage.querySelector('[data-momentum-title]');
 const description=stage.querySelector('[data-momentum-description]');
 const result=stage.querySelector('[data-momentum-result]');
 const index=stage.querySelector('.momentum-stage-index');
 const stories={
  calls:{number:'01 — 03',overline:'01 / CUSTOMER CARE',title:'Every call.<br><em>Handled.</em>',description:'Customers get an answer. Your team keeps doing what matters.',result:'Call answered. Details captured.'},
  booking:{number:'02 — 03',overline:'02 / LESS BACK AND FORTH',title:'Schedules.<br><em>Sorted.</em>',description:'An appointment request moves forward without another game of phone tag.',result:'Availability checked. Request routed.'},
  followup:{number:'03 — 03',overline:'03 / FOLLOW-THROUGH',title:'Nothing.<br><em>Forgotten.</em>',description:'The right follow-up reaches the right person, without the chasing.',result:'Next step prepared. Team notified.'}
 };
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 function activate(key){
  const item=stories[key];
  if(!item)return;
  stage.dataset.momentumScene=key;
  overline.textContent=item.overline;
  title.innerHTML=item.title;
  description.textContent=item.description;
  result.textContent=item.result;
  index.textContent=item.number;
  buttons.forEach(btn=>{
   const selected=btn.dataset.momentumSelect===key;
   btn.classList.toggle('is-selected',selected);
   btn.setAttribute('aria-pressed',String(selected));
  });
  if(!reduced.matches){
   stage.classList.remove('is-changing');
   void stage.offsetWidth;
   stage.classList.add('is-changing');
  }
 }
 buttons.forEach((btn,i)=>{
  btn.addEventListener('click',()=>activate(btn.dataset.momentumSelect));
  btn.addEventListener('keydown',event=>{
   if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
   event.preventDefault();
   const next=event.key==='Home'?0:event.key==='End'?buttons.length-1:(i+(event.key==='ArrowRight'?1:-1)+buttons.length)%buttons.length;
   buttons[next].focus();
   activate(buttons[next].dataset.momentumSelect);
  });
 });
 activate('calls');
})();
