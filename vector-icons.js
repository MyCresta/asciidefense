// Icons for the Vector art style. In ASCII and pixel styles every upgrade, relic
// and weapon has a small ASCII drawing; in Vector each is a line icon drawn here
// on a 24 x 24 grid. Relics sit on a badge whose shape names their family, so a
// card reads at a glance: circle Ballistics, hexagon Salvage, diamond Control,
// octagon Ordnance, shield Defense.
//
// Icons are single-color masks: the page paints them in the element's own text
// color, so they follow the theme, hover and disabled states like the ASCII did.

const c = (x, y, r) => `M${x - r} ${y}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`;
const rect = (x, y, w, h, r = 1) =>
  `M${x + r} ${y}h${w - 2 * r}a${r} ${r} 0 0 1 ${r} ${r}v${h - 2 * r}a${r} ${r} 0 0 1 ${-r} ${r}h${2 * r - w}a${r} ${r} 0 0 1 ${-r} ${-r}v${2 * r - h}a${r} ${r} 0 0 1 ${r} ${-r}Z`;
const poly = (points, close = true) => 'M' + points.map(p => p.join(' ')).join('L') + (close ? 'Z' : '');
const star = (cx, cy, outer, inner, n = 5, turn = -90) => poly(Array.from({ length: n * 2 }, (_, i) => {
  const r = i % 2 ? inner : outer, a = (turn + i * 180 / n) * Math.PI / 180;
  return [+(cx + r * Math.cos(a)).toFixed(2), +(cy + r * Math.sin(a)).toFixed(2)];
}));
const rays = (cx, cy, r1, r2, n, turn = 0) => Array.from({ length: n }, (_, i) => {
  const a = (turn + i * 360 / n) * Math.PI / 180;
  const f = v => +v.toFixed(2);
  return `M${f(cx + r1 * Math.cos(a))} ${f(cy + r1 * Math.sin(a))}L${f(cx + r2 * Math.cos(a))} ${f(cy + r2 * Math.sin(a))}`;
}).join('');

// Shapes: s = stroke path, f = filled path, o = opacity (default 1), w = stroke width.
const S = (d, w = 1.7, o = 1) => ({ d, w, o });
const F = (d, o = 1) => ({ d, fill: true, o });

const HEART = 'M12 18.5C8 15.5 6 13.3 6 10.8a3 3 0 0 1 6-1a3 3 0 0 1 6 1C18 13.3 16 15.5 12 18.5Z';
const SHIELD = 'M12 5L18 7.2V12c0 3.6-2.5 6-6 7.2C8.5 18 6 15.6 6 12V7.2Z';
const FLAME = 'M12 19c-3 0-5-2-5-4.8c0-2.6 2-4 2.6-6.4c1.4 1 1.8 2.4 1.8 3.4C12.6 10 13 7.4 12.2 5c3 1.6 4.8 5 4.8 9.2C17 17 15 19 12 19Z';
const SNOW = rays(12, 12, 0, 7, 6, 90) + 'M12 7.6L10.4 6M12 7.6L13.6 6M12 16.4L10.4 18M12 16.4L13.6 18' +
  'M8.2 9.8L6 9.4M8.2 9.8L7.6 7.6M15.8 14.2L18 14.6M15.8 14.2L16.4 16.4M15.8 9.8L18 9.4M15.8 9.8L16.4 7.6M8.2 14.2L6 14.6M8.2 14.2L7.6 16.4';
const COIN = c(12, 12, 6);
const BOLT = 'M13.2 5L8 13h4l-1.2 6L16 11h-4Z';
const GEAR = (r = 4.6) => star(12, 12, r + 1.8, r + .2, 8, -90 + 22.5);
const SKULL = 'M7 11.5a5 5 0 0 1 10 0c0 1.8-.8 2.8-1.8 3.4V17H8.8v-2.1C7.8 14.3 7 13.3 7 11.5Z';

