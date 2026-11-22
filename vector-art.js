// Vector art for the stylized 2D style, as SVG path data. Each drawing uses the
// ASCII sprite's own box as its viewBox, in tenths of a line (one glyph is 6.24
// wide and one line is 10 tall), so it lines up with the ASCII and pixel styles.
//
// Shapes name theme tones, the same ones the pixel style uses:
//   o outline   d shadow   m body   l light   h ink   a accent   g glow   b paper

const GLYPH = 6.24;
const LINE = 10;

const ellipse = (cx, cy, rx, ry = rx) =>
  `M${cx - rx} ${cy}a${rx} ${ry} 0 1 0 ${2 * rx} 0a${rx} ${ry} 0 1 0 ${-2 * rx} 0Z`;
const box = (x, y, w, h, r = 0) =>
  `M${x + r} ${y}h${w - 2 * r}a${r} ${r} 0 0 1 ${r} ${r}v${h - 2 * r}a${r} ${r} 0 0 1 ${-r} ${r}h${2 * r - w}a${r} ${r} 0 0 1 ${-r} ${-r}v${2 * r - h}a${r} ${r} 0 0 1 ${r} ${-r}Z`;

// Mirror a path's x coordinates around the middle of a box of width w.
function mirror(d, w) {
  const out = [];
  const tokens = d.match(/[a-zA-Z]|-?\d*\.?\d+/g);
  let command = '', index = 0;
  for (const token of tokens) {
    if (/[a-zA-Z]/.test(token)) { command = token; index = 0; out.push(token); continue; }
    let value = Number(token);
    const absolute = command === command.toUpperCase();
    if (command === 'A' || command === 'a') {
      // rx ry rotation large sweep x y: flip the sweep flag and x.
      const slot = index % 7;
      if (slot === 4) value = 1 - value;
      if (slot === 5) value = absolute ? w - value : -value;
    } else if (command === 'H' || command === 'h') value = absolute ? w - value : -value;
    else if (command !== 'V' && command !== 'v' && index % 2 === 0) value = absolute ? w - value : -value;
    out.push(String(Math.round(value * 100) / 100));
    index++;
  }
  return out.join(' ');
}

const fill = (d, tone, stroke = 'o', width = 1.4) => ({ d, fill: tone, stroke, width });
const line = (d, tone, width = 2) => ({ d, stroke: tone, width });
function both(width, ...shapes) {
  return shapes.flatMap(shape => [shape, { ...shape, d: mirror(shape.d, width) }]);
}

function art(columns, lines, shapes) {
  return { w: columns * GLYPH, h: lines * LINE, shapes };
}

