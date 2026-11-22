// The swatch colors are read from each theme's CSS variables, just like the battlefield.
const themes = {
  terminal: 'Terminal', mono: 'Monochrome', amber: 'Amber', ice: 'Glacier',
  ember: 'Ember', orchid: 'Orchid', cobalt: 'Cobalt', tide: 'Tidepool',
  rose: 'Wild Rose', blueprint: 'Blueprint', paper: 'Paper', dusk: 'Dusk',
  // Blue/orange and pure luminance pairs stay distinct under common color vision deficiencies.
  signal: 'Signal (CVD)', contrast: 'High contrast'
};

export function initAppearance({ onChange } = {}) {
  const root = document.documentElement;
  const trigger = document.getElementById('theme-button');
  const control = trigger.closest('.theme-control');
  const menu = document.getElementById('theme-menu');
  const label = document.getElementById('theme-name');
  const arrow = trigger.querySelector('.arrow');
  const themeColor = document.querySelector('meta[name="theme-color"]');
  const options = document.createElement('div');
  options.className = 'theme-options';
  options.setAttribute('role', 'none');
  trigger.setAttribute('aria-haspopup', 'menu');
  menu.setAttribute('role', 'menu');
  const items = [];
  let active = '';
  let search = '';
  let lastKeyTime = 0;

  function close(focus = false) {
    menu.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    if (arrow) arrow.textContent = 'v';
    if (focus) trigger.focus({ preventScroll: true });
    search = '';
  }

  function fit() {
    if (menu.hidden) return;
    const viewport = window.visualViewport;
    const left = viewport?.offsetLeft || 0;
    const top = viewport?.offsetTop || 0;
    const width = viewport?.width || root.clientWidth;
    const height = viewport?.height || root.clientHeight;
    const anchor = control.getBoundingClientRect();
    const gutter = 8;
    menu.style.maxWidth = Math.max(1, width - 2 * gutter) + 'px';
    const preferredLeft = anchor.right - menu.offsetWidth;
    const menuLeft = Math.max(left + gutter, Math.min(preferredLeft, left + width - gutter - menu.offsetWidth));
    menu.style.right = Math.round(preferredLeft - menuLeft) + 'px';
    const below = top + height - anchor.bottom - gutter - 4;
    const above = anchor.top - top - gutter - 4;
    const openAbove = below < menu.scrollHeight && above > below;
    menu.dataset.side = openAbove ? 'above' : 'below';
    menu.style.maxHeight = Math.max(1, openAbove ? above : below) + 'px';
  }

  function focusItem(item) {
    item.focus({ preventScroll: true });
    // Scroll only the options. Moving keyboard focus must leave the battlefield in place.
    const row = item.getBoundingClientRect();
    const area = options.getBoundingClientRect();
    if (row.top < area.top) options.scrollTop += row.top - area.top;
    if (row.bottom > area.bottom) options.scrollTop += row.bottom - area.bottom;
  }

  function apply(key, save) {
    active = Object.hasOwn(themes, key) ? key : 'terminal';
    root.dataset.theme = active;
    label.textContent = themes[active];
    trigger.setAttribute('aria-label', 'Color theme: ' + themes[active]);
    for (const item of items) {
      const current = item.dataset.key === active;
      item.setAttribute('aria-checked', String(current));
      item.firstElementChild.textContent = current ? '[x]' : '[ ]';
    }
    if (themeColor) themeColor.content = getComputedStyle(root).getPropertyValue('--bg').trim();
    if (save) {
      try { localStorage.setItem('last-spire.theme', active); } catch { /* Session-only preference. */ }
      onChange?.(active);
    }
  }

  for (const [key, name] of Object.entries(themes)) {
    const item = document.createElement('button');
    item.type = 'button';
    item.dataset.key = key;
    item.tabIndex = -1;
    item.setAttribute('role', 'menuitemradio');
    item.setAttribute('aria-label', name);
    const mark = document.createElement('span');
    mark.className = 'theme-check';
    mark.setAttribute('aria-hidden', 'true');
    const title = document.createElement('span');
    title.textContent = name;
    const swatch = document.createElement('span');
    swatch.className = 'theme-swatch';
    swatch.dataset.theme = key;
    swatch.setAttribute('aria-hidden', 'true');
    for (const token of ['muted', 'ink', 'accent']) {
      const sample = document.createElement('span');
      sample.className = 'sample-' + token;
      sample.textContent = '#';
      swatch.append(sample);
    }
    item.append(mark, title, swatch);
    item.addEventListener('click', () => { apply(key, true); close(true); });
    options.append(item);
    items.push(item);
  }
  menu.append(options);
  let saved = 'terminal';
  try { saved = localStorage.getItem('last-spire.theme') || saved; } catch { /* Use the default theme. */ }
  apply(saved, false);

  function open() {
    menu.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
    if (arrow) arrow.textContent = '^';
    fit();
    focusItem(items.find(item => item.dataset.key === active));
  }
  trigger.addEventListener('click', () => { if (menu.hidden) open(); else close(true); });
  control.addEventListener('keydown', event => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const key = event.key;
    if (menu.hidden) {
      if (key !== 'ArrowDown' && key !== 'ArrowUp') return;
      event.preventDefault();
      event.stopPropagation();
      open();
      return;
    }
    if (key === 'Tab') {
      close(true);
      return;
    }
    event.stopPropagation();
    if (key === 'Escape') {
      event.preventDefault();
      close(true);
      return;
    }
    const index = items.indexOf(document.activeElement);
    const columns = getComputedStyle(options).gridTemplateColumns.split(' ').length;
    const steps = { ArrowDown: columns, ArrowUp: -columns, ArrowLeft: -1, ArrowRight: 1 };
    let next;
    if (Object.hasOwn(steps, key)) next = (index + steps[key] + items.length) % items.length;
    else if (key === 'Home') next = 0;
    else if (key === 'End') next = items.length - 1;
    else if (/^[a-z]$/i.test(key)) {
      const now = performance.now();
      search = (now - lastKeyTime < 700 ? search : '') + key.toLowerCase();
      lastKeyTime = now;
      next = items.findIndex(item => themes[item.dataset.key].toLowerCase().startsWith(search));
      if (next < 0) return;
    } else return;
    event.preventDefault();
    focusItem(items[next]);
  });
  document.addEventListener('pointerdown', event => {
    if (!menu.hidden && !control.contains(event.target)) close();
  });
  control.addEventListener('focusout', event => {
    if (!menu.hidden && !control.contains(event.relatedTarget)) close();
  });
  window.addEventListener('resize', fit, { passive: true });
  window.visualViewport?.addEventListener('resize', fit, { passive: true });
  return { close, get isOpen() { return !menu.hidden; } };
}
