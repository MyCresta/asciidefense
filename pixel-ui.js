import { GLYPHS, FALLBACK } from './pixel-style.js?v=3.12.1';
import { STROKES, DOTS } from './vector-style.js?v=3.12.1';
import { POWERS, UPGRADES } from './content.js?v=3.12.1';
import { WEAPONS } from './weapons.js?v=3.12.1';
import { CURSE_ICON } from './workshop.js?v=3.12.1';
import { SERVICES, EMPTY_ICON } from './workbench-ui.js?v=3.12.1';
import { ICON_KEYS, iconSVG, svgURL, wordmarkSVG } from './vector-icons.js?v=3.12.1';

// In the pixel and vector styles, ASCII art in the interface (the wordmark, the
// workshop icons and the relic and blueprint sigils) is redrawn inside the same
// text box, so nothing moves. In pixels each glyph becomes a 3x5 block, which
// keeps the pixels about square in a monospace cell. Vector swaps each drawing
// for its own line icon (vector-icons.js), painted as a mask in the text color.
const SELECTOR = '#wordmark, .upgrade-icon, .power-sigil';

// Which icon each ASCII drawing stands for. Drawings are unique per item.
const ICONS = new Map();
const addIcon = (art, motif, badge) => { if (art && !ICONS.has(art)) ICONS.set(art, { motif, badge }); };
for (const [key, power] of Object.entries(POWERS)) addIcon(power.sigil, ICON_KEYS.relic[key], power.family);
for (const [key, upgrade] of Object.entries(UPGRADES)) addIcon(upgrade.icon, ICON_KEYS.upgrade[key], 'plate');
for (const [key, weapon] of Object.entries(WEAPONS)) addIcon(weapon.icon, ICON_KEYS.weapon[key]);
for (const [key, service] of Object.entries(SERVICES)) addIcon(service.icon, ICON_KEYS.service[key]);
addIcon(EMPTY_ICON, 'socket');
addIcon(CURSE_ICON, 'skull', 'Cursed');
addIcon('  [*]  ', 'star');
export const vectorIconFor = art => ICONS.get(art);
const WORDMARK = wordmarkSVG();
const ROWS = [0, 0, 1, 2, 2];
const BLOCK = 'xxxxxxxxx';

function renderVector(text, color, align) {
  const lines = text.split('\n');
  const columns = Math.max(1, ...lines.map(line => line.length));
  const W = 12, H = 20;
  const canvas = document.createElement('canvas');
  canvas.width = columns * W;
  canvas.height = lines.length * H;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = ctx.strokeStyle = color;
  ctx.lineCap = ctx.lineJoin = 'round';
  lines.forEach((line, row) => {
    const shift = align === 'center' ? (columns - line.length) / 2 : align === 'right' ? columns - line.length : 0;
    for (let col = 0; col < line.length; col++) {
      const char = line[col];
      if (char === ' ') continue;
      ctx.save();
      ctx.translate((col + shift + .5) * W, (row + .5) * H);
      if (char === '#' || char === '@') {
        // Neighbouring blocks overlap a little so letters read as solid shapes.
        ctx.beginPath();
        ctx.roundRect(-W / 2 - .6, -H / 2 - .6, W + 1.2, H + 1.2, 3.5);
        ctx.fill();
      } else {
        ctx.scale(W * .42, H * .42);
        ctx.lineWidth = 2.4 / (W * .42);
        if (STROKES[char]) ctx.stroke(new Path2D(STROKES[char]));
        for (const [dx, dy] of DOTS[char] || []) { ctx.beginPath(); ctx.arc(dx, dy, .22, 0, Math.PI * 2); ctx.fill(); }
        if (!STROKES[char] && !DOTS[char]) { ctx.beginPath(); ctx.arc(0, 0, .3, 0, Math.PI * 2); ctx.fill(); }
      }
      ctx.restore();
    }
  });
  return canvas.toDataURL();
}

