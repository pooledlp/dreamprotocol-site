(() => {
  'use strict';
  const hero = document.querySelector('[data-hero-cinema]');
  if (!hero) return;
  const videos = [...hero.querySelectorAll('.cinema-shot')];
  const marks = [...hero.querySelectorAll('[data-cinema-progress]')];
  const chapter = hero.querySelector('[data-cinema-chapter]');
  const title = hero.querySelector('[data-cinema-headline]');
  const detail = hero.querySelector('[data-cinema-detail]');
  const moment = hero.querySelector('.cinema-moment');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const chapters = [
    ['01 / CUSTOMER CARE','A customer calls.','They get an answer. Your team keeps moving.'],
    ['02 / FOLLOW-THROUGH','A new lead arrives.','The right details land with the right person.'],
    ['03 / MOMENTUM','The work gets done.','No chasing updates through five different systems.'],
    ['04 / TIME BACK','You get your evening.','The business carries on, without pulling you back in.']
  ];
  let step = 0;
  let timer = null;
  function display(index) {
    step = index % chapters.length;
    if(chapter) chapter.textContent = chapters[step][0];
    if(title) title.textContent = chapters[step][1];
    if(detail) detail.textContent = chapters[step][2];
    marks.forEach((mark,i) => mark.classList.toggle('is-current',i === step));
    if(moment) {
      moment.classList.remove('cinema-transition');
      void moment.offsetWidth;
      moment.classList.add('cinema-transition');
    }
    const nextShot = step % 2;
    videos.forEach((video,i) => video.classList.toggle('is-live', i === nextShot));
  }
  function playVisible() {
    videos.forEach(video => {
      video.muted = true;
      video.defaultMuted = true;
      if (motion.matches || document.hidden) { video.pause(); return; }
      const p = video.play();
      if (p && typeof p.catch === 'function') p.catch(()=>{});
    });
  }
  function stop() {
    if (timer) clearInterval(timer);
    timer = null;
    videos.forEach(video => video.pause());
  }
  function start() {
    stop();
    if (motion.matches || document.hidden) return;
    playVisible();
    timer = setInterval(() => display(step+1), 6700);
  }
  display(0);
  start();
  document.addEventListener('visibilitychange', () => document.hidden ? stop() : start());
  if (typeof motion.addEventListener === 'function') motion.addEventListener('change', () => { display(0); start(); });
  window.addEventListener('pagehide',stop,{once:true});
})();
