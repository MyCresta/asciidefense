import { AsciiStyle } from './ascii-style.js?v=3.10.0';
import { PixelStyle } from './pixel-style.js?v=3.10.0';
import { VectorStyle } from './vector-style.js?v=3.10.0';

const HALF_WORLD_WIDTH = 140;
const HALF_WORLD_HEIGHT = 84;
const SWAP_SECONDS = 1.1;
const REDUCED_MOTION = globalThis.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: true };
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
export const ART_STYLES = [AsciiStyle, PixelStyle, VectorStyle];

export class Field {
  constructor(canvas, game, onInspect) {
    this.canvas = canvas;
    this.game = game;
    this.onInspect = onInspect;
    this.ctx = canvas.getContext('2d');
    this.pointer = { x: 0, y: 0 };
    this.localPointer = null;
    this.hover = null;
    this.showRange = true;
    this.showNumbers = true;
    this.shake = 0;
    this.hitList = [];
    this.dirty = true;
    this.colorsDirty = true;
    this.keyTarget = null;
    this.styles = new Map();
    this.style = this.styleFor(AsciiStyle);
    this.styleKey = AsciiStyle.key;
    this.swap = null;
    if (!canvas.hasAttribute('tabindex')) canvas.tabIndex = 0;
    if (!canvas.hasAttribute('aria-label')) canvas.setAttribute('aria-label', 'Battlefield. Use arrow keys to cycle targets and Enter to inspect.');
    this.observer = new ResizeObserver(() => { this.dirty = true; });
    this.observer.observe(canvas);
    this.themeObserver = new MutationObserver(() => { this.colorsDirty = true; });
    this.themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    canvas.addEventListener('pointermove', event => {
      const point = this.localPoint(event);
      this.localPointer = point;
      this.pointer = this.unproject(point);
      this.hover = this.hitTest(point);
      this.keyTarget = null;
    });
    canvas.addEventListener('pointerleave', () => { this.localPointer = this.hover = null; });
    canvas.addEventListener('blur', () => { this.keyTarget = null; });
    canvas.addEventListener('click', event => {
      const target = this.hitTest(this.localPoint(event), event.pointerType === 'touch' || window.matchMedia?.('(pointer: coarse)').matches);
      if (target !== null) this.onInspect(target);
    });
    canvas.addEventListener('keydown', event => {
      const ids = ['tower', ...this.game.enemies.map(enemy => enemy.id)];
      if (event.key === 'Enter') {
        event.preventDefault();
        this.onInspect(ids.includes(this.keyTarget) ? this.keyTarget : 'tower');
      } else if (['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'].includes(event.key)) {
        event.preventDefault();
        const delta = ['ArrowRight', 'ArrowDown'].includes(event.key) ? 1 : -1;
        const current = ids.indexOf(this.keyTarget ?? this.game.selected);
        this.keyTarget = ids[(Math.max(current, 0) + delta + ids.length) % ids.length];
        this.onInspect(this.keyTarget);
      }
    });
  }

