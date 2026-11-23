// Headless balance check: a bot plays full runs on fixed seeds and reports
// survival, power over time, how much of the relic pool it saw and how much
// scrap went unspent. Run with: node tools/balance-sim.mjs [seeds] [minutes] [--rows]
import { start, play, precision, ordnance } from '../tests/support/gameplay.mjs';
import { POWERS, UPGRADES } from '../content.js';
import { mountStats } from '../weapons.js';

const seeds = Number(process.argv[2] || 6);
const minutes = Number(process.argv[3] || 35);
const marks = [5, 10, 15, 20, 30];
const power = game => game.armory.mounts.reduce((sum, mount, slot) => {
  const stats = mountStats(mount, game);
  return sum + game.damage * stats.scale * game.rate * stats.cadence * [1, .65, .5][slot] * (1 + game.critChance);
}, 0);
const median = values => { const v = values.filter(Number.isFinite).sort((a, b) => a - b); return v.length ? Math.round(v[Math.floor(v.length / 2)]) : '-'; };

const rows = [];
for (const build of [precision, ordnance]) {
  for (let seed = 1; seed <= seeds; seed++) {
    const game = start(seed * 7919);
    const seen = new Set();
    const at = {};
    let maxedAt = null;
    play(game, build, minutes * 60, g => {
      for (const key of g.choices) seen.add(key);
      const minute = Math.floor(g.time / 60);
      if (marks.includes(minute) && !at[minute]) at[minute] = power(g);
      if (maxedAt === null && Object.keys(UPGRADES).every(key => g.levels[key] >= UPGRADES[key].maxLevel)) maxedAt = minute;
    });
    rows.push({ build: build.name, seed, survived: Math.floor(game.time / 60), seen: seen.size, pool: Object.keys(POWERS).length,
      maxed: maxedAt ?? '-', grade: game.armory.mounts.map(m => m.grade).join('/'), ...Object.fromEntries(marks.map(m => ['dps' + m, at[m]])),
      scrap: Math.round(game.scrap) });
  }
}
if (process.argv.includes('--rows')) console.table(rows.map(row => Object.fromEntries(Object.entries(row).map(([k, v]) => [k, typeof v === 'number' ? Math.round(v) : v ?? '-']))));
const summary = {};
for (const build of [precision.name, ordnance.name]) {
  const mine = rows.filter(row => row.build === build);
  summary[build] = {
    'median survival (min)': median(mine.map(row => row.survived)),
    [`reached ${minutes} min`]: mine.filter(row => row.survived >= minutes - 1).length + '/' + mine.length,
    'relics seen (median)': median(mine.map(row => row.seen)),
    'all upgrades maxed by (min)': median(mine.map(row => typeof row.maxed === 'number' ? row.maxed : NaN)),
    ...Object.fromEntries(marks.map(m => ['dps @' + m, median(mine.map(row => row[m === 5 ? 'dps5' : 'dps' + m]))]))
  };
}
console.table(summary);
