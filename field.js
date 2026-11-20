import { TOWER, ENEMY_ART } from './art.js';

const FONT = '"Lucida Console", "Liberation Mono", "Courier New", monospace';
const TAU = Math.PI * 2;
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

function randomSequence(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function surface(width, height, ratio) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.ceil(width * ratio));
  canvas.height = Math.max(1, Math.ceil(height * ratio));
  const ctx = canvas.getContext('2d');
  ctx.scale(ratio, ratio);
  ctx.textBaseline = 'middle';
  return { canvas, ctx, width, height };
}

// Give the area around the tower more screen space while keeping every entry edge visible.
function mapDistance(distance, nearPixels, farPixels, farUnits, inverse = false) {
  const nearUnits = 32;
  if (inverse) {
    if (distance <= nearPixels) return distance * nearUnits / nearPixels;
    return nearUnits + (distance - nearPixels) * (farUnits - nearUnits) / (farPixels - nearPixels);
  }
  if (distance <= nearUnits) return distance * nearPixels / nearUnits;
  return nearPixels + (distance - nearUnits) * (farPixels - nearPixels) / (farUnits - nearUnits);
}

function makeSprite(rows, lineHeight, ratio, colors, tower = false) {
  const fontSize = lineHeight * 1.04;
  const widthInChars = Math.max(...rows.map(row => row.length));
  const cell = fontSize * .6;
  const padding = 2;
  const image = surface(Math.ceil(widthInChars * cell + padding * 2), Math.ceil(rows.length * lineHeight + padding * 2), ratio);
  const { ctx } = image;
  const bounds = [];
  ctx.font = `${tower ? 600 : 700} ${fontSize}px ${FONT}`;
  for (let row = 0; row < rows.length; row++) {
    const line = rows[row];
    const start = line.search(/\S/);
    const end = line.trimEnd().length;
    bounds.push({ start, end });
    if (start < 0) continue;
    const y = padding + (row + .5) * lineHeight;
    if (tower) {
      // Ink unprinted interior spaces in the paper color to occlude the range ring behind the keep.
      ctx.fillStyle = colors.bg;
      ctx.fillRect(padding + cell * start, padding + lineHeight * row, cell * (end - start), lineHeight + .15);
    }
    let run = '';
    let runStart = start;
    let previous = '';
    for (let col = start; col <= end; col++) {
      const char = line[col] || ' ';
      let color = colors.ink;
      if (tower) {
        if (char === '*' || char === '@' || (row === 1 && char === '#')) color = colors.accent;
        else if (row === 13 && char === '|' && [27, 28, 32, 33].includes(col)) color = colors.accent;
        else if (char === '.' || char === ':' || char === ';' || char === "'") color = colors.muted;
      } else if (/[oO@*]/.test(char)) color = colors.accent;
      if (color !== previous || col === end) {
        if (run) {
          ctx.fillStyle = previous;
          ctx.fillText(run, padding + runStart * cell, y);
        }
        run = '';
        runStart = col;
        previous = color;
      }
      run += char;
    }
  }
  return { ...image, bounds, cell, lineHeight, padding };
}

