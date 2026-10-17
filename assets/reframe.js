(() => {
  'use strict';
  const buttons = [...document.querySelectorAll('[data-day-select]')];
  const panels = [...document.querySelectorAll('[data-day-panel]')];
  if (!buttons.length || !panels.length) return;
  function activate(index, focus = false) {
    buttons.forEach((button, i) => {
      const selected = i === index;
      button.setAttribute('aria-selected', String(selected));
      button.tabIndex = selected ? 0 : -1;
      button.classList.toggle('is-active', selected);
      if (selected && focus) button.focus();
    });
    panels.forEach((panel, i) => {
      panel.hidden = i !== index;
      panel.classList.toggle('is-active', i === index);
    });
  }
  buttons.forEach((button, i) => {
    button.addEventListener('click', () => activate(i));
    button.addEventListener('keydown', event => {
      if (!['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const next = event.key === 'Home' ? 0
        : event.key === 'End' ? buttons.length - 1
        : (i + (event.key === 'ArrowDown' || event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length;
      activate(next, true);
    });
  });
  activate(0);
})();