export const MOTIFS = {
  // ---- general purpose
  star: [F(star(12, 12, 6.5, 2.8))],
  plus: [S('M12 6.5v11M6.5 12h11', 2.2)],
  crosshair: [S(c(12, 12, 5)), S('M12 4.5v4M12 15.5v4M4.5 12h4M15.5 12h4'), F(c(12, 12, 1.3))],
  skull: [S(SKULL), F(c(10, 11.6, 1.3)), F(c(14, 11.6, 1.3)), S('M10.6 17v-1.4M13.4 17v-1.4', 1.2)],
  die: [S(rect(6.5, 6.5, 11, 11, 2.4)), F(c(9.4, 9.4, 1.1)), F(c(12, 12, 1.1)), F(c(14.6, 14.6, 1.1))],
  dice: [S(rect(5, 8, 8.5, 8.5, 2)), S(rect(11.5, 5.5, 7.5, 7.5, 1.8)), F(c(7.6, 10.6, .9)), F(c(10.9, 13.9, .9)), F(c(15.25, 9.25, .9))],
  fork: [S('M5.5 12H11l6.5-5M11 12l6.5 5'), S('M15 6.2l2.6.8-.8 2.6M15 17.8l2.6-.8-.8-2.6', 1.4)],
  bounce: [S('M5 8.5l5.5 8 5-7.5 3.5 4'), F(c(19, 13, 1.5)), F(c(5, 8.5, 1.3), .5)],
  coin: [S(COIN), S('M13.8 9.6c-.6-.8-3.6-1-3.6.8s3.6.8 3.6 2.8c0 1.6-3 1.6-3.8.6M12 7.8v1M12 15.2v1', 1.4)],
  coins: [S(c(9.5, 13.5, 4.2)), S('M12.5 6.2a4.2 4.2 0 1 1 3.4 7.9', 1.6), S('M9.5 11.6v3.8', 1.3)],
  gauge: [S('M5.5 15.5a6.5 6.5 0 1 1 13 0'), S('M12 15.5l3.6-4.2', 2), F(c(12, 15.5, 1.5)), S('M7.4 11.2l1 .7M12 8.6v1.2', 1.2)],
  crown: [S('M6 16.5h12M6.5 16.5L5.5 8.5l3.8 3L12 6.5l2.7 5 3.8-3-1 8'), F(c(12, 6.5, 1)), F(c(5.5, 8.5, .9)), F(c(18.5, 8.5, .9))],
  eye: [S('M4.5 12c2-3.6 4.6-5.2 7.5-5.2s5.5 1.6 7.5 5.2c-2 3.6-4.6 5.2-7.5 5.2S6.5 15.6 4.5 12Z'), F(c(12, 12, 2.4))],
  flame: [S(FLAME), F('M12 17c-1.2 0-2-.9-2-2c0-1.2 1-1.8 1.4-3c.9.9 2.6 1.8 2.6 3.2c0 1-.8 1.8-2 1.8Z', .9)],
  caliper: [S('M6 6.5v11M6 6.5h12v3H9M6 17.5h3V9.5'), S('M12 9.5v2.5M15 9.5v2', 1.2)],
  rangefinder: [S(c(12, 12, 6.5), 1.3, .7), S(c(12, 12, 3.2)), F(c(12, 12, 1)), S('M12 3.8v3M12 17.2v3M3.8 12h3M17.2 12h3', 1.4)],
  gear: [S(GEAR()), S(c(12, 12, 2))],
  tag: [S('M5.5 12.5V6.5h6l7 7-6 6Z'), F(c(8.6, 9.6, 1.3))],
  hourglass: [S('M7.5 5.5h9M7.5 18.5h9M8.5 5.5c0 4 7 4.5 7 6.5s-7 2.5-7 6.5M15.5 5.5c0 4-7 4.5-7 6.5s7 2.5 7 6.5'), F('M10 17.6h4l-2-2.2Z')],
  rail: [S('M4.5 9.5h15M4.5 14.5h15'), S('M7 7.5v9M12 7.5v9M17 7.5v9', 1.3)],
  drum: [S(c(12, 12, 6.5)), F(c(12, 8.6, 1.3)), F(c(15, 10.3, 1.3)), F(c(15, 13.7, 1.3)), F(c(12, 15.4, 1.3)), F(c(9, 13.7, 1.3)), F(c(9, 10.3, 1.3))],
  relay: [S('M4.5 12h3l2-4.5 3 9 2.5-6.5 1.5 2h3')],
  blade: [S('M6 18l9.5-9.5 2.5-3-3 2.5L5.5 17.5'), S('M8.5 13.5l2 2M6 18l-1 1', 1.6)],
  brokenCrown: [S('M6 16.5h4.5M13.5 16.5H18M6.5 16.5L5.5 8.5l3.8 3L12 6.5M14.7 11.5l3.8-3-1 8'), S('M12 6.5l-1 4 2 2-1.5 4', 1.3)],
  deadeye: [S(c(12, 12, 6)), S('M12 4.5v15M4.5 12h15', 1.2, .7), F(c(12, 12, 2.2))],
  quickdraw: [F(BOLT), S('M4.5 8h3M4 12h3.5M4.5 16h3', 1.4, .7)],
  slug: [S('M6 9h7.5c3 0 4.5 1.4 4.5 3s-1.5 3-4.5 3H6Z'), S('M9 9v6', 1.3)],
  chevrons: [S('M6 7.5l5 4.5-5 4.5M12 7.5l5 4.5-5 4.5')],
  tracker: [S('M5 7.5l4 4.5-4 4.5'), S(c(16, 12, 3)), F(c(16, 12, 1))],
  wardrum: [S('M6.5 10v5c0 1.6 2.5 2.8 5.5 2.8s5.5-1.2 5.5-2.8v-5'), S('M6.5 10c0-1.6 2.5-2.8 5.5-2.8s5.5 1.2 5.5 2.8-2.5 2.8-5.5 2.8-5.5-1.2-5.5-2.8Z'), S('M9 5l3 4M15 5l-3 4', 1.4)],
  momentum: [S('M10.5 7.5l5 4.5-5 4.5'), S('M4.5 12h9M5.5 8.5h3M5.5 15.5h3', 1.4)],
  echo: [F(c(7.5, 12, 1.8)), S('M11 8.5a5 5 0 0 1 0 7M14 6a8.5 8.5 0 0 1 0 12M17 4.5a11 11 0 0 1 0 15', 1.4)],
  overdrive: [S('M7 12.5l5-5 5 5M7 17.5l5-5 5 5')],
  // ---- salvage
  hoard: [S('M5 17.5h14'), S(c(8.5, 14.5, 2.5)), S(c(15.5, 14.5, 2.5)), S(c(12, 10, 2.5)), F(c(12, 10, .9))],
  midas: [S(GEAR(4.2)), S('M13.3 10.6c-.4-.6-2.6-.7-2.6.5s2.6.5 2.6 1.9c0 1.1-2.2 1.1-2.8.4', 1.2)],
  jackpot: [S(rect(4.5, 7, 15, 10, 2)), S('M9.5 7v10M14.5 7v10', 1.2), S('M6 10.5h2.2l-1.4 3.5M10.9 10.5h2.2l-1.4 3.5M15.8 10.5H18l-1.4 3.5', 1.2)],
  poster: [S(rect(6.5, 5, 11, 14, 1.5)), S('M9 9h6M9 12h6M9 15h3.5', 1.3), F(c(12, 5, 1.1))],
  clover: [S('M12 12c-3.5-1-4.8-5-1.8-5.5C11.4 6.3 12 8 12 8s.6-1.7 1.8-1.5c3 .5 1.7 4.5-1.8 5.5Zm0 0c3.5-1 5 2.6 2.4 4.3-1.2.8-2.4-1-2.4-1s-1.2 1.8-2.4 1c-2.6-1.7-1.1-5.3 2.4-4.3Z'), S('M12 15.5l1.5 4', 1.4)],
  magpie: [S('M5.5 13c2.5 0 4-3.5 7-3.5c2 0 3 1 3.5 2l3 .5-3 1c-.5 2.5-3 4-6 4.5L5 18Z'), F(c(14.2, 11.4, .8)), S('M10 17.2l-1 2.3', 1.3)],
  card: [S(rect(7, 5, 10, 14, 1.8)), F(star(12, 12, 3.3, 1.4, 4, -90))],
  magnet: [S('M7.5 6v6a4.5 4.5 0 0 0 9 0V6', 3), S('M5.6 8h3.8M14.6 8h3.8', 1.4)],
  chartUp: [S('M5.5 18.5h13M5.5 18.5v-13'), S('M8 15l3-3.5 2.5 2L18 8'), S('M15 8h3v3', 1.4)],
  anvil: [S('M5.5 8.5h11c0 2-1.5 3.5-4 3.5v3h3v2.5h-9V15h3v-3c-2 0-4-1.4-4-3.5Z'), S('M16.5 8.5l2.5-1', 1.4)],
  mint: [S(c(12, 12, 3.5)), S('M5.5 11a6.5 6.5 0 0 1 11.6-3.6M18.5 13a6.5 6.5 0 0 1-11.6 3.6', 1.5), S('M17.4 5v2.6h-2.6M6.6 19v-2.6h2.6', 1.4)],
  net: [S(c(12, 12, 6.5)), S('M5.8 9.5h12.4M5.8 14.5h12.4M9.5 5.8v12.4M14.5 5.8v12.4', 1.1, .8)],
  seal: [S(star(12, 11, 6, 4.8, 12)), S('M9.5 15.5l-1 4 1.8-1 1 1.6.7-4M14.5 15.5l1 4-1.8-1-1 1.6-.7-4', 1.2), F(c(12, 11, 2))],
  tithe: [S(rect(5.5, 9.5, 13, 9, 1.5)), S('M10 12.5h4', 2), S(c(12, 6, 2), 1.4)],
  wrench: [S('M15.5 5.2a3.6 3.6 0 0 0-4 4.8L5.5 16l2.5 2.5 6-6a3.6 3.6 0 0 0 4.8-4l-2.2 2.2-2.4-.6-.6-2.4Z')],
  recycle: [S('M8 9.5l2.5-4h3l2 3.4M17.5 12l1.6 3-1.5 3h-4M10 18H6.4l-1.5-3 2-3.4'), S('M14 9.2l1.6-.3.3-1.7M12.8 16.4l.8 1.6-.8 1.6M7.2 13.4L6 12.3l-1.6.5', 1.2)],
  crucible: [S('M6.5 9h11l-1.6 8.5h-7.8Z'), S('M5 9h14', 1.4), S('M10 5.5c0 1.3 1.2 1.3 1.2 2.5M13.2 5c0 1.3 1.2 1.5 1.2 2.8', 1.2, .8), F('M8.6 12h6.8l-.6 3.4H9.2Z', .7)],
  magnifier: [S(c(10.5, 10.5, 4.5)), S('M14 14l5 5', 2.4), F(c(10.5, 10.5, 1.4), .7)],
  swap: [S('M6 9.5h11.5M14.5 6.5l3 3-3 3M18 14.5H6.5M9.5 11.5l-3 3 3 3')],
  // ---- control
  coldHeart: [S(HEART), S('M12 10.6v5M9.8 13.1h4.4', 1.2)],
  snow: [S(SNOW, 1.5)],
  repulse: [F(c(12, 12, 2)), S('M12 8.5V4.5M10.4 6l1.6-1.5L13.6 6M12 15.5v4M10.4 18l1.6 1.5 1.6-1.5M8.5 12h-4M6 10.4L4.5 12 6 13.6M15.5 12h4M18 10.4l1.5 1.6-1.5 1.6', 1.4)],
  caltrop: [S(c(12, 12, 6.2), 1.2, .6), F(star(12, 5.8, 2, .8, 3)), F(star(18.2, 12, 2, .8, 3, 0)), F(star(12, 18.2, 2, .8, 3, 90)), F(star(5.8, 12, 2, .8, 3, 180))],
  horn: [S('M5 10h3.5l9-4.5v13l-9-4.5H5Z'), S('M8.5 14l1.2 4.5h2.2l-.9-3.6', 1.4), S('M20 9.5c.8 1.6.8 3.4 0 5', 1.3, .8)],
  clock: [S(c(12, 12, 6.5)), S('M12 8v4l-2.6 2', 1.8), S('M5 5l14 14', 1.4, .8)],
  tar: [S('M12 5c2.5 3.5 4 5.5 4 7.5a4 4 0 0 1-8 0c0-2 1.5-4 4-7.5Z'), S('M5 19h14', 1.4), F(c(10.6, 13.2, 1), .8)],
  brittle: [S('M12 4.5l5 4-1 9-4 2-4-2-1-9Z'), S('M12 4.5l-.8 5 2.2 2.6-1.6 3.6M13.4 12.1l3.1-.7', 1.2)],
  anchor: [S('M12 8v10.5M8.5 10.5h7M6 14c0 2.8 2.8 4.5 6 4.5s6-1.7 6-4.5'), S(c(12, 6.2, 1.8), 1.4)],
  nova: [S(c(12, 12, 3), 1.4), S(rays(12, 12, 5, 8.5, 8, 22.5), 1.4), F(c(12, 12, 1.2))],
  // ---- ordnance
  lensBurst: [S(c(12, 12, 4)), S(rays(12, 12, 6, 8.5, 8), 1.4), F(c(12, 12, 1.4))],
  coilSpring: [S('M8 5.5h8M8 18.5h8'), S('M8 8l8 1.6L8 11.2l8 1.6L8 14.4l8 1.6', 1.4), S('M12 2.8v2.7', 1.4)],
  cinder: [S('M6 10h6c2.6 0 4 1 4 2s-1.4 2-4 2H6Z'), S('M17.5 9.5c1.4 1 1.4 4 0 5M5 12H3', 1.2, .8)],
  choke: [S('M5 10h4v4H5Z'), S('M9 12l9.5-5.5M9 12h10M9 12l9.5 5.5', 1.3), F(c(18.5, 6.5, 1)), F(c(19, 12, 1)), F(c(18.5, 17.5, 1))],
  shard: [S('M12 4.5l5.5 6-5.5 9-5.5-9Z'), S('M6.5 10.5h11M9.5 10.5l2.5 9 2.5-9', 1.1)],
  splinter: [F('M11 5.5l2.3 1-1 3.2-2.3-1.1Z'), F('M17.2 9.2l1.3 2.2-3.1 1.4-.9-2.3Z'), F('M15.5 16.5l-1.3 2.2-2.6-2.2 1.8-1.8Z'), F('M7.5 15.8l-2-1.6 2.2-2.6 1.6 2Z'), F('M6.8 7.6l2.4-.3.5 3.2-2.5.3Z'), F(c(12, 12, 1.2))],
  mortar: [S('M6.5 18.5h11l-1.8-3H8.3Z'), S('M9.8 15.5l3.4-7.5 2.6 1.2-2.4 6.3', 1.6), S('M14.5 6.5c1-2 3-2.5 4.5-1.5', 1.3, .8)],
  braid: [S('M5 8c3.5 0 3.5 8 7 8s3.5-8 7-8M5 16c3.5 0 3.5-8 7-8s3.5 8 7 8', 1.5)],
  bloom: [F(c(12, 12, 1.8)), S('M12 10.2c-1.6-2.4-1.6-4.4 0-5.7 1.6 1.3 1.6 3.3 0 5.7ZM13.8 12c2.4-1.6 4.4-1.6 5.7 0-1.3 1.6-3.3 1.6-5.7 0ZM12 13.8c1.6 2.4 1.6 4.4 0 5.7-1.6-1.3-1.6-3.3 0-5.7ZM10.2 12c-2.4 1.6-4.4 1.6-5.7 0 1.3-1.6 3.3-1.6 5.7 0Z', 1.3)],
  bell: [S('M7 16.5c1-1.2 1-2.5 1-5a4 4 0 0 1 8 0c0 2.5 0 3.8 1 5Z'), S('M5.5 16.5h13', 1.5), F(c(12, 18.5, 1.3)), S('M12 5.5V4', 1.4)],
  kindling: [S('M5.5 18l13-4M5.5 14l13 4', 2), S('M12 12.5c-2 0-3-1.3-3-3 0-1.6 1.5-2.4 1.8-4 1 .7 1.2 1.6 1.2 2.4.4-.6.8-1.4.6-2 1.6 1 2.4 2.2 2.4 3.6 0 1.7-1 3-3 3Z', 1.3)],
  shrapnel: [F(c(12, 12, 2.6)), F('M17.5 6.5l1 1-2.4 1.4-.5-.5Z'), F('M5.5 7.5l1-1 1.4 2.4-.5.5Z'), F('M18.5 16.5l-1 1-1.4-2.4.5-.5Z'), F('M6.5 17.5l-1-1 2.4-1.4.5.5Z'), S('M12 4.5v2.4M12 17.1v2.4M4.5 12h2.4M17.1 12h2.4', 1.2, .7)],
  ground: [S('M12 4.5v8.5M6 13h12M8 15.7h8M10 18.4h4')],
  flash: [F(star(12, 12, 7.5, 2.2, 4, -90)), F(star(12, 12, 4.5, 1.6, 4, -45), .6)],
  zigzag: [S(BOLT), S('M17.5 6.5l1.5-1.5M18.5 10h2M5 16.5l-1.5 1.5', 1.3, .8)],
  starfall: [F(star(15, 9, 4.5, 2)), S('M11 13l-6 6M13 14.5l-3.5 3.5M9.5 11.5L6 15', 1.3, .7)],
  prism: [S('M12 5.5l6.5 12h-13Z'), S('M3.5 13l6-1.5M14.5 11l6-2.5M14.8 12.5l5.7.5M14.2 14l5.3 2.5', 1.2, .8)],
  // ---- defense
  ward: [S(SHIELD), S(c(12, 12, 2.6), 1.3)],
  siphon: [S(HEART), S('M12 9v5.5M10 12.6l2 2 2-2', 1.3)],
  battery: [S(rect(5, 8, 13, 8, 1.5)), S('M18 10.5h1.5v3H18', 1.4), F(rect(7, 10, 3, 4, .5)), F(rect(11, 10, 3, 4, .5), .6)],
  rivets: [S(rect(5.5, 5.5, 13, 13, 2)), F(c(8.4, 8.4, 1)), F(c(15.6, 8.4, 1)), F(c(8.4, 15.6, 1)), F(c(15.6, 15.6, 1))],
  cross: [S('M10 5.5h4v4.5h4.5v4H14v4.5h-4V14H5.5v-4H10Z')],
  stoneHeart: [F(HEART, .9), S('M10 10.5l2 2.5-1 2.5M13.5 10.5l-1.5 2.5', 1.1, .9)],
  spite: [S('M5.5 6.5h7M5.5 17.5h7'), S('M5.5 9l7 1.5-7 1.5 7 1.5-7 1.5', 1.3), S('M14.5 12h5M17 9.5l2.5 2.5-2.5 2.5', 1.5)],
  phoenix: [S('M12 18.5c-4 0-6-2.8-6-5.5 0-2 1-3 2-4 .2 1.4.8 2.2 1.6 2.6C9.4 8.6 11 6.6 12 4.5c1 2.1 2.6 4.1 2.4 7.1.8-.4 1.4-1.2 1.6-2.6 1 1 2 2 2 4 0 2.7-2 5.5-6 5.5Z'), F(c(12, 15, 1.4), .8)],
  heartSpark: [S(HEART), F('M12.6 9.6L10.6 13h1.8l-.8 2.8 2.4-3.6h-1.8Z')],
  reactive: [S(rect(6, 6, 12, 12, 2)), S(rays(12, 12, 2, 4.4, 8), 1.3), F(c(12, 12, 1.2))],
  overshield: [S(SHIELD), S('M12 2.5l8 3V12c0 4.8-3.4 8-8 9.5', 1.3, .7)],
  lifeline: [S('M4 12h4l1.5-3.5 3 7 2-5 1 1.5H20')],
  bulkhead: [S(rect(6, 4.5, 12, 15, 2)), S('M6 9.5h12M6 14.5h12', 1.2), F(c(15.5, 12, .9))],
  // ---- upgrades and weapons
  radar: [S(c(12, 12, 6.5)), S(c(12, 12, 3.3), 1.3, .7), S('M12 12l4.5-4.5', 1.8), F(c(12, 12, 1.1))],
  splash: [F(c(12, 12, 2.8)), S(c(12, 12, 6), 1.3, .7), S(rays(12, 12, 7.5, 9.2, 8, 22.5), 1.3)],
  impact: [S('M5 19l6.5-6.5'), S('M11.5 7.5l5 5-2 2-5-5Z'), S('M15 5.5l3.5 3.5-2 2L13 7.5Z')],
  critical: [S(c(12, 12, 5.5), 1.4), F(star(12, 12, 4, 1.6, 4, -90))],
  chain: [S(rect(4, 9.5, 9, 5, 2.5)), S(rect(11, 9.5, 9, 5, 2.5))],
  armor: [S(SHIELD), S('M12 7v11', 1.3, .7)],
  repair: [S('M15.5 5.2a3.6 3.6 0 0 0-4 4.8L5.5 16l2.5 2.5 6-6a3.6 3.6 0 0 0 4.8-4l-2.2 2.2-2.4-.6-.6-2.4Z'), S('M17 15v4M15 17h4', 1.4)],
  bountyCoin: [S(COIN), F(star(12, 12, 3.4, 1.4))],
  hunterEye: [S('M4.5 12c2-3.6 4.6-5.2 7.5-5.2s5.5 1.6 7.5 5.2c-2 3.6-4.6 5.2-7.5 5.2S6.5 15.6 4.5 12Z'), S(c(12, 12, 2.4), 1.3), F(c(12, 12, 1))],
  wall: [S(rect(4.5, 6.5, 15, 11, 1)), S('M4.5 10.2h15M4.5 13.8h15M9 6.5v3.7M15 6.5v3.7M12 10.2v3.6M7 13.8v3.7M17 13.8v3.7', 1.1)],
  crossbow: [S('M4 12h14'), S('M15.5 9l3 3-3 3', 1.6), S('M8 5.5c2 2 2 11 0 13', 1.6), S('M8 5.5l-2 6.5 2 6.5', 1, .7)],
  scattergun: [S('M4 11h8.5v3H4Z'), S('M12.5 12.5l6.5-5M12.5 12.5H20M12.5 12.5l6.5 5', 1.3), S('M6.5 14v3', 1.6)],
  lance: [S('M3.5 10.5h14l3 1.5-3 1.5h-14Z'), S('M7 10.5v3M11 10.5v3', 1.2)],
  arc: [S(c(7.5, 12, 2.5)), S('M10 12l2.5-3 2 5 2-4 3.5 2', 1.5)],
  flak: [S('M6.5 18.5h11l-1.8-3H8.3Z'), S('M9.8 15.5l3.4-7.5 2.6 1.2-2.4 6.3', 1.6), F(star(17, 5.8, 2.6, 1, 6))],
  cryo: [S('M4 10.5h7v3H4ZM11 11h2.5v2H11Z'), S('M17 8v8M13.6 10l6.8 4M13.6 14l6.8-4', 1.3)],
  beam: [S(c(7, 12, 3)), S('M10 12h10', 2.4), S('M10 9.5h8M10 14.5h8', 1, .5), F(c(7, 12, 1.1))],
  pulse: [F(c(12, 12, 1.8)), S(c(12, 12, 4.5), 1.6), S(c(12, 12, 7.5), 1.3, .6)],
  crate: [S('M5 9l7-3.5L19 9v7l-7 3.5L5 16Z'), S('M5 9l7 3.5L19 9M12 12.5v7', 1.3)],
  tune: [S(GEAR(4.4)), F(c(12, 12, 2))],
  mystery: [S(rect(7, 5, 10, 14, 1.8)), S('M10.2 10a1.9 1.9 0 1 1 2.6 1.8c-.6.3-.8.7-.8 1.4', 1.5), F(c(12, 15.6, .9))],
  socket: [S(c(12, 12, 6.5), 1.3, .6), S('M12 9v6M9 12h6', 1.6)],
  // ---- relics with mechanics of their own
  drone: [S(c(12, 12, 6.5), 1, .45), F(c(18.5, 12, 2)), F(c(12, 12, 1.6))],
  well: [S('M12 5.5a6.5 6.5 0 1 1-6.5 6.5', 1.6), S('M12 8.5a3.5 3.5 0 1 1-3.5 3.5', 1.4, .7), F(c(12, 12, 1.2))],
  mark: [S(c(12, 12, 5.5), 1.4), S('M9 9l6 6M15 9l-6 6', 1.8)],
  knock: [F(c(15, 12, 2.6)), S('M5 9.5l3 2.5-3 2.5M8.5 9.5l3 2.5-3 2.5', 1.5)],
  furnace: [S(rect(6.5, 9, 11, 10, 1.5)), S('M9 9V6.5M12 9V5.5M15 9V6.5', 1.4, .7), F(FLAME, .25)],
  trophy: [S('M8 6h8v3a4 4 0 0 1-8 0Z'), S('M12 13v3.5M9 18.5h6', 1.6), S('M8 7.5H6.2a2 2 0 0 0 2 3M16 7.5h1.8a2 2 0 0 1-2 3', 1.2)],
  wind: [S('M5 9h9a2.5 2.5 0 1 0-2.5-2.5', 1.6), S('M5 13h12a2.5 2.5 0 1 1-2.5 2.5', 1.6), S('M5 17h5', 1.4, .6)],
  mimic: [S(rect(6, 7, 12, 11, 2)), F(c(9.8, 11, 1.1)), F(c(14.2, 11, 1.1)), S('M8.5 15l1.2-1 1.2 1 1.1-1 1.1 1 1.2-1 1.2 1', 1.2)],
  vane: [S('M12 5v14M5 12h14', 1.2, .6), S('M7 7l10 10', 1.8), F('M17 17l-3.6-.6 3-3Z')],
  sapper: [S(c(12, 12, 5.5), 1.5), S('M8 16L16 8', 1.6), S('M12 4.5v2.5M12 17v2.5', 1.3, .6)],
  mine: [F(c(12, 12, 3.4)), S(rays(12, 12, 4.4, 6.8, 8), 1.5)],
  sunlance: [F(c(7.5, 12, 2.6)), S('M10.5 12H20', 2.2), S(rays(7.5, 12, 3.8, 5.6, 6, 30), 1.2, .7)],
  field: [S(c(12, 12, 7), 1.1, .45), S(c(12, 12, 4.2), 1.3, .7), F(c(12, 12, 1.8))],
  overcharge: [S(rect(5, 7.5, 12, 9, 1.5)), S('M17 10.5h2v3h-2', 1.3), F(BOLT, .9)],
  scrapPlate: [S(SHIELD), S('M12 8.5v7M13.7 9.8c-.5-.5-1-.7-1.7-.7-1 0-1.7.5-1.7 1.3 0 1.8 3.4 1 3.4 2.8 0 .8-.7 1.3-1.7 1.3-.8 0-1.4-.3-1.9-.8', 1.2)],
  steady: [S(c(12, 12, 6.2), 1.4), S('M12 4v4M12 16v4M4 12h4M16 12h4', 1.4), F(c(12, 12, 1.2))],
  shatterIce: [S(SNOW, 1.2, .55), S('M7 7l4 4M17 7l-4 4M7 17l4-4M17 17l-4-4', 1.7)],
  link: [S(rect(4.5, 9.5, 8, 5, 2.5), 1.6), S(rect(11.5, 9.5, 8, 5, 2.5), 1.6)],
};