export const VECTOR_ENEMIES = {
  crawler: art(9, 4, [
    ...both(56.16,
      line('M15 19Q7 13 3 7', 'd', 2.4), line('M15 23Q6 25 2 31', 'd', 2.4), line('M19 28Q13 35 10 39', 'd', 2.4),
      line('M24 11Q20 5 16 1', 'l', 1.4)),
    fill(ellipse(28.08, 21, 15, 10.5), 'm'),
    fill(ellipse(28.08, 17.5, 10, 5), 'l', null),
    ...both(56.16, fill(ellipse(22.5, 17, 3, 2.8), 'a', 'o', 1), fill(ellipse(21.7, 16.2, 1, 1), 'h', null)),
    ...both(56.16, line('M24 30L26 34', 'h', 1.6)),
  ]),
  wraith: art(8, 4, [
    fill('M24.96 2C37 2 43 13 43 23L43 37Q39 33 35.5 37.5Q31 33 28 37.5Q25 34 22 37.5Q19 33 14.5 37.5Q11 33 7 37L7 23C7 13 13 2 24.96 2Z', 'l'),
    fill(ellipse(24.96, 19, 11, 9), 'd', null),
    ...both(49.92, fill(ellipse(20, 18, 2.6, 2.6), 'a', null), fill(ellipse(19.3, 17.2, .9), 'h', null)),
    line('M22 25L24.96 22.5L28 25', 'h', 1.3),
  ]),
  brute: art(9, 4, [
    ...both(56.16, fill('M16 9L10 1L21 6Z', 'h'), fill(ellipse(7, 25, 6.5, 6.5), 'd'), fill(box(13, 33, 9, 6.5, 2), 'h')),
    fill(box(9, 8, 38.16, 28, 7), 'm'),
    fill(box(15, 3.5, 26.16, 15, 5), 'l'),
    ...both(56.16, fill(box(19.5, 9.5, 5, 3.6, 1.5), 'a', null)),
    line('M20 24H36M20 29H36M28 22V31', 'd', 1.6),
  ]),
  moth: art(9, 4, [
    ...both(56.16,
      fill('M28 19C19 3 7 0 2 3C3 14 12 21 28 23Z', 'm'),
      fill('M28 23C17 24 8 31 10 38C18 39 24 31 28 27Z', 'l'),
      fill(ellipse(11.5, 9.5, 3.2), 'a', null),
      line('M26 9Q23 3 19 1', 'l', 1.2)),
    fill(ellipse(28.08, 24, 4, 12.5), 'h'),
    fill(ellipse(28.08, 12, 4.4), 'd'),
    fill(ellipse(28.08, 12, 2), 'a', null),
  ]),
  splitter: art(9, 4, [
    ...both(56.16,
      line('M18 30L13 39M24 31L22 39', 'd', 2.2),
      fill('M8 14L1 7L10 10Z', 'h'),
      fill(ellipse(18, 20, 12.5, 12), 'm'),
      fill(ellipse(14, 17, 3.2), 'a', null),
      fill(ellipse(13.2, 16.2, 1), 'h', null)),
    line('M28.08 9V33', 'd', 1.8),
    fill(ellipse(28.08, 21, 3.4, 5), 'l'),
  ]),
  aegis: art(8, 4, [
    fill('M24.96 1L46 12L40 30L24.96 39L10 30L4 12Z', 'm'),
    line('M24.96 4L42.5 13', 'l', 1.6),
    fill(ellipse(24.96, 19.5, 11, 9.5), 'd'),
    fill(ellipse(24.96, 19.5, 6, 4.4), 'a', null),
    fill(ellipse(23, 18, 1.5), 'h', null),
  ]),
  cantor: art(10, 4, [
    line('M50 6V39', 'h', 2.2),
    line('M23 18H49', 'd', 2),
    fill('M20 11L33 38.5H7Z', 'm'),
    line('M14 27H26', 'l', 1.6),
    fill(ellipse(20, 7.5, 5.2), 'l'),
    fill(ellipse(20, 7.5, 1.9), 'a', null),
    fill(ellipse(50, 6, 4.4), 'a'),
    fill(ellipse(48.8, 4.8, 1.3), 'h', null),
    line('M43 3L45 4.5M57 3L55 4.5M43 10L45 8.5M57 10L55 8.5', 'g', 1.2),
  ]),
  sovereign: art(11, 7, [
    ...both(68.64,
      fill(ellipse(8, 41, 7.5, 11), 'd'),
      line('M24 58L19 69', 'd', 4)),
    fill('M12 27C12 13 24 9 34.32 9C45 9 56.6 13 56.6 27L56.6 45C56.6 55 46 59 34.32 59C23 59 12 55 12 45Z', 'm'),
    fill('M14 15L18 2L24.5 12L30 0L34.32 10L38.6 0L44 12L50.6 2L54.6 15Z', 'h'),
    fill(ellipse(34.32, 19.5, 3.2), 'a'),
    fill(box(18, 24, 32.64, 14, 6), 'd', null),
    ...both(68.64, fill(ellipse(26, 31, 5, 4), 'a', null), fill(ellipse(24.6, 29.8, 1.4), 'h', null)),
    line('M27.5 45L34.32 51L41 45', 'h', 2),
  ]),
};

// The Spire node, measured like the pixel Spire from the ASCII glyph grid.
const SPIRE_SHAPES = {
  large: { rx: 62.4, ry: 50, ring: 5.5, inner: [31.2, 25], spike: [34, 8.5, 12], core: [9.5, 7.8], housing: [19.5, 12.5], pylon: [6.2, 7.8] },
  small: { rx: 37.4, ry: 30, ring: 5, inner: null, spike: [20.5, 6, 7.5], core: [8, 6.2], housing: [16, 10.5], pylon: [5, 6.2] },
};

