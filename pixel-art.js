// Pixel sprites for the pixel art style. Each grid fills the same box as the
// matching ASCII sprite, so both styles line up during a style swap.
//
// Tones follow the active theme:
//   . clear   o outline   d shadow   m body   l light   h highlight   a accent   g accent glint
//   b paper (hides the range ring behind solid parts)
// A row as wide as half the sprite plus one column is mirrored around its last column.

export const PIXEL_TONES = 'odmlhag';

function mirror(rows, width) {
  const half = Math.ceil(width / 2);
  return rows.map((row, index) => {
    if (row.length === width) return row;
    if (row.length !== half) throw new Error(`Pixel row ${index} is ${row.length} wide, expected ${half} or ${width}`);
    return row + [...row.slice(0, -1)].reverse().join('');
  });
}

function sprite(width, rows) {
  return mirror(rows, width);
}

// ASCII enemies are 4 lines tall (12 pixels) and 8 to 10 glyphs wide (15 to 19 pixels).
export const PIXEL_ENEMIES = {
  crawler: sprite(17, [
    '..o......',
    '...o.....',
    '....ooooo',
    '...ommmmm',
    '..omgamll',
    '..ommllhh',
    'o.odmmmmm',
    '.ooddmdmd',
    '..oodddmd',
    '.o..oodoo',
    'o....o...',
    '.....o...',
  ]),
  wraith: sprite(15, [
    '.....ooo',
    '....ommm',
    '...omlll',
    '..omllhh',
    '..omlall',
    '..omllmm',
    '..omlmdm',
    '..omlldd',
    '.omdmmmd',
    '.odmddmm',
    'od.odd.d',
    'o...o..o',
  ]),
  brute: sprite(17, [
    '..o.o....',
    '..odooooo',
    '.odmmmmmm',
    'odmmmgamm',
    'odmmmmlll',
    'odddmlhhh',
    'odmdmllll',
    'odmdmmmmm',
    '.oddmmddd',
    '..oddmooo',
    '..ohho...',
    '..oooo...',
  ]),
  moth: sprite(17, [
    'oo......o',
    'omoo....o',
    'ommmo..oo',
    'omdmmo.om',
    '.oddmmoag',
    '..ommmoml',
    '..oddmolh',
    '...oddoml',
    '...odoomm',
    '..odo.odo',
    '..oo..o..',
    '.........',
  ]),
  splitter: sprite(17, [
    '.oo....o.',
    '.omo...o.',
    'omdmo.omo',
    'ogamoommd',
    'ommmmmmdl',
    '.odmllmhh',
    '..odmlmml',
    '..oddmmdm',
    '.ooddoodd',
    '.od.oo..o',
    'od...o...',
    'o........',
  ]),
  aegis: sprite(15, [
    '......oo',
    '....oomm',
    '..oommll',
    '.ommmlhh',
    'omdmlloo',
    'omdmloga',
    'omddmloo',
    '.omddmll',
    '..omddmm',
    '...oomdd',
    '.....ood',
    '.......o',
  ]),
  cantor: [
    '.....ooooo......o..',
    '....ommmmmo...o.o.o',
    '....omgagmo....ooo.',
    '.....ommmo......o..',
    '....oolhlo......o..',
    '...omlhhhlo.....o..',
    '..omdlllllmooooooo.',
    '.omdmlmmmlmdo...o..',
    '.odmmlmdmlmmo...o..',
    'oddmooddooomdo..o..',
    'odoo.oddo..ooo..o..',
    'oo...ooo.....o..o..',
  ],
  sovereign: sprite(21, [
    'oo.....o..o',
    'oho...omoom',
    'ohmo..ommmm',
    '.ommoommmmm',
    '..ommmmmmmm',
    '...odmmmlll',
    '..ooommlhhh',
    '.omddooooom',
    'omdmogaoomg',
    'omdmoaaommm',
    'ommmooommma',
    'omdmmmmmmaa',
    'omdommdmmma',
    'oddoommdddm',
    '.oo.omldooo',
    '.o..oddmoho',
    '.o..ommmoho',
    '....odmmooo',
    '...oddo.ooo',
    '...odo....o',
    '...oo......',
  ]),
};

// The Spire is a ring node: an outer ring with side pylons on a crossbar, an inner
// ring, two accent spikes and a glowing core. It is drawn from shapes measured in
// the ASCII art's own glyph grid, so each part sits over the glyphs it replaces.
// Units: one line of ASCII is 1 tall and one glyph is .624 wide.
const GLYPH = .624;
const SPIRE_SHAPES = {
  large: { rx: 6.24, ry: 5, ring: .6, inner: [3.12, 2.5], spike: [3.4, .85, 1.2], core: [.95, .78], housing: [1.95, 1.25] },
  small: { rx: 3.74, ry: 3, ring: .55, inner: null, spike: [2.05, .6, .75], core: [.8, .62], housing: [1.6, 1.05] },
};

