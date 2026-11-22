// Pixel sprites for the pixel art style. Each grid fills the same box as the
// matching ASCII sprite, so both styles line up during a style swap.
//
// Tones follow the active theme:
//   . clear   o outline   d shadow   m body   l light   h highlight   a accent   g accent glint
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
