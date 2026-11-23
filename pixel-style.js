import { AsciiStyle, surface } from './ascii-style.js?v=3.12.0';
import { PIXEL_ENEMIES, pixelSpire, pixelPalette, paintPixels } from './pixel-art.js?v=3.12.0';

// Each symbol the ASCII style prints becomes a 3x3 block of pixels in the same cell.
export const GLYPHS = {
  '.': '.......x.', ',': '....x.x..', "'": '.x.......', '`': '.x.......',
  ':': '.x.....x.', ';': '.x.....x.', '+': '.x.xxx.x.', '*': 'x.x.x.x.x',
  'x': 'x.x.x.x.x', '-': '...xxx...', '=': 'xxx...xxx', '|': '.x..x..x.',
  '/': '..x.x.x..', '\\': 'x...x...x', '~': '...xx...x', '#': 'xxxxxxxxx',
  '%': 'x.x.x.x.x', '(': '.x.x...x.', ')': '.x...x.x.',
  '<': '..x.x...x', '>': 'x...x.x..', '[': 'xx.x..xx.', ']': '.xx..x.xx',
  '^': '.x.x.x...', 'v': '...x.x.x.', '!': '.x..x....', 'o': '.x.x.x.x.',
};
export const FALLBACK = '....x....';

// The pixel art style. It inherits every placement from the ASCII style and only
// changes how sprites and symbols are drawn, so the two line up exactly.
export const PIXEL_FONT = '"Spire Pixel", "Spire ASCII", monospace';

export class PixelStyle extends AsciiStyle {
  static key = 'pixel';
  static label = 'Pixel';
  static fontFamily = 'Spire Pixel';

  // Words on the battlefield use the pixel font; symbols are drawn as pixels by mark().
  font(size, weight = 'bold') {
    this.markSize = size;
    this.ctx.font = `${weight === 400 ? 400 : 700} ${size}px ${PIXEL_FONT}`;
  }

  prepare() {
    this.palette = pixelPalette(this.colors);
    this.spires = new Map();
    super.prepare();
  }

  // Same box, padding and hit bounds as the ASCII sprite, filled with pixels.
  sprite(rows, lineHeight, tower = false, key = 'tower') {
    const cell = lineHeight * 1.04 * .6;
    const columns = Math.max(...rows.map(row => row.length));
    const padding = 2;
    const image = surface(Math.ceil(columns * cell + padding * 2), Math.ceil(rows.length * lineHeight + padding * 2), this.ratio);
    const bounds = rows.map(line => ({ start: line.search(/\S/), end: line.trimEnd().length }));
    let grid = PIXEL_ENEMIES[key];
    if (tower) {
      const size = columns + 'x' + rows.length;
      if (!this.spires.has(size)) this.spires.set(size, pixelSpire(columns, rows.length));
      grid = this.spires.get(size);
    }
    if (grid) paintPixels(image.ctx, grid, this.palette, padding, padding, columns * cell, rows.length * lineHeight);
    return { ...image, bounds, cell, lineHeight, padding };
  }

  mark(glyphs, x, y) {
    const { ctx } = this;
    const size = this.markSize || 10;
    const unit = Math.max(1, Math.round(size / 5));
    const advance = size * .6;
    const total = glyphs.length * advance;
    const align = ctx.textAlign;
    const left = align === 'center' ? x - total / 2 : align === 'right' || align === 'end' ? x - total : x;
    const top = Math.round(y / unit - 1.5) * unit;
    for (let i = 0; i < glyphs.length; i++) {
      const char = glyphs[i];
      if (char === ' ') continue;
      const pattern = GLYPHS[char] || FALLBACK;
      const cellLeft = Math.round((left + (i + .5) * advance) / unit - 1.5) * unit;
      for (let p = 0; p < 9; p++) {
        if (pattern[p] === 'x') ctx.fillRect(cellLeft + (p % 3) * unit, top + Math.floor(p / 3) * unit, unit, unit);
      }
    }
  }
}