export class Field {
  constructor(canvas, game, onInspect) {
    this.canvas = canvas;
    this.game = game;
    this.onInspect = onInspect;
    this.ctx = canvas.getContext('2d');
    this.pointer = { x: 0, y: 0 };
    this.hover = null;
    this.showRange = true;
    this.hitList = [];
    this.dirty = true;
    this.colorsDirty = true;
    this.keyTarget = null;
    if (!canvas.hasAttribute('tabindex')) canvas.tabIndex = 0;
    if (!canvas.hasAttribute('aria-label')) canvas.setAttribute('aria-label', 'Battlefield. Use arrow keys to cycle targets and Enter to inspect.');
    this.observer = new ResizeObserver(() => { this.dirty = true; });
    this.observer.observe(canvas);
    this.themeObserver = new MutationObserver(() => { this.colorsDirty = true; });
    this.themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    canvas.addEventListener('pointermove', event => {
      const point = this.localPoint(event);
      this.pointer = this.unproject(point);
      this.hover = this.hitTest(point);
      this.keyTarget = null;
    });
    canvas.addEventListener('pointerleave', () => { this.hover = null; });
    canvas.addEventListener('blur', () => { this.keyTarget = null; });
    canvas.addEventListener('click', event => {
      const target = this.hitTest(this.localPoint(event));
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
    const g = this.geometry;
    return {
      x: g.ox + Math.sign(x) * mapDistance(Math.abs(x), g.rx, g.xEdge, 100),
      y: g.oy + Math.sign(y) * mapDistance(Math.abs(y), g.ry, y < 0 ? g.north : g.south, 60)
    };
  }

  unproject(point) {
    if (!this.geometry) return { x: 0, y: 0 };
    const g = this.geometry;
    const dx = point.x - g.ox;
    const dy = point.y - g.oy;
    return {
      x: Math.round(Math.sign(dx) * mapDistance(Math.abs(dx), g.rx, g.xEdge, 100, true)),
      y: Math.round(Math.sign(dy) * mapDistance(Math.abs(dy), g.ry, dy < 0 ? g.north : g.south, 60, true))
    };
  }

  hitTest(point) {
    // Hit in reverse paint order. Use a little extra room for the smaller enemies.
    for (let index = this.hitList.length - 1; index >= 0; index--) {
      const hit = this.hitList[index];
      const { x, y, sprite, id } = hit;
      const pad = id === 'tower' ? 4 : 9;
      if (point.y < y - pad || point.y > y + sprite.height + pad || point.x < x - pad || point.x > x + sprite.width + pad) continue;
      if (id === 'tower') {
        const row = clamp(Math.floor((point.y - y - sprite.padding) / sprite.lineHeight), 0, sprite.bounds.length - 1);
        const { start, end } = sprite.bounds[row];
        if (start < 0 || point.x < x + sprite.cell * start - pad || point.x > x + sprite.cell * end + pad) continue;
      }
      return id;
    }
    return null;
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
    const ox = w * .5;
    const oy = h * .585;
    this.geometry = {
      ox, oy, xEdge: ox - 4, north: oy - 4, south: h - oy - 4,
      rx: Math.min(w * .258, h * .50), ry: Math.min(w * .142, h * .205)
    };
    const towerCols = Math.max(...TOWER.map(line => line.length));
    const towerLine = Math.min(w * (w < 520 ? .41 : .345) / (towerCols * .624), h * .585 / TOWER.length, 9);
    this.tower = makeSprite(TOWER, towerLine, ratio, this.colors, true);
    this.enemySprites = {};
    const enemyLine = clamp(Math.min(w / 79, h / 45), 6.6, 11.7);
    for (const [type, rows] of Object.entries(ENEMY_ART)) {
      this.enemySprites[type] = makeSprite(rows, enemyLine, ratio, this.colors);
    }
    this.terrain = this.makeTerrain();
    this.cachedCircle = null;
    this.dirty = false;
    this.colorsDirty = false;
    return true;
  }

  makeTerrain() {
    const { w, h, ratio, colors, geometry: g } = this;
    const image = surface(w, h, ratio);
    const { ctx } = image;
    const random = randomSequence(102351);
    // Patches of loose halftone grain imply an open plane. Every mark is a text glyph.
    ctx.font = `9px ${FONT}`;
    const dots = ['.', '.', '.', "'", '`', ','];
    const number = Math.ceil(w * h / 1450);
    for (let i = 0; i < number; i++) {
      const x = random() * w;
      const y = random() * h;
      ctx.globalAlpha = .20 + .25 * random();
      ctx.fillStyle = colors.muted;
      ctx.fillText(dots[Math.floor(random() * dots.length)], x, y);
    }
    const patches = [
      [.18, .26, .105, .047], [.85, .22, .08, .026], [.073, .62, .058, .055],
      [.81, .79, .097, .048], [.28, .85, .065, .034], [.59, .18, .058, .035],
      [.67, .5, .048, .022], [.35, .41, .055, .024]
    ];
    for (const [px, py, pw, ph] of patches) {
      const population = Math.ceil(w * pw * h * ph / 22);
      for (let i = 0; i < population; i++) {
        const dx = random() * 2 - 1;
        const dy = random() * 2 - 1;
        if (dx * dx + dy * dy > random()) continue;
        const x = px * w + dx * pw * w;
        const y = py * h + dy * ph * h - dx * ph * h * .37;
        ctx.globalAlpha = .17 + random() * .34;
        ctx.fillText(dots[Math.floor(random() * dots.length)], Math.round(x / 4) * 4, Math.round(y / 4) * 4);
      }
    }
    ctx.font = `11px ${FONT}`;
    for (let i = 0; i < Math.max(9, number / 16); i++) {
      ctx.globalAlpha = .25 + random() * .28;
      ctx.fillText('+', random() * w, random() * h);
    }
    // A stippled cast shadow gives the masonry a solid footing without drawing terrain objects.
    const baseY = g.oy + this.tower.height * .089;
    const sw = this.tower.width * .72;
    const sh = this.tower.height * .14;
    ctx.font = `9px ${FONT}`;
    for (let i = 0; i < Math.ceil(sw * sh / 10); i++) {
      const u = random() * 2 - 1;
      const v = random() * 2 - 1;
      const density = 1 - u * u - v * v;
      if (random() > density) continue;
      ctx.fillStyle = colors.muted;
      ctx.globalAlpha = .13 + density * .37;
      ctx.fillText(i % 6 === 0 ? ':' : '.', Math.round((g.ox + sw * (u + .12)) / 4) * 4, Math.round((baseY + sh * v - u * sh * .25) / 4) * 4);
    }
    return image;
  }

  rangeLayer() {
    const { range } = this.game;
    if (this.cachedCircle && this.cachedCircle.range === range) return this.cachedCircle;
    const image = surface(this.w, this.h, this.ratio);
    const { ctx } = image;
    const { rx, ry } = this.geometry;
    const count = Math.round(Math.PI * (rx + ry) * range / 32 / 6.4);
    ctx.fillStyle = this.colors.accent;
    ctx.textAlign = 'center';
    ctx.font = `600 11px ${FONT}`;
    for (let i = 0; i < count; i++) {
      const angle = TAU * i / count;
      const p = this.project(range * Math.cos(angle), range * Math.sin(angle));
      ctx.globalAlpha = .47;
      ctx.fillText('.', p.x, p.y - 2.4);
    }
    ctx.globalAlpha = .80;
    ctx.font = `11px ${FONT}`;
    for (let i = 0; i < 4; i++) {
      const angle = i * Math.PI / 2;
      const p = this.project(range * Math.cos(angle), range * Math.sin(angle));
      ctx.fillText('+', p.x, p.y);
    }
    this.cachedCircle = { ...image, range };
    return this.cachedCircle;
  }

  paintImage(image, x = 0, y = 0) {
    this.ctx.drawImage(image.canvas, x, y, image.canvas.width / this.ratio, image.canvas.height / this.ratio);
  }

  paintEnemy(enemy, p, now) {
    const sprite = this.enemySprites[enemy.type];
    if (!sprite) return;
    const { ctx, colors } = this;
    const seed = Number.parseInt(String(enemy.id).replace(/\D/g, ''), 10) || 0;
    const floating = enemy.type === 'moth' || enemy.type === 'wraith';
    const bob = Math.sin(now * (floating ? 3.6 : 5) + seed * 2.1) * (floating ? 1.7 : .55);
    const x = Math.round(p.x - sprite.width / 2);
    const y = Math.round(p.y - sprite.height / 2 + bob);
    this.paintImage(sprite, x, y);
    this.hitList.push({ x, y, sprite, id: enemy.id });
    const active = this.game.selected === enemy.id || this.hover === enemy.id || this.keyTarget === enemy.id;
    ctx.fillStyle = colors.accent;
    if (active) {
      ctx.font = `12px ${FONT}`;
      ctx.fillText('[', x - 8, p.y);
      ctx.fillText(']', x + sprite.width + 1, p.y);
    }
    if (active || enemy.hp < enemy.maxHp) {
      const n = 5;
      const full = clamp(Math.ceil(n * enemy.hp / enemy.maxHp), 0, n);
      ctx.font = `bold 7px ${FONT}`;
      ctx.fillStyle = colors.muted;
      const left = p.x - n * 2.1;
      ctx.fillText('-'.repeat(n), left, y + sprite.height + 3);
      ctx.fillStyle = colors.accent;
      ctx.fillText('='.repeat(full), left, y + sprite.height + 3);
    }
  }

  paintTower() {
    const { ctx, tower, geometry: g } = this;
    const x = Math.round(g.ox - tower.width / 2);
    const y = Math.round(g.oy - tower.height * .87);
    this.paintImage(tower, x, y);
    this.hitList.push({ x, y, sprite: tower, id: 'tower' });
    if (this.game.selected === 'tower' || this.hover === 'tower' || this.keyTarget === 'tower') {
      ctx.font = `bold 10px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = this.colors.accent;
      ctx.fillText('[ T-01 ]', g.ox, y + tower.height + 12);
      ctx.textAlign = 'left';
    }
  }

  paintShots() {
    const { ctx, colors, game, geometry: g } = this;
    const start = { x: g.ox, y: g.oy - this.tower.height * .30 };
    ctx.textAlign = 'center';
    for (const shot of game.shots) {
      const p = this.project(shot.x, shot.y);
      const dx = p.x - start.x;
      const dy = p.y - start.y;
      const n = Math.max(1, Math.round(Math.hypot(dx, dy) / 6.6));
      const slope = Math.abs(dy / (dx || .01));
      const char = slope < .28 ? '-' : slope > 2.4 ? '|' : dx * dy < 0 ? '/' : '\\';
      ctx.fillStyle = colors.accent;
      ctx.font = `bold 8px ${FONT}`;
      for (let i = 1; i < n; i++) {
        const f = i / n;
        ctx.globalAlpha = clamp(shot.life / shot.maxLife, 0, 1) * (.35 + .65 * f);
        ctx.fillText(i % 4 === 0 ? '.' : char, start.x + dx * f, start.y + dy * f);
      }
      ctx.globalAlpha = clamp(.23 + shot.life / shot.maxLife, 0, 1);
      ctx.font = `bold 13px ${FONT}`;
      ctx.fillText('*', p.x, p.y);
    }
    for (const fx of game.effects || []) {
      const p = this.project(fx.x, fx.y);
      const life = clamp(fx.life / fx.maxLife, 0, 1);
      const splash = fx.type === 'splash';
      const radius = splash ? (fx.radius || 6) * g.rx / 32 : 11;
      const r = (1.12 - life) * radius;
      const count = splash ? 18 : 6;
      ctx.globalAlpha = life * .87;
      ctx.fillStyle = fx.type === 'kill' ? colors.ink : colors.accent;
      ctx.font = `bold 10px ${FONT}`;
      for (let i = 0; i < count; i++) {
        const a = TAU * i / count;
        ctx.fillText(i % 3 === 0 ? '+' : '.', p.x + r * Math.cos(a), p.y + r * .65 * Math.sin(a));
      }
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
  }

  render(timeSeconds = 0) {
    if ((this.dirty || this.colorsDirty || this.ratio !== Math.min(window.devicePixelRatio || 1, 3)) && !this.prepare()) return;
    const { ctx, w, h, game } = this;
    ctx.clearRect(0, 0, w, h);
    this.paintImage(this.terrain);
    if (this.showRange) this.paintImage(this.rangeLayer());
    this.hitList.length = 0;
    const now = game.status === 'running' ? timeSeconds : game.time;
    const entries = game.enemies.map(enemy => ({ enemy, p: this.project(enemy.x, enemy.y) })).sort((a, b) => a.p.y - b.p.y);
    let towerDrawn = false;
    for (const { enemy, p } of entries) {
      if (!towerDrawn && p.y >= this.geometry.oy + this.tower.height * .06) {
        this.paintTower();
        towerDrawn = true;
      }
      this.paintEnemy(enemy, p, now);
    }
    if (!towerDrawn) this.paintTower();
    this.paintShots();
  }
}
