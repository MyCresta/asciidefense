import { AsciiStyle, surface } from './ascii-style.js?v=3.10.0';
import { pixelPalette } from './pixel-art.js?v=3.10.0';
import { VECTOR_ENEMIES, vectorSpire, paintVector } from './vector-art.js?v=3.10.0';

export const VECTOR_FONT = '"Spire Vector", "Spire ASCII", sans-serif';

// Each symbol the ASCII style prints is drawn as a smooth stroke in the same cell.
// Coordinates are in a unit cell centered on the glyph: x and y run from -1 to 1.
export const STROKES = {
  '-': 'M-.8 0H.8', '=': 'M-.8-.35H.8M-.8 .35H.8', '|': 'M0-.9V.9', '/': 'M.6-.9L-.6.9', '\\': 'M-.6-.9L.6.9',
  '+': 'M-.75 0H.75M0-.75V.75', '~': 'M-.9 .1Q-.45-.5 0 .05T.9 0', '(': 'M.35-.9Q-.45 0 .35.9', ')': 'M-.35-.9Q.45 0-.35.9',
  '<': 'M.6-.7L-.5 0L.6.7', '>': 'M-.6-.7L.5 0L-.6.7', '[': 'M.4-.9H-.3V.9H.4', ']': 'M-.4-.9H.3V.9H-.4',
  '^': 'M-.6.35L0-.45L.6.35', 'v': 'M-.6-.35L0 .45L.6-.35', '!': 'M0-.9V.25', 'o': 'M0-.6A.6.6 0 1 0 0 .6A.6.6 0 1 0 0-.6',
};
export const DOTS = { '.': [[0, .6]], ',': [[0, .55]], "'": [[0, -.6]], '`': [[0, -.6]], ':': [[0, -.45], [0, .45]], ';': [[0, -.45], [0, .45]], '!': [[0, .75]] };
const SPARKLE = 'M0-1Q.12-.12 1 0Q.12 .12 0 1Q-.12 .12-1 0Q-.12-.12 0-1Z';
const cache = new Map();
const shape = d => { if (!cache.has(d)) cache.set(d, new Path2D(d)); return cache.get(d); };

// The stylized 2D style. Like the pixel style it inherits every placement from
// the ASCII style and only changes how sprites, symbols and words are drawn.
export class VectorStyle extends AsciiStyle {
  static key = 'vector';
  static label = 'Vector';
  static fontFamily = 'Spire Vector';

  font(size, weight = 'bold') {
    this.markSize = size;
    this.ctx.font = `${weight === 400 ? 400 : 700} ${size}px ${VECTOR_FONT}`;
  }

  prepare() {
    this.palette = pixelPalette(this.colors);
    this.spires = new Map();
    super.prepare();
  }

  sprite(rows, lineHeight, tower = false, key = 'tower') {
    const cell = lineHeight * 1.04 * .6;
    const columns = Math.max(...rows.map(row => row.length));
    const padding = 2;
    const image = surface(Math.ceil(columns * cell + padding * 2), Math.ceil(rows.length * lineHeight + padding * 2), this.ratio);
    const bounds = rows.map(line => ({ start: line.search(/\S/), end: line.trimEnd().length }));
    let drawing = VECTOR_ENEMIES[key];
    if (tower) {
      const size = columns + 'x' + rows.length;
      if (!this.spires.has(size)) this.spires.set(size, vectorSpire(columns, rows.length));
      drawing = this.spires.get(size);
    }
    if (drawing) paintVector(image.ctx, drawing, this.palette, padding, padding, columns * cell, rows.length * lineHeight);
    return { ...image, bounds, cell, lineHeight, padding };
  }

  mark(glyphs, x, y) {
    const { ctx } = this;
    const size = this.markSize || 10;
    const advance = size * .6;
    const total = glyphs.length * advance;
    const align = ctx.textAlign;
    const left = align === 'center' ? x - total / 2 : align === 'right' || align === 'end' ? x - total : x;
    const half = size * .36;
    ctx.save();
    ctx.strokeStyle = ctx.fillStyle;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let i = 0; i < glyphs.length; i++) {
      const char = glyphs[i];
      if (char === ' ') continue;
      const cx = left + (i + .5) * advance;
      ctx.save();
      ctx.translate(cx, y);
      ctx.scale(half, half);
      ctx.lineWidth = Math.max(.9, size * .12) / half;
      if (STROKES[char]) ctx.stroke(shape(STROKES[char]));
      if (DOTS[char]) {
        for (const [dx, dy] of DOTS[char]) {
          ctx.beginPath();
          ctx.arc(dx, dy, Math.max(.55, size * .085) / half * 1.1, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      if (char === '*' || char === 'x' || char === '%') ctx.fill(shape(SPARKLE));
      if (char === '#' || char === '@') { ctx.beginPath(); ctx.roundRect(-.75, -.75, 1.5, 1.5, .4); ctx.fill(); }
      if (!STROKES[char] && !DOTS[char] && !'*x%#@'.includes(char)) { ctx.beginPath(); ctx.arc(0, 0, .3, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
    }
    ctx.restore();
  }
}