// Badges behind relics, by family, plus a soft plate for workshop upgrades.
const BADGES = {
  Ballistics: c(12, 12, 10.8),
  Salvage: poly([[12, 1.2], [21.4, 6.6], [21.4, 17.4], [12, 22.8], [2.6, 17.4], [2.6, 6.6]]),
  Control: 'M12 .8L23.2 12 12 23.2.8 12Z',
  Ordnance: poly([[8, 1.2], [16, 1.2], [22.8, 8], [22.8, 16], [16, 22.8], [8, 22.8], [1.2, 16], [1.2, 8]]),
  Defense: 'M12 1L21.5 4.4V12c0 5.6-4 9.4-9.5 11C6.5 21.4 2.5 17.6 2.5 12V4.4Z',
  Cursed: star(12, 12, 11.6, 8.8, 9),
  plate: rect(1.5, 1.5, 21, 21, 6),
};

const RELIC_MOTIFS = {
  reaper: 'skull', overkill: 'chevrons', ricochet: 'bounce', coinflip: 'coin', twinshot: 'fork', overclock: 'gauge',
  headhunter: 'crown', scope: 'eye', reactor: 'flame', caliper: 'caliper', longshot: 'rangefinder', clockwork: 'gear',
  spotter: 'tag', glass: 'hourglass', rail: 'rail', repeater: 'drum', redline: 'relay', precision: 'dice', execute: 'blade',
  regicide: 'brokenCrown', deadeye: 'deadeye', quickdraw: 'quickdraw', slug: 'slug', tracker: 'tracker', warcry: 'wardrum',
  momentum: 'momentum', echo: 'echo', overdrive: 'overdrive',
  hoard: 'hoard', midas: 'midas', jackpot: 'jackpot', warrant: 'poster', lucky: 'clover', magpie: 'magpie', wildcard: 'card',
  harvest: 'magnet', interest: 'chartUp', foundry: 'anvil', stipend: 'mint', poacher: 'net', royalty: 'seal', tithe: 'tithe',
  scavenger: 'wrench', recycler: 'recycle', smelter: 'crucible', appraiser: 'magnifier', broker: 'swap',
  dilation: 'hourglass', coldblood: 'coldHeart', frost: 'snow', repulse: 'repulse', crowfoot: 'caltrop', packhunter: 'horn',
  stasis: 'clock', tarpit: 'tar', brittle: 'brittle', anchor: 'anchor', nova: 'nova',
  pyre: 'flame', fracture: 'lensBurst', tesla: 'coilSpring', ember: 'cinder', buckshot: 'choke', firstblood: 'shard',
  tracer: 'splinter', mortar: 'mortar', mesh: 'braid', bloom: 'bloom', horizon: 'bell', kindling: 'kindling',
  shrapnel: 'shrapnel', conductor: 'ground', flashbang: 'flash', static: 'zigzag', starfall: 'starfall', prism: 'prism',
  ward: 'ward', repair: 'siphon', reservoir: 'battery', bulwark: 'rivets', triage: 'cross', ballast: 'stoneHeart',
  returnfire: 'spite', fuse: 'phoenix', galvanic: 'heartSpark', plating: 'reactive', overshield: 'overshield',
  lifeline: 'lifeline', bulkhead: 'bulkhead',
  drone: 'drone', gravity: 'well', marked: 'mark', concuss: 'knock', furnace: 'furnace', trophy: 'trophy',
  secondwind: 'wind', mimic: 'mimic', vane: 'vane', sapper: 'sapper', mines: 'mine', sunlance: 'sunlance',
  aura: 'field', overcharge: 'overcharge', scrapshield: 'scrapPlate', kinetic: 'steady', shatter: 'shatterIce', linked: 'link',
};

