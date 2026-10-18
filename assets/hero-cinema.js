(() => {
  'use strict';
  const hero = document.querySelector('[data-hero-cinema]');
  if (!hero) return;

  const desktopVideos = [...hero.querySelectorAll('[data-film-variant="desktop"]')];
  const mobileVideos = [...hero.querySelectorAll('[data-film-variant="mobile"]')];
  const marks = [...hero.querySelectorAll('[data-cinema-progress]')];
  const chapter = hero.querySelector('[data-cinema-chapter]');
  const title = hero.querySelector('[data-cinema-headline]');
  const detail = hero.querySelector('[data-cinema-detail]');
  const moment = hero.querySelector('.cinema-moment');
  const mobile = matchMedia('(max-width: 760px)');
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

  const chapters = [
    ['01 / CUSTOMER CARE', 'A customer calls.', 'They get an answer. Your team keeps moving.'],
    ['02 / FOLLOW-THROUGH', 'A new lead arrives.', 'The right details land with the right person.'],
    ['03 / MOMENTUM', 'The work gets done.', 'No chasing updates through five different systems.'],
    ['04 / TIME BACK', 'You get your evening.', 'The business carries on, without pulling you back in.']
  ];

  let desktopStep = 0;
  let desktopTimer = null;
  let mobileActive = 0;
  let mobileFinished = false;
  let mobileStarted = false;
  let mode = '';

  const hydrate = video => {
    if (!video || !video.dataset.src || video.getAttribute('src')) return;
    video.src = video.dataset.src;
    video.preload = 'auto';
    video.load();
  };

  const play = video => {
    if (!video || document.hidden || reduceMotion.matches) return;
    video.muted = true;
    video.defaultMuted = true;
    const result = video.play();
    if (result && typeof result.catch === 'function') result.catch(() => {});
  };

  const pauseAll = videos => videos.forEach(video => video.pause());
  const clearDesktopTimer = () => {
    if (desktopTimer !== null) clearInterval(desktopTimer);
    desktopTimer = null;
  };

  function showDesktopStep(index) {
    desktopStep = index % chapters.length;
    const story = chapters[desktopStep];
    if (chapter) chapter.textContent = story[0];
    if (title) title.textContent = story[1];
    if (detail) detail.textContent = story[2];
    marks.forEach((mark, i) => mark.classList.toggle('is-current', i === desktopStep));
    if (moment && !reduceMotion.matches) {
      moment.classList.remove('cinema-transition');
      void moment.offsetWidth;
      moment.classList.add('cinema-transition');
    }
    desktopVideos.forEach((video, i) => video.classList.toggle('is-live', i === desktopStep % 2));
  }

  // Mobile is a short, finite editorial sequence instead of a GIF-like loop.
  // Each scene is a real human moment, and the final frame remains onscreen.
  function showSecondMobileScene() {
    if (!mobile.matches || mobileActive !== 0 || reduceMotion.matches) return;
    const second = mobileVideos[1];
    if (!second) return;
    hydrate(second);
    if (second.readyState < 2) {
      second.addEventListener('loadeddata', showSecondMobileScene, {once: true});
      return;
    }
    mobileActive = 1;
    mobileVideos[0]?.classList.remove('is-live');
    second.classList.add('is-live');
    play(second);
    // Keep the outgoing scene behind the dissolve, then release it.
    window.setTimeout(() => mobileVideos[0]?.pause(), 1750);
  }

  if (mobileVideos.length === 2) {
    mobileVideos[0].addEventListener('timeupdate', () => {
      const first = mobileVideos[0];
      if (!mobile.matches || mobileActive !== 0 || !Number.isFinite(first.duration)) return;
      if (first.currentTime >= Math.min(21, Math.max(1, first.duration - 2.2))) {
        showSecondMobileScene();
      }
    });
    mobileVideos[0].addEventListener('ended', showSecondMobileScene);
    mobileVideos[1].addEventListener('ended', () => {
      mobileFinished = true;
      const last = mobileVideos[1];
      last.pause();
      if (Number.isFinite(last.duration) && last.duration > .3) {
        try { last.currentTime = last.duration - .18; } catch {}
      }
    });
  }

  function syncPlayback() {
    if (document.hidden || reduceMotion.matches) {
      clearDesktopTimer();
      pauseAll([...desktopVideos, ...mobileVideos]);
      return;
    }
    const nextMode = mobile.matches ? 'mobile' : 'desktop';
    if (nextMode !== mode) {
      clearDesktopTimer();
      pauseAll([...desktopVideos, ...mobileVideos]);
      mode = nextMode;
    }

    if (mode === 'desktop') {
      desktopVideos.forEach(video => {
        hydrate(video);
        play(video);
      });
      showDesktopStep(desktopStep);
      if (desktopTimer === null) {
        desktopTimer = window.setInterval(() => showDesktopStep(desktopStep + 1), 6700);
      }
      return;
    }

    // On phones only the two portrait sources load. Desktop movies are never fetched.
    clearDesktopTimer();
    if (!mobileStarted) {
      mobileStarted = true;
      mobileActive = 0;
      mobileVideos[0]?.classList.add('is-live');
      mobileVideos[1]?.classList.remove('is-live');
      hydrate(mobileVideos[0]);
      // Prepare the next scene without displaying it.
      hydrate(mobileVideos[1]);
    }
    if (!mobileFinished) play(mobileVideos[mobileActive]);
  }

  document.addEventListener('visibilitychange', syncPlayback);
  if (typeof mobile.addEventListener === 'function') mobile.addEventListener('change', syncPlayback);
  if (typeof reduceMotion.addEventListener === 'function') reduceMotion.addEventListener('change', syncPlayback);
  window.addEventListener('pagehide', () => {
    clearDesktopTimer();
    pauseAll([...desktopVideos, ...mobileVideos]);
  }, {once:true});

  showDesktopStep(0);
  syncPlayback();
})();