function render(text, color, align) {
  const lines = text.split('\n');
  const columns = Math.max(1, ...lines.map(line => line.length));
  const canvas = document.createElement('canvas');
  canvas.width = columns * 3;
  canvas.height = lines.length * 5;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = color;
  lines.forEach((line, row) => {
    const shift = align === 'center' ? (columns - line.length) / 2 : align === 'right' ? columns - line.length : 0;
    for (let col = 0; col < line.length; col++) {
      const char = line[col];
      if (char === ' ') continue;
      const pattern = char === '#' || char === '@' ? BLOCK : GLYPHS[char] || FALLBACK;
      const left = Math.round((col + shift) * 3);
      for (let y = 0; y < 5; y++) {
        for (let x = 0; x < 3; x++) {
          if (pattern[ROWS[y] * 3 + x] === 'x') ctx.fillRect(left + x, row * 5 + y, 1, 1);
        }
      }
    }
  });
  return canvas.toDataURL();
}

export function initPixelUI() {
  const root = document.documentElement;
  const seen = new WeakSet();
  const painted = new WeakMap();
  const active = () => root.dataset.art === 'pixel' || root.dataset.art === 'vector';

  function paint(node) {
    if (!active() || !node.isConnected) return;
    const text = node.textContent;
    const box = node.getBoundingClientRect();
    if (!text.trim() || box.width < 1) return;
    const range = document.createRange();
    range.selectNodeContents(node);
    const area = range.getBoundingClientRect();
    const styles = getComputedStyle(node);
    // Painted while the text is transparent, so read the theme's ink instead of the live color.
    const color = styles.getPropertyValue('--glyph-ink').trim() || styles.getPropertyValue('--ink').trim();
    const mode = root.dataset.art;
    const key = [mode, text, color, styles.textAlign, area.width, area.height, box.width, box.height].join('|');
    if (painted.get(node) === key) return;
    painted.set(node, key);
    const icon = mode === 'vector' && (node.id === 'wordmark' ? 'wordmark' : ICONS.get(text));
    node.classList.toggle('glyph-mask', Boolean(icon));
    if (icon === 'wordmark') {
      // Fit the lettering to the ASCII wordmark's box, left aligned and centered vertically.
      const height = Math.min(area.height * .78, area.width / WORDMARK.ratio);
      node.style.setProperty('--glyph-image', svgURL(WORDMARK.svg));
      node.style.setProperty('--glyph-position', `${area.left - box.left}px ${area.top - box.top + (area.height - height) / 2}px`);
      node.style.setProperty('--glyph-size', `${height * WORDMARK.ratio}px ${height}px`);
    } else if (icon) {
      // A square icon in the drawing's place, never outside the element's own box.
      const size = Math.min(box.width, box.height, area.height * 1.3);
      const centerY = Math.min(Math.max(area.top + area.height / 2, box.top + size / 2), box.bottom - size / 2);
      const left = styles.textAlign === 'center' ? area.left + area.width / 2 - size / 2 : area.left;
      node.style.setProperty('--glyph-image', svgURL(iconSVG(icon.motif, icon.badge)));
      node.style.setProperty('--glyph-position', `${Math.max(0, left - box.left)}px ${centerY - size / 2 - box.top}px`);
      node.style.setProperty('--glyph-size', `${size}px ${size}px`);
    } else {
      node.style.setProperty('--glyph-image', `url(${(mode === 'vector' ? renderVector : render)(text, color, styles.textAlign)})`);
      node.style.setProperty('--glyph-position', `${area.left - box.left}px ${area.top - box.top}px`);
      node.style.setProperty('--glyph-size', `${area.width}px ${area.height}px`);
    }
  }

  const resize = new ResizeObserver(entries => { for (const entry of entries) paint(entry.target); });
  const changes = new MutationObserver(records => {
    for (const record of records) {
      const target = record.target.nodeType === 1 ? record.target : record.target.parentElement;
      const node = target?.closest(SELECTOR);
      if (node) paint(node);
      for (const added of record.addedNodes) if (added.nodeType === 1) adopt(added);
    }
  });

  function watch(node) {
    if (seen.has(node)) return;
    seen.add(node);
    node.classList.add('glyph-art');
    resize.observe(node);
    paint(node);
  }

  function adopt(scope) {
    if (scope.matches?.(SELECTOR)) watch(scope);
    scope.querySelectorAll?.(SELECTOR).forEach(watch);
  }

  function refresh() {
    document.querySelectorAll(SELECTOR).forEach(node => { painted.delete(node); watch(node); paint(node); });
  }

  adopt(document);
  changes.observe(document.body, { subtree: true, childList: true, characterData: true });
  new MutationObserver(refresh).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
  document.fonts?.ready.then(refresh);
  return { refresh };
}
