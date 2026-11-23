import { TOWER, TOWER_SMALL, ENEMY_ART } from './art.js?v=3.12.0';
import { ELITE_TRAITS } from './hazards.js?v=3.12.0';
import { maxWeaponRange } from './weapons.js?v=3.12.0';

export const FONT = '"Spire ASCII", "Lucida Console", "Liberation Mono", "Courier New", monospace';
const TAU = Math.PI * 2;
const TOWER_ANCHOR = .5;
const MOUNT_MARKS = { bolt: '+', scatter: ':', lance: '=', coil: '~', mortar: 'o', cryo: '*', beam: '>', pulse: '^' };
export const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

export function randomSequence(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

export function surface(width, height, ratio) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.ceil(width * ratio));
  canvas.height = Math.max(1, Math.ceil(height * ratio));
  const ctx = canvas.getContext('2d');
  ctx.scale(ratio, ratio);
  ctx.textBaseline = 'middle';
  return { canvas, ctx, width, height };
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
        if (char === '*' || char === '@') color = colors.accent;
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


// The ASCII art style. A style paints one frame of the shared game state onto
// the canvas context the field hands it. The field owns input, projection and
// hit testing, so every style puts each object at the same place and size.
export class AsciiStyle {
  static key = 'ascii';
  static label = 'ASCII';

  constructor(field) {
    this.field = field;
    this.ctx = null;
    this.stale = true;
  }

  get game() { return this.field.game; }
  get geometry() { return this.field.geometry; }
  get colors() { return this.field.colors; }
  get w() { return this.field.w; }
  get h() { return this.field.h; }
  get ratio() { return this.field.ratio; }
  get hover() { return this.field.hover; }
  get keyTarget() { return this.field.keyTarget; }
  get showNumbers() { return this.field.showNumbers; }
  get hitList() { return this.field.hitList; }
  get shake() { return this.field.shake; }
  set shake(value) { this.field.shake = value; }
  project(x, y) { return this.field.project(x, y); }

  // Sets the font for marks and labels. Marks are symbols that a style may
  // redraw its own way; labels are words and numbers, drawn as text by every style.
  font(size, weight = 'bold') {
    this.markSize = size;
    this.ctx.font = `${weight} ${size}px ${FONT}`;
  }

  mark(glyphs, x, y) { this.ctx.fillText(glyphs, x, y); }

  label(text, x, y) { this.ctx.fillText(text, x, y); }

  sprite(rows, lineHeight, tower = false, key = 'tower') {
    return makeSprite(rows, lineHeight, this.ratio, this.colors, tower);
  }

  // Canvas text needs the style's web font loaded; sprites drawn before then are redrawn.
  static fontFamily = 'Spire ASCII';
  loadFont() {
    const family = this.constructor.fontFamily;
    if (this.fontRequested || typeof document === 'undefined' || !document.fonts) return;
    this.fontRequested = true;
    if ([400, 700].every(weight => document.fonts.check(`${weight} 16px "${family}"`))) return;
    Promise.all([400, 700].map(weight => document.fonts.load(`${weight} 16px "${family}"`)))
      .then(() => { this.stale = true; }, () => {});
  }

  prepare() {
    this.loadFont();
    const { w, h } = this;
    const rows = w < 530 || h < 235 ? TOWER_SMALL : TOWER;
    const cols = Math.max(...rows.map(line => line.length));
    // Kept compact so hostiles closing in from above and the sides stay in view.
    const size = Math.min(148, w * .165, h * .33);
    const towerLine = Math.min(size / (cols * .624), size / rows.length);
    this.tower = this.sprite(rows, towerLine, true);
    this.enemySprites = new Map();
    this.enemyLine = clamp(Math.min(w / 128, h / 58), 4.7, 7.1);
    const ctx = this.ctx;
    this.terrain = this.makeTerrain();
    this.ctx = ctx;
    this.cachedCircle = null;
    this.stale = false;
  }

  paint(now) {
    const { game } = this;
    this.paintImage(this.terrain);
    if (this.field.showRange) this.paintImage(this.rangeLayer());
    const entries = game.enemies.map(enemy => ({ enemy, p: this.project(enemy.x, enemy.y) })).sort((a, b) => a.p.y - b.p.y);
    let towerDrawn = false;
    const behind = [];
    for (const { enemy, p } of entries) {
      if (!towerDrawn && p.y >= this.geometry.oy + this.tower.height * .20) {
        this.paintTower();
        this.paintBehind(behind, now);
        towerDrawn = true;
      }
      this.paintEnemy(enemy, p, now);
      if (!towerDrawn) behind.push({ enemy, p });
    }
    if (!towerDrawn) {
      this.paintTower();
      this.paintBehind(behind, now);
    }
    this.paintShots();
    this.paintEffects();
    this.paintWarning();
  }