export function vectorSpire(columns, lines, size = columns > 20 ? 'large' : 'small') {
  const s = SPIRE_SHAPES[size];
  const w = columns * GLYPH, h = lines * LINE, cx = w / 2, cy = h / 2;
  const shapes = [];
  shapes.push(fill(ellipse(cx, cy, s.rx, s.ry), 'b', null));
  shapes.push(line(`M${cx} 0V${cy - s.ry}M${cx} ${cy + s.ry}V${h}`, 'm', 2.4));
  const barFrom = s.inner ? s.inner[0] : s.housing[0];
  shapes.push(line(`M0 ${cy}H${cx - barFrom}M${cx + barFrom} ${cy}H${w}`, 'm', 3.2));
  shapes.push(line(`M0 ${cy - 1.2}H${cx - s.rx}M${cx + s.rx} ${cy - 1.2}H${w}`, 'l', 1));
  shapes.push(line(ellipse(cx, cy, s.rx, s.ry), 'o', s.ring + 2.4));
  shapes.push(line(ellipse(cx, cy, s.rx, s.ry), 'm', s.ring));
  shapes.push(line(ellipse(cx - .8, cy - .8, s.rx - 1.4, s.ry - 1.4), 'l', 1.2));
  if (s.inner) shapes.push(line(ellipse(cx, cy, s.inner[0], s.inner[1]), 'd', 2.2));
  const [px, py] = s.pylon;
  for (const side of [-1, 1]) {
    shapes.push(fill(box(cx + side * s.rx - px, cy - py, 2 * px, 2 * py, 2.2), 'l'));
    shapes.push(fill(ellipse(cx + side * s.rx, cy, px * .4), 'h', null));
  }
  for (const side of [-1, 1]) shapes.push(fill(ellipse(cx, cy + side * s.ry, 3.2, 2.6), 'h'));
  const [sy, sw, sh] = s.spike;
  for (const side of [-1, 1]) {
    const y = cy + side * sy;
    shapes.push(fill(`M${cx} ${y - sh}L${cx + sw} ${y}L${cx} ${y + sh}L${cx - sw} ${y}Z`, 'a'));
    shapes.push(fill(`M${cx} ${y - sh * .45}L${cx + sw * .4} ${y}L${cx} ${y + sh * .45}L${cx - sw * .4} ${y}Z`, 'g', null));
  }
  const [hx, hy] = s.housing;
  shapes.push(fill(box(cx - hx, cy - hy, 2 * hx, 2 * hy, hy * .6), 'd', 'm', 1.6));
  shapes.push(fill(ellipse(cx, cy, s.core[0], s.core[1]), 'a', null));
  shapes.push(fill(ellipse(cx, cy, s.core[0] * .62, s.core[1] * .62), 'g', null));
  shapes.push(fill(ellipse(cx - s.core[0] * .3, cy - s.core[1] * .32, s.core[0] * .2), 'h', null));
  return { w, h, shapes };
}

const paths = new Map();
function path(d) {
  if (!paths.has(d)) paths.set(d, new Path2D(d));
  return paths.get(d);
}

// Paint a drawing so its viewBox fills width x height CSS pixels at x, y.
export function paintVector(ctx, drawing, palette, x, y, width, height) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(width / drawing.w, height / drawing.h);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  for (const shape of drawing.shapes) {
    const p = path(shape.d);
    if (shape.fill) {
      ctx.fillStyle = palette[shape.fill];
      ctx.fill(p);
    }
    if (shape.stroke) {
      ctx.strokeStyle = palette[shape.stroke];
      ctx.lineWidth = shape.width;
      ctx.stroke(p);
    }
  }
  ctx.restore();
}

// The same drawing as an inline SVG whose colors follow the theme through CSS.
const CSS_TONES = {
  o: 'color-mix(in srgb, var(--ink) 14%, var(--surface))',
  d: 'color-mix(in srgb, var(--muted) 62%, var(--surface))',
  m: 'var(--muted)',
  l: 'color-mix(in srgb, var(--muted) 45%, var(--ink))',
  h: 'var(--ink)',
  a: 'var(--accent)',
  g: 'color-mix(in srgb, var(--accent) 45%, var(--ink))',
  b: 'transparent',
};
const SVG = 'http://www.w3.org/2000/svg';

export function vectorElement(key, className) {
  const drawing = key === 'tower' ? vectorSpire(25, 13) : VECTOR_ENEMIES[key];
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('class', className);
  svg.setAttribute('aria-hidden', 'true');
  fillVectorElement(svg, drawing);
  return svg;
}

export function fillVectorElement(svg, drawingOrKey) {
  const drawing = typeof drawingOrKey === 'string'
    ? (drawingOrKey === 'tower' ? vectorSpire(25, 13) : VECTOR_ENEMIES[drawingOrKey]) : drawingOrKey;
  if (!drawing) return;
  svg.setAttribute('viewBox', `-3 -3 ${drawing.w + 6} ${drawing.h + 6}`);
  svg.replaceChildren(...drawing.shapes.map(shape => {
    const node = document.createElementNS(SVG, 'path');
    node.setAttribute('d', shape.d);
    node.setAttribute('style', `fill:${shape.fill ? CSS_TONES[shape.fill] : 'none'};stroke:${shape.stroke ? CSS_TONES[shape.stroke] : 'none'};stroke-width:${shape.width || 0};stroke-linecap:round;stroke-linejoin:round`);
    return node;
  }));
}