  localPoint(event) {
    const rect = this.canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  project(x, y) {
    const { ox, oy, sx, sy } = this.geometry;
    return { x: ox + x * sx, y: oy + y * sy };
  }

  unproject(point) {
    if (!this.geometry) return { x: 0, y: 0 };
    const { ox, oy, sx, sy } = this.geometry;
    return { x: Math.round((point.x - ox) / sx), y: Math.round((point.y - oy) / sy) };
  }

  hitTest(point, touch = false) {
    let nearest = null;
    let nearestDistance = Infinity;
    for (let index = this.hitList.length - 1; index >= 0; index--) {
      const { x, y, sprite, id } = this.hitList[index];
      const dx = point.x - x - sprite.width / 2;
      const dy = point.y - y - sprite.height / 2;
      const halfW = sprite.width / 2;
      const halfH = sprite.height / 2;
      if (Math.abs(dx) <= halfW && Math.abs(dy) <= halfH) {
        if (id !== 'tower') return id;
        const row = clamp(Math.floor((point.y - y - sprite.padding) / sprite.lineHeight), 0, sprite.bounds.length - 1);
        const { start, end } = sprite.bounds[row];
        const col = (point.x - x - sprite.padding) / sprite.cell;
        if (start >= 0 && col >= start - .5 && col <= end + .5) return id;
      }
      if (id === 'tower') continue;
      // Extend small targets to 44 CSS pixels on touch. A real sprite hit wins
      // over the padded bounds of another unit moving past it.
      const pad = touch ? 22 : 0;
      if (Math.abs(dx) > Math.max(halfW + 4, pad) || Math.abs(dy) > Math.max(halfH + 4, pad)) continue;
      const distance = dx * dx + dy * dy;
      if (distance < nearestDistance) {
        nearest = id;
        nearestDistance = distance;
      }
    }
    return nearest;
  }

  prepare() {
    const rect = this.canvas.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    if (w < 8 || h < 8) return false;
    const ratio = Math.min(window.devicePixelRatio || 1, 3);
    const styles = getComputedStyle(document.documentElement);
    const read = (name, fallback) => styles.getPropertyValue(name).trim() || fallback;
    this.colors = {
      bg: read('--surface', read('--bg', '#090b09')), ink: read('--ink', '#e5e7df'),
      accent: read('--accent', '#b5ed69'), muted: read('--muted', '#879083'), faint: read('--faint', '#343a32')
    };
    this.w = w;
    this.h = h;
    this.ratio = ratio;
    this.canvas.width = Math.round(w * ratio);
    this.canvas.height = Math.round(h * ratio);
    this.ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    this.ctx.textBaseline = 'middle';
    // A single linear projection drives positions, range, splash, and the
    // pointer readout. Keep enough space at the edges to show arriving units.
    const marginX = Math.min(w * .045, 32);
    const marginY = Math.min(h * .06, 24);
    this.geometry = {
      ox: w / 2, oy: h / 2,
      sx: (w / 2 - marginX) / HALF_WORLD_WIDTH,
      sy: (h / 2 - marginY) / HALF_WORLD_HEIGHT
    };
    this.dirty = false;
    this.colorsDirty = false;
    for (const style of this.styles.values()) style.stale = true;
    return true;
  }

  get busy() { return Boolean(this.swap); }

  // The Spire's position in the viewport, where a style swap starts.
  screenPoint() {
    if (!this.geometry) return null;
    const rect = this.canvas.getBoundingClientRect();
    return { x: rect.left + this.geometry.ox, y: rect.top + this.geometry.oy };
  }

  // Swap the art style live. Both styles paint the same frame while the new one
  // is revealed outward from the Spire, so the game never stops.
  setStyle(key, animate = true, reach = 0) {
    const Style = ART_STYLES.find(item => item.key === key) || AsciiStyle;
    if (this.swap) this.finishSwap();
    if (this.style.constructor === Style) return;
    const incoming = this.styleFor(Style);
    if (!animate || !this.geometry) {
      this.style = incoming;
      this.styleKey = Style.key;
      return;
    }
    const layer = this.swapLayer();
    layer.hidden = false;
    this.swap = { style: incoming, start: performance.now(), fade: REDUCED_MOTION.matches, reach };
    this.styleKey = Style.key;
  }

  styleFor(Style) {
    if (!this.styles.has(Style.key)) this.styles.set(Style.key, new Style(this));
    return this.styles.get(Style.key);
  }

  swapLayer() {
    if (this.overlay) return this.overlay;
    const layer = document.createElement('canvas');
    layer.className = 'field-swap';
    layer.setAttribute('aria-hidden', 'true');
    this.canvas.after(layer);
    this.overlay = layer;
    this.overlayCtx = layer.getContext('2d');
    return layer;
  }

  finishSwap() {
    if (!this.swap) return;
    this.style = this.swap.style;
    this.swap = null;
    const layer = this.overlay;
    layer.hidden = true;
    layer.style.maskImage = layer.style.webkitMaskImage = layer.style.opacity = '';
  }

  paintLayer(style, ctx, now, offset) {
    style.ctx = ctx;
    if (style.stale) style.prepare();
    ctx.setTransform(this.ratio, 0, 0, this.ratio, 0, 0);
    ctx.clearRect(0, 0, this.w, this.h);
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.globalAlpha = 1;
    ctx.translate(offset.x, offset.y);
    this.hitList.length = 0;
    style.paint(now);
  }

  render(timeSeconds = 0) {
    if ((this.dirty || this.colorsDirty || this.ratio !== Math.min(window.devicePixelRatio || 1, 3)) && !this.prepare()) return;
    const { game } = this;
    // A core hit shakes the view briefly. Reduced-motion settings keep it still.
    const offset = { x: 0, y: 0 };
    if (this.shake > 0 && !REDUCED_MOTION.matches) {
      const size = 3.5 * this.shake;
      offset.x = (Math.random() - .5) * 2 * size;
      offset.y = (Math.random() - .5) * 2 * size;
    }
    this.shake = 0;
    const now = game.status === 'running' ? timeSeconds : game.time;
    this.paintLayer(this.style, this.ctx, now, offset);
    const swap = this.swap;
    if (swap) {
      const layer = this.overlay;
      if (layer.width !== this.canvas.width || layer.height !== this.canvas.height) {
        layer.width = this.canvas.width;
        layer.height = this.canvas.height;
      }
      const t = clamp((performance.now() - swap.start) / 1000 / (swap.fade ? .3 : SWAP_SECONDS), 0, 1);
      // The incoming style is painted last, so its sprites take the hits.
      this.paintLayer(swap.style, this.overlayCtx, now, offset);
      if (swap.fade) layer.style.opacity = String(t);
      else {
        const { ox, oy } = this.geometry;
        const reach = swap.reach || Math.hypot(Math.max(ox, this.w - ox), Math.max(oy, this.h - oy)) + 30;
        const eased = t < .5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
        const radius = eased * reach;
        const mask = `radial-gradient(circle at ${ox}px ${oy}px, #000 ${Math.max(0, radius - 18)}px, transparent ${radius}px)`;
        layer.style.maskImage = layer.style.webkitMaskImage = mask;
        // The swap front is drawn on the outgoing frame, just outside the reveal.
        this.style.ctx = this.ctx;
        this.style.paintSweep(radius + 4);
      }
      if (t >= 1) {
        this.finishSwap();
        this.paintLayer(this.style, this.ctx, now, offset);
      }
    }
    if (this.localPointer) this.hover = this.hitTest(this.localPointer);
  }
}