  // The leading edge of a style swap, drawn on the outgoing frame.
  paintSweep(radius) {
    const { ctx, geometry: g } = this;
    if (radius <= 0) return;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = this.colors.accent;
    this.font(11);
    const count = clamp(Math.round(radius * .55), 16, 240);
    const glyphs = '#%*+=:';
    for (let i = 0; i < count; i++) {
      const angle = TAU * i / count;
      const jitter = Math.sin(i * 12.9898 + radius * .05) * 3;
      ctx.globalAlpha = .45 + .45 * Math.abs(Math.sin(i * 7.3 + radius * .02));
      this.mark(glyphs[i % glyphs.length], g.ox + Math.cos(angle) * (radius + jitter), g.oy + Math.sin(angle) * (radius + jitter));
    }
    ctx.restore();
  }

  makeTerrain() {
    const { w, h, ratio, colors, geometry: g } = this;
    const image = surface(w, h, ratio);
    const { ctx } = image;
    this.ctx = ctx;
    const random = randomSequence(102351);
    // Patches of loose halftone grain imply an open plane. Every mark is a text glyph.
    this.font(9, 400);
    const dots = ['.', '.', '.', "'", '`', ','];
    const number = Math.ceil(w * h / 1450);
    for (let i = 0; i < number; i++) {
      const x = random() * w;
      const y = random() * h;
      ctx.globalAlpha = .20 + .25 * random();
      ctx.fillStyle = colors.muted;
      this.mark(dots[Math.floor(random() * dots.length)], x, y);
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
        this.mark(dots[Math.floor(random() * dots.length)], Math.round(x / 4) * 4, Math.round(y / 4) * 4);
      }
    }
    this.font(11, 400);
    for (let i = 0; i < Math.max(9, number / 16); i++) {
      ctx.globalAlpha = .25 + random() * .28;
      this.mark('+', random() * w, random() * h);
    }
    // A stippled cast shadow gives the masonry a solid footing without drawing terrain objects.
    const baseY = g.oy + this.tower.height * .23;
    const sw = this.tower.width * .72;
    const sh = this.tower.height * .14;
    this.font(9, 400);
    for (let i = 0; i < Math.ceil(sw * sh / 10); i++) {
      const u = random() * 2 - 1;
      const v = random() * 2 - 1;
      const density = 1 - u * u - v * v;
      if (random() > density) continue;
      ctx.fillStyle = colors.muted;
      ctx.globalAlpha = .13 + density * .37;
      this.mark(i % 6 === 0 ? ':' : '.', Math.round((g.ox + sw * (u + .12)) / 4) * 4, Math.round((baseY + sh * v - u * sh * .25) / 4) * 4);
    }
    return image;
  }

  rangeLayer() {
    const range = maxWeaponRange(this.game);
    if (this.cachedCircle && this.cachedCircle.range === range) return this.cachedCircle;
    const image = surface(this.w, this.h, this.ratio);
    const { ctx } = image;
    const target = this.ctx;
    this.ctx = ctx;
    const { sx, sy } = this.geometry;
    const count = Math.max(24, Math.round(Math.PI * (sx + sy) * range / 5));
    ctx.fillStyle = this.colors.accent;
    ctx.textAlign = 'center';
    this.font(11, 600);
    for (let i = 0; i < count; i++) {
      const angle = TAU * i / count;
      const p = this.project(range * Math.cos(angle), range * Math.sin(angle));
      ctx.globalAlpha = .47;
      this.mark('.', p.x, p.y - 2.4);
    }
    ctx.globalAlpha = .80;
    this.font(11, 400);
    for (let i = 0; i < 4; i++) {
      const angle = i * Math.PI / 2;
      const p = this.project(range * Math.cos(angle), range * Math.sin(angle));
      this.mark('+', p.x, p.y);
    }
    this.ctx = target;
    this.cachedCircle = { ...image, range };
    return this.cachedCircle;
  }

  paintImage(image, x = 0, y = 0) {
    this.ctx.drawImage(image.canvas, x, y, image.canvas.width / this.ratio, image.canvas.height / this.ratio);
  }

  enemySprite(enemy) {
    const tier = clamp(enemy.tier || 1, 1, 4);
    const key = `${enemy.type}-${tier}-${Boolean(enemy.elite)}-${Boolean(enemy.mini)}-${Boolean(enemy.boss)}`;
    if (this.enemySprites.has(key)) return this.enemySprites.get(key);
    const rows = ENEMY_ART[enemy.type];
    if (!rows) return null;
    let scale = 1 + .075 * (tier - 1);
    if (enemy.elite) scale += .10;
    if (enemy.mini) scale = .70;
    if (enemy.boss) scale = 1.62;
    const sprite = this.sprite(rows, this.enemyLine * scale, false, enemy.type);
    this.enemySprites.set(key, sprite);
    return sprite;
  }

  enemyPlace(enemy, p, now, sprite) {
    const seed = Number.parseInt(String(enemy.id).replace(/\D/g, ''), 10) || 0;
    const floating = ['moth', 'wraith', 'cantor'].includes(enemy.type);
    const bob = Math.sin(now * (floating ? 3.6 : 5) + seed * 2.1) * (floating ? 1.35 : .45);
    return { seed, bob, x: Math.round(p.x - sprite.width / 2), y: Math.round(p.y - sprite.height / 2 + bob) };
  }

  // Hostiles behind the Spire show through it as a faint silhouette, so none vanish.
  paintBehind(entries, now) {
    const { ctx, tower, geometry: g } = this;
    const left = g.ox - tower.width / 2, top = g.oy - tower.height * TOWER_ANCHOR;
    for (const { enemy, p } of entries) {
      const sprite = this.enemySprite(enemy);
      if (!sprite) continue;
      const { x, y } = this.enemyPlace(enemy, p, now, sprite);
      if (x > left + tower.width || x + sprite.width < left || y > top + tower.height || y + sprite.height < top) continue;
      ctx.globalAlpha = .5;
      this.paintImage(sprite, x, y);
      ctx.globalAlpha = 1;
    }
  }

  paintEnemy(enemy, p, now) {
    const sprite = this.enemySprite(enemy);
    if (!sprite) return;
    const { ctx, colors } = this;
    const { seed, bob, x, y } = this.enemyPlace(enemy, p, now, sprite);
    const half = sprite.width * .5;
    const focused = this.game.focusId === enemy.id;
    const active = focused || this.game.selected === enemy.id || this.hover === enemy.id || this.keyTarget === enemy.id;
    const flash = this.game.time - enemy.lastHit < .09;
    if (flash) ctx.globalAlpha = .45;
    this.paintImage(sprite, x, y);
    ctx.globalAlpha = 1;
    this.hitList.push({ x, y, sprite, id: enemy.id });
    if (flash && this.showNumbers) {
      ctx.fillStyle = colors.ink;
      this.font(9);
      ctx.textAlign = 'center';
      this.mark('x', p.x + (seed % 2 ? 3 : -3), p.y + bob);
    }
    ctx.fillStyle = colors.accent;
    ctx.textAlign = 'center';
    if (enemy.shield > 0) {
      ctx.globalAlpha = .68 + .2 * Math.sin(now * 2.7 + seed);
      this.font(Math.min(19, sprite.height * .5));
      this.mark('(', p.x - half - 2, p.y);
      this.mark(')', p.x + half + 2, p.y);
      ctx.globalAlpha = 1;
    }
    if (active) {
      this.font(11, 400);
      const offset = half + (enemy.shield > 0 ? 8 : 3);
      this.mark(focused ? '>' : '[', p.x - offset, p.y);
      this.mark(focused ? '<' : ']', p.x + offset, p.y);
    }
    this.font(9);
    if (enemy.boss) {
      const rank = enemy.rank > 1 ? ' ' + ['', 'I', 'II', 'III', 'IV', 'V'][Math.min(5, enemy.rank)] : '';
      this.label('[ SOVEREIGN' + rank + ' ]', clamp(p.x, 38, this.w - 38), Math.max(6, y - 5));
    } else if (active) {
      const trait = ELITE_TRAITS[enemy.trait];
      const label = (trait ? trait.name.toUpperCase() + ' ' : enemy.elite ? '! ' : '') + 'T' + (enemy.tier || 1);
      this.label(label, p.x, y - 5);
    } else if (enemy.elite) {
      this.label('!' + (ELITE_TRAITS[enemy.trait]?.mark || ''), p.x + half - 1, y);
    }
    if (enemy.burnUntil > this.game.time || enemy.slowUntil > this.game.time) {
      const burning = enemy.burnUntil > this.game.time;
      this.mark(burning ? '^^' : '~', p.x + (active || enemy.boss ? half + 2 : 0), y - 4);
    }
    if (enemy.boss || active || enemy.hp < enemy.maxHp) {
      const n = enemy.boss ? 12 : 5;
      const full = clamp(Math.ceil(n * enemy.hp / enemy.maxHp), 0, n);
      const font = enemy.boss ? 8 : 7;
      this.font(font);
      ctx.textAlign = 'left';
      const left = p.x - n * font * .3;
      ctx.fillStyle = colors.muted;
      this.mark('-'.repeat(n), left, y + sprite.height + 3);
      ctx.fillStyle = colors.accent;
      this.mark('='.repeat(full), left, y + sprite.height + 3);
    }
    ctx.textAlign = 'left';
  }

  mountPoint(slot) {
    const { ox, oy } = this.geometry;
    const { width, height } = this.tower;
    // Primary fires from the core; extra weapons sit on the side pylons.
    if (slot <= 0) return { x: ox, y: oy - height * .08 };
    return { x: ox + width * (slot === 1 ? -.42 : .42), y: oy };
  }

  paintTower() {
    const { ctx, tower, geometry: g } = this;
    const x = Math.round(g.ox - tower.width / 2);
    const y = Math.round(g.oy - tower.height * TOWER_ANCHOR);
    this.paintImage(tower, x, y);
    const mounts = this.game.armory?.mounts || [];
    this.font(Math.max(5, tower.lineHeight * 1.13));
    ctx.textAlign = 'center';
    ctx.fillStyle = this.colors.accent;
    for (let slot = 1; slot < mounts.length; slot++) {
      const port = this.mountPoint(slot);
      this.mark(MOUNT_MARKS[mounts[slot].key], port.x, port.y);
    }
    ctx.textAlign = 'left';
    this.hitList.push({ x, y, sprite: tower, id: 'tower' });
    if (this.game.selected === 'tower' || this.hover === 'tower' || this.keyTarget === 'tower') {
      this.font(10);
      ctx.textAlign = 'center';
      ctx.fillStyle = this.colors.accent;
      this.label('[ T-01 ]', g.ox, y + tower.height + 12);
      ctx.textAlign = 'left';
    }
  }

  paintMountShot(shot, start, end) {
    const { ctx, colors } = this;
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.max(1, Math.hypot(dx, dy));
    const nx = -dy / length, ny = dx / length;
    const life = clamp(shot.life / shot.maxLife, 0, 1);
    ctx.fillStyle = shot.crit ? colors.ink : colors.accent;
    this.font(9);
    if (shot.kind === 'scatter') {
      // A short packet of pellets advances across three diverging trajectories.
      const spread = Math.min(12, length * .19);
      for (let lane = -1; lane <= 1; lane++) {
        for (let pellet = 0; pellet < 4; pellet++) {
          const t = .12 + .57 * (1 - life) + pellet * .095;
          const lateral = lane * t * spread;
          ctx.globalAlpha = life * (.5 + pellet * .16);
          this.mark(pellet === 3 ? '*' : '.', start.x + dx * t + nx * lateral, start.y + dy * t + ny * lateral);
        }
      }
    } else if (shot.kind === 'beam') {
      // A solid, steady line: thicker glyphs as the beam locks on.
      const count = clamp(Math.ceil(length / 3.5), 3, 140);
      for (let i = 1; i < count; i++) {
        ctx.globalAlpha = .45 + .5 * life;
        this.mark(i % 2 ? '=' : '-', start.x + dx * i / count, start.y + dy * i / count);
      }
      ctx.globalAlpha = life;
      ctx.fillStyle = colors.ink;
      this.mark('+', end.x, end.y);
    } else if (shot.kind === 'lance') {
      // The rail tracer continues a little way through its target.
      const slope = Math.abs(dy / (dx || .01));
      const stroke = slope < .38 ? '=' : slope > 2.5 ? '|' : dx * dy < 0 ? '/' : '\\';
      const count = clamp(Math.ceil(length / 5), 2, 100);
      const reach = 1 + Math.min(18 / length, .23);
      for (let i = 1; i <= count; i++) {
        const t = reach * i / count;
        ctx.globalAlpha = life * (.3 + .65 * i / count);
        this.mark(stroke, start.x + dx * t, start.y + dy * t);
      }
      ctx.globalAlpha = life;
      ctx.fillStyle = colors.ink;
      this.mark('#', end.x, end.y);
    } else {
      // A kinked main discharge reads separately from the shorter chain hops.
      const count = clamp(Math.ceil(length / 5), 3, 76);
      const amplitude = Math.min(8, length * .13);
      const phase = (1 - life) * 1.6;
      for (let i = 1; i < count; i++) {
        const t = i / count;
        const kink = Math.sin(i * .85 + phase) * Math.sin(Math.PI * t) * amplitude;
        ctx.globalAlpha = life * (.55 + .4 * t);
        this.mark(i % 4 === 0 ? '+' : '~', start.x + dx * t + nx * kink, start.y + dy * t + ny * kink);
      }
      ctx.globalAlpha = life;
      this.mark('*', end.x, end.y);
    }
  }

  paintShots() {
    const { ctx, colors, game } = this;
    ctx.textAlign = 'center';
    for (const shot of game.shots) {
      const chain = shot.kind === 'chain';
      const crit = shot.kind === 'crit';
      const twin = shot.kind === 'twin';
      const gun = shot.kind === 'shot' || crit ? 'bolt' : shot.kind;
      const slot = game.armory?.mounts.findIndex(mount => mount.key === gun) ?? 0;
      const start = Number.isFinite(shot.fromX) && Number.isFinite(shot.fromY)
        ? this.project(shot.fromX, shot.fromY) : this.mountPoint(slot);
      const end = this.project(shot.x, shot.y);
      // The pulse ring draws as a ring effect around the Spire, not as a shot.
      if (shot.kind === 'pulse') continue;
      if (shot.kind === 'scatter' || shot.kind === 'lance' || shot.kind === 'coil' || shot.kind === 'beam') {
        this.paintMountShot(shot, start, end);
        continue;
      }
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const distance = Math.max(1, Math.hypot(dx, dy));
      const count = Math.ceil(distance / (chain ? 4.5 : 6));
      const slope = Math.abs(dy / (dx || .01));
      const line = slope < .28 ? '-' : slope > 2.4 ? '|' : dx * dy < 0 ? '/' : '\\';
      const fade = clamp(shot.life / shot.maxLife, 0, 1);
      ctx.fillStyle = chain || crit ? colors.ink : colors.accent;
      this.font(crit ? 10 : 8);
      for (let i = 1; i < count; i++) {
        const f = i / count;
        const offset = chain ? Math.sin(i * 1.75) * 3.8 : 0;
        const x = start.x + dx * f - dy / distance * offset;
        const y = start.y + dy * f + dx / distance * offset;
        ctx.globalAlpha = fade * (.3 + .7 * f);
        let glyph = i % 4 === 0 ? '.' : line;
        if (chain) glyph = i % 3 === 0 ? '+' : '~';
        if (crit && line === '-') glyph = '=';
        this.mark(glyph, x, y);
        if (twin) this.mark(glyph, x - dy / distance * 3, y + dx / distance * 3);
      }
      ctx.globalAlpha = fade;
      this.font(crit ? 16 : 12);
      this.mark(chain ? '+' : '*', end.x, end.y);
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
  }

  burst(point, radiusX, radiusY, count, glyphs, angle = 0) {
    for (let i = 0; i < count; i++) {
      const theta = angle + TAU * i / count;
      this.mark(glyphs[i % glyphs.length], point.x + radiusX * Math.cos(theta), point.y + radiusY * Math.sin(theta));
    }
  }

  paintEffects() {
    const { ctx, game, colors, geometry: g } = this;
    ctx.textAlign = 'center';
    for (const effect of game.effects) {
      const p = this.project(effect.x, effect.y);
      const life = clamp(effect.life / effect.maxLife, 0, 1);
      const phase = 1 - life;
      const radius = Math.max(1, effect.radius || 1);
      const rx = g.sx * radius;
      const ry = g.sy * radius;
      ctx.globalAlpha = Math.min(1, life * 1.55);
      ctx.fillStyle = colors.accent;
      this.font(10);
      switch (effect.type) {
        case 'splash':
        case 'pulse':
        case 'ward': {
          const pulse = effect.type === 'pulse';
          const size = .12 + .88 * Math.sqrt(phase);
          const count = clamp(Math.ceil((rx + ry) * .45), 12, 76);
          this.burst(p, rx * size, ry * size, count, pulse ? '+.:-' : effect.type === 'ward' ? '|:.' : '+..');
          if (pulse) {
            ctx.globalAlpha *= .45;
            this.burst(p, rx * size * .83, ry * size * .83, count, '..-');
          }
          break;
        }
        case 'cache':
          this.label('[+] CACHE', clamp(p.x, 27, this.w - 27), Math.max(7, p.y - 8 - phase * 16));
          break;
        case 'gain': {
          // A small cache names the upgrade it installed, rising off the Spire.
          this.font(12);
          const top = g.oy - this.tower.height / 2;
          this.label(String(effect.value ?? ''), clamp(p.x, 60, this.w - 60), Math.max(8, top - 8 - (radius - 1) * 13 - phase * 16));
          break;
        }
        case 'heal':
          for (let i = 0; i < 3; i++) this.mark('+', p.x + (i - 1) * 7, p.y - 3 - phase * 14 - (i % 2) * 6);
          break;
        case 'shield':
          this.mark('((', p.x - 9 - phase * 7, p.y);
          this.mark('))', p.x + 9 + phase * 7, p.y);
          break;
        case 'split':
          this.mark('<:', p.x - 4 - phase * 13, p.y + phase * 5);
          this.mark(':>', p.x + 4 + phase * 13, p.y - phase * 5);
          break;
        case 'burn':
          this.mark('^.^', p.x, p.y - 7 - phase * 7);
          break;
        case 'crit':
          this.mark('*!', p.x + 7, p.y - 8 - phase * 9);
          break;
        case 'number':
        case 'number-crit': {
          if (!this.showNumbers) break;
          const crit = effect.type === 'number-crit';
          ctx.fillStyle = crit ? colors.accent : colors.ink;
          this.font(crit ? 12 : 9);
          this.label(String(effect.value ?? '') + (crit ? '!' : ''), p.x + 10, p.y - 10 - phase * 14);
          break;
        }
        case 'chill':
          this.burst(p, rx * (.4 + phase * .6), ry * (.4 + phase * .6), 10, '*~.');
          break;
        case 'hit':
          this.shake = Math.max(this.shake || 0, life);
          ctx.fillStyle = colors.ink;
          this.burst(p, Math.max(12, rx) * phase, Math.max(9, ry) * phase, 5, '*.', .41);
          break;
        case 'boss':
        case 'bossfall': {
          const fallen = effect.type === 'bossfall';
          const size = fallen ? .25 + phase : 1 - phase * .75;
          this.burst(p, rx * size, ry * size, 26, fallen ? '*/+.' : '><..', phase * .4);
          ctx.fillStyle = colors.ink;
          if (fallen) {
            this.burst(p, rx * phase * .67, ry * phase * .67, 15, '+.:');
            this.label('[ CORE SHATTERED ]', clamp(p.x, 49, this.w - 49), Math.max(7, p.y - 11 - phase * 12));
          }
          break;
        }
        default: {
          const dead = effect.type === 'kill';
          ctx.fillStyle = dead ? colors.ink : colors.accent;
          this.burst(p, Math.max(12, rx) * phase, Math.max(9, ry) * phase, dead ? 7 : 5, dead ? '+./:*' : '*.', .41);
        }
      }
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
  }

  paintWarning() {
    const warning = this.game.warning;
    if (!warning) return;
    const p = this.project(warning.x, warning.y);
    const { ctx, colors } = this;
    const remaining = String(Math.max(0, Math.ceil(warning.at - this.game.time))).padStart(2, '0');
    const offset = 9 + Math.sin(this.game.time * 4) * 3;
    this.font(10);
    ctx.fillStyle = colors.accent;
    ctx.textAlign = 'center';
    this.mark('>>', p.x - offset, p.y);
    this.mark('<<', p.x + offset, p.y);
    const top = p.y < this.h / 2;
    this.label(`[ BOSS ${remaining}s ]`, clamp(p.x, 40, this.w - 40), p.y + (top ? 13 : -13));
    ctx.textAlign = 'left';
  }

}