const UPGRADE_MOTIFS = {
  range: 'radar', rate: 'chevrons', splash: 'splash', damage: 'impact', crit: 'critical', chain: 'chain', armor: 'armor',
  regen: 'repair', bounty: 'bountyCoin', lethality: 'blade', incendiary: 'flame', chill: 'snow', hunter: 'hunterEye',
  barrier: 'wall', salvage: 'magnet',
};

const WEAPON_MOTIFS = { bolt: 'crossbow', scatter: 'scattergun', lance: 'lance', coil: 'arc', mortar: 'flak', cryo: 'cryo', beam: 'beam', pulse: 'pulse' };
const SERVICE_MOTIFS = { caches: 'crate', tune: 'tune', repair: 'plus', relic: 'mystery' };

export const ICON_KEYS = { relic: RELIC_MOTIFS, upgrade: UPGRADE_MOTIFS, weapon: WEAPON_MOTIFS, service: SERVICE_MOTIFS };

// One icon as an SVG string: a motif, optionally on a badge.
export function iconSVG(motif, badge) {
  const parts = [];
  if (badge && BADGES[badge]) {
    parts.push(`<path d="${BADGES[badge]}" fill="#000" fill-opacity=".14"/>`);
    parts.push(`<path d="${BADGES[badge]}" fill="none" stroke="#000" stroke-opacity=".5" stroke-width="1.1" stroke-linejoin="round"/>`);
  }
  for (const shape of MOTIFS[motif] || MOTIFS.star) {
    parts.push(shape.fill
      ? `<path d="${shape.d}" fill="#000" fill-opacity="${shape.o}"/>`
      : `<path d="${shape.d}" fill="none" stroke="#000" stroke-opacity="${shape.o}" stroke-width="${shape.w}" stroke-linecap="round" stroke-linejoin="round"/>`);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">${parts.join('')}</svg>`;
}

export const svgURL = svg => `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;

// The Vector wordmark: LAST SPIRE built from rounded strokes.
// Drawn on a 16-unit-tall grid.
const LETTERS = {
  L: 'M1.5 2v12h7',
  A: 'M0 14L4.5 2h1L10 14M2.2 9.5h5.6',
  S: 'M9 3.6C8 2.4 6.6 2 5 2 2.8 2 1.2 3.2 1.2 5c0 4 8 2.4 8 6.6 0 1.6-1.6 2.4-4 2.4-1.8 0-3.4-.6-4.4-1.8',
  T: 'M0 2h10M5 2v12',
  P: 'M1.5 14V2h4.2c2.4 0 3.8 1.3 3.8 3.4S8.1 8.8 5.7 8.8H1.5',
  I: 'M1.5 2v12',
  R: 'M1.5 14V2h4.2c2.4 0 3.8 1.3 3.8 3.4S8.1 8.8 5.7 8.8H1.5M5.6 8.8L10 14',
  E: 'M9 2H1.5v12H9M1.5 8h6',
};

export function wordmarkSVG(text = 'LAST SPIRE') {
  const spacing = 1.6, gap = 5;
  const parts = [];
  let x = 0;
  for (const char of text) {
    if (char === ' ') { x += gap; continue; }
    if (LETTERS[char]) parts.push(`<path transform="translate(${x.toFixed(2)} 0)" d="${LETTERS[char]}"/>`);
    x += (char === 'I' ? 3 : 10) + spacing;
  }
  const width = x - spacing;
  return {
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-1.4 -1.4 ${(width + 2.8).toFixed(2)} 18.8"><g fill="none" stroke="#000" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">${parts.join('')}</g></svg>`,
    ratio: (width + 2.8) / 18.8,
  };
}