export function pixelSpire(columns, lines, size = columns > 20 ? 'large' : 'small') {
  const s = SPIRE_SHAPES[size];
  let width = Math.round(columns * GLYPH * 3);
  if (width % 2 === 0) width++;
  const height = lines * 3;
  const halfX = columns * GLYPH / 2, halfY = lines / 2;
  const rows = [];
  for (let j = 0; j < height; j++) {
    let row = '';
    for (let i = 0; i < width; i++) {
      const x = ((i + .5) / width - .5) * 2 * halfX;
      const y = ((j + .5) / height - .5) * 2 * halfY;
      const px = 2 * halfX / width, py = 2 * halfY / height;
      const lit = (-x / s.rx - y / s.ry) * Math.SQRT1_2; // light from the upper left
      const shade = lit > .35 ? 'l' : lit < -.35 ? 'd' : 'm';
      let tone = '.';
      // Distance from the outer ring, in line units, measured along its normal.
      const e = Math.hypot(x / s.rx, y / s.ry);
      const ringGap = (e - 1) * Math.min(s.rx, s.ry);
      if (e < 1) tone = 'b';
      if (Math.abs(y) < s.ry && Math.abs(x) < .16) tone = 'b';
      // Stems above and below the ring.
      if (Math.abs(x) < Math.max(.17, px * .6) && Math.abs(y) >= s.ry - .1 && Math.abs(y) < halfY) tone = 'm';
      // Crossbar from the ring out to the box edges, and the connectors inside.
      if (Math.abs(y) < .3 && Math.abs(x) > (s.inner ? s.inner[0] : s.housing[0])) tone = y < -.1 ? 'l' : y > .1 ? 'd' : 'm';
      if (Math.abs(ringGap) < s.ring / 2) tone = ringGap > s.ring / 2 - Math.max(px, py) ? 'o' : ringGap < -s.ring / 2 + Math.max(px, py) ? 'd' : shade;
      if (s.inner) {
        const inner = Math.hypot(x / s.inner[0], y / s.inner[1]);
        if (Math.abs(inner - 1) * s.inner[1] < .13 && Math.abs(y) > .35) tone = lit > 0 ? 'm' : 'd';
      }
      // Pylons where the crossbar meets the ring: the side weapons sit here.
      for (const side of [-1, 1]) {
        const dx = Math.abs(x - side * s.rx), dy = Math.abs(y);
        if (dx < .62 && dy < .78) tone = dx > .62 - px || dy > .78 - py ? 'o' : dx < .25 && dy < .3 ? 'h' : 'l';
      }
      // Stem caps.
      for (const side of [-1, 1]) {
        if (Math.abs(x) < .38 && Math.abs(y - side * s.ry) < .28) tone = 'h';
      }
      // Accent spikes above and below the core.
      const [sy, sw, sh] = s.spike;
      for (const side of [-1, 1]) {
        const d = Math.abs(x) / sw + Math.abs(y - side * sy) / sh;
        if (d < 1) tone = d < .4 ? 'g' : d > .78 ? 'o' : 'a';
      }
      // Housing and core.
      const [hx, hy] = s.housing;
      if (Math.abs(x) < hx && Math.abs(y) < hy) {
        const edge = Math.abs(x) > hx - px * 1.2 || Math.abs(y) > hy - py * 1.2;
        const round = Math.hypot(x / hx, y / hy) < 1.22;
        if (round) tone = edge ? 'm' : 'd';
      }
      const [cx, cy] = s.core;
      const c = Math.hypot(x / cx, y / cy);
      if (c < 1) tone = c > .72 ? 'a' : Math.hypot(x / cx + .32, y / cy + .32) < .3 ? 'h' : 'g';
      row += tone;
    }
    rows.push(row);
  }
  return rows;
}

// A larger pixel portrait for the Inspector and the bestiary, read from the theme.
export function paintPortrait(canvas, key, scale = 6) {
  const grid = key === 'tower' ? pixelSpire(25, 13) : PIXEL_ENEMIES[key];
  if (!grid) return;
  const styles = getComputedStyle(document.documentElement);
  const read = (name, fallback) => styles.getPropertyValue(name).trim() || fallback;
  const palette = pixelPalette({
    bg: read('--surface', read('--bg', '#090b09')), ink: read('--ink', '#e5e7df'),
    accent: read('--accent', '#b5ed69'), muted: read('--muted', '#879083'),
  });
  palette.b = 'transparent';
  canvas.width = grid[0].length * scale;
  canvas.height = grid.length * scale;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  paintPixels(ctx, grid, palette, 0, 0, canvas.width, canvas.height);
}

const parsed = new Map();
function rgb(color) {
  if (parsed.has(color)) return parsed.get(color);
  const ctx = (rgb.canvas ||= Object.assign(document.createElement('canvas'), { width: 1, height: 1 })).getContext('2d', { willReadFrequently: true });
  ctx.clearRect(0, 0, 1, 1);
  ctx.fillStyle = '#000';
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  parsed.set(color, [r, g, b]);
  return [r, g, b];
}

function mix(a, b, amount) {
  const x = rgb(a), y = rgb(b);
  return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * amount)).join(',')})`;
}

// The same five theme tokens as the ASCII style, shaded into a small ramp.
export function pixelPalette(colors) {
  return {
    o: mix(colors.bg, colors.ink, .14),
    d: mix(colors.bg, colors.muted, .62),
    m: colors.muted,
    l: mix(colors.muted, colors.ink, .55),
    h: colors.ink,
    a: colors.accent,
    g: mix(colors.accent, colors.ink, .55),
    b: colors.bg,
  };
}

// Paint a grid so it fills exactly width x height CSS pixels starting at x, y.
export function paintPixels(ctx, rows, palette, x, y, width, height) {
  const columns = rows[0].length;
  const px = width / columns;
  const py = height / rows.length;
  for (let row = 0; row < rows.length; row++) {
    const line = rows[row];
    let start = 0;
    while (start < columns) {
      const tone = line[start];
      let end = start + 1;
      while (end < columns && line[end] === tone) end++;
      if (tone !== '.') {
        ctx.fillStyle = palette[tone];
        // Snap edges to the device grid so neighbouring runs never leave seams.
        const left = Math.round(x + start * px), right = Math.round(x + end * px);
        const top = Math.round(y + row * py), bottom = Math.round(y + (row + 1) * py);
        ctx.fillRect(left, top, right - left, bottom - top);
      }
      start = end;
    }
  }
}
