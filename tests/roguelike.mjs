// Run with: node --test tests/roguelike.mjs
import assert from 'node:assert/strict';
import test from 'node:test';
import { Game } from '../engine.js';
import { ENEMIES, POWERS, UPGRADES } from '../content.js';
import { saveCheckpoint, clearCheckpoint } from '../checkpoint.js';

const RECORDS_KEY = 'last-spire.records.v1';
const CHECKPOINT_KEY = 'last-spire.checkpoint.v2';

class MemoryStorage {
  items = new Map();
  getItem(key) { return this.items.get(key) ?? null; }
  setItem(key, value) { this.items.set(key, String(value)); }
  removeItem(key) { this.items.delete(key); }
}

// Park-Miller with a positive, nonzero seed. Every enemy, shot and offered
// relic uses the same injected stream as the production simulation.
function seededRandom(seed) {
  let state = seed;
  return () => {
    state = state * 16807 % 2147483647;
    return (state - 1) / 2147483646;
  };
}

function start(seed = 19, storage = new MemoryStorage(), resume = false) {
  return new Game({ random: seededRandom(seed), storage, resume });
}

const precision = {
  name: 'Precision',
  weights: { damage: 1.55, rate: 1.3, crit: 0.95, range: 0.5, bounty: 0.45, chain: 0.25, splash: 0.22, armor: 0.15, regen: 0.1 },
  relics: ['headhunter', 'ember', 'overclock', 'twinshot', 'ward', 'scope']
};
const ordnance = {
  name: 'Ordnance',
  weights: { splash: 1.25, chain: 1.15, rate: 0.96, damage: 0.9, range: 0.65, bounty: 0.45, armor: 0.22, regen: 0.18, crit: 0.12 },
  relics: ['fracture', 'tesla', 'repulse', 'frost', 'twinshot', 'overclock']
};

// A player can reproduce these builds by saving for the lowest price relative
// to priority. No scrap grants, clock jumps, enemy edits or extra draft rerolls.
function shop(game, build) {
  for (;;) {
    const keys = Object.keys(build.weights);
    keys.sort((a, b) => game.cost(a) / build.weights[a] - game.cost(b) / build.weights[b]);
    const key = keys[0];
    const price = game.cost(key);
    if (!Number.isFinite(price) || price > game.scrap) return;
    const before = game.scrap;
    const level = game.levels[key];
    assert.equal(game.buy(key), true);
    assert.equal(game.levels[key], level + 1);
    assert.equal(game.scrap, before - price);
  }
}

function takeRelic(game, priority) {
  assert.equal(game.status, 'draft');
  assert.equal(game.choices.length, 3);
  assert.equal(new Set(game.choices).size, 3);
  for (const key of game.choices) {
    assert.ok(Object.hasOwn(POWERS, key), 'Draft offered unknown relic ' + key);
    const cap = POWERS[key].maxStacks;
    assert.ok(cap == null || (game.powers[key] || 0) < cap, 'Draft offered exhausted relic ' + key);
  }
  const chosen = priority.find(key => game.choices.includes(key)) ?? game.choices[0];
  const before = game.powers[chosen] || 0;
  assert.equal(game.pickPower(chosen), true);
  assert.equal(game.powers[chosen], before + 1);
  return chosen;
}

function play(game, build, limit, onStep = () => {}) {
  while (game.status !== 'over' && game.time < limit - 1e-7) {
    if (game.status === 'draft') {
      takeRelic(game, build?.relics || []);
      continue;
    }
    assert.equal(game.status, 'running');
    if (build) shop(game, build);
    const before = game.time;
    game.update(Math.min(1, limit - before));
    assert.ok(game.time > before || game.status !== 'running', 'Combat clock stalled');
    onStep(game);
  }
}

function snapshotCombat(game) {
  return structuredClone({
    run: game.run, status: game.status, time: game.time, hp: game.hp,
    starterReady: game.starterReady, doctrine: game.doctrine, selected: game.selected,
    draftReason: game.draftReason, warning: game.warning, queue: game.queue, focusId: game.focusId,
    scrap: game.scrap, kills: game.kills, enemies: game.enemies,
    levels: game.levels, choices: game.choices, powers: game.powers,
    nextDraft: game.nextDraft, nextBoss: game.nextBoss, bossKills: game.bossKills
  });
}

test('v1 lifetime records grant the old blueprints on a new run', () => {
  const storage = new MemoryStorage();
  storage.setItem(RECORDS_KEY, JSON.stringify({ runs: 7, totalKills: 175, best: 301 }));
  const game = start(41, storage, true);
  const fresh = start(41);
  assert.equal(game.run, 8);
  assert.equal(game.best, 301);
  assert.equal(game.progress.totalKills, 175);
  assert.equal(game.progress.rank, 3);
  assert.ok(game.scrap > fresh.scrap && game.damage > fresh.damage && game.range > fresh.range);
  const before = game.run;
  game.restart('ballista');
  assert.equal(game.run, before + 1);
  assert.ok(game.levels.damage > fresh.levels.damage);
  assert.equal(game.progress.totalKills, 175);
});

test('the shop rejects unknown, unaffordable and capped purchases without spending scrap', () => {
  const game = start();
  const startScrap = game.scrap;
  assert.equal(game.buy('not-an-upgrade'), false);
  assert.equal(game.scrap, startScrap);
  // Isolate catalog and price boundaries; the seeded full runs below earn their own scrap.
  for (const [key, upgrade] of Object.entries(UPGRADES)) {
    while (game.levels[key] < upgrade.maxLevel) {
      const cost = game.cost(key);
      assert.ok(Number.isSafeInteger(cost) && cost > 0);
      game.scrap = cost - 1;
      assert.equal(game.buy(key), false);
      assert.equal(game.scrap, cost - 1);
      game.scrap = cost;
      assert.equal(game.buy(key), true);
      assert.equal(game.scrap, 0);
    }
    assert.equal(game.cost(key), Infinity);
    assert.equal(game.buy(key), false);
    assert.equal(game.levels[key], upgrade.maxLevel);
  }
});

test('opening relic is optional and can be secured only once', () => {
  const game = start();
  assert.equal(game.status, 'running');
  assert.equal(game.starterReady, true);
  assert.equal(game.openStarter(), true);
  const time = game.time;
  const selected = takeRelic(game, []);
  assert.equal(game.pickPower(selected), false);
  assert.equal(game.openStarter(), false);
  assert.equal(game.time, time);
  assert.equal(game.status, 'running');
  game.update(1);
  assert.ok(game.time > time);
});

test('crossing 02:00 freezes combat, persists the same draft, and pays exactly one choice', () => {
  const storage = new MemoryStorage();
  const game = start(587, storage);
  play(game, precision, 119.75);
  assert.equal(game.status, 'running');
  const run = game.run;
  game.update(5);
  assert.equal(game.status, 'draft');
  assert.equal(game.draftReason, 'time');
  assert.ok(Math.abs(game.time - 120) < 1e-6, 'Draft opened at ' + game.time);
  assert.equal(game.starterReady, false);
  const frozen = snapshotCombat(game);
  game.update(50);
  game.togglePause();
  assert.equal(game.pickPower('not-an-offer'), false);
  assert.equal(game.buy('range'), false);
  assert.deepEqual(snapshotCombat(game), frozen);
  assert.equal(saveCheckpoint(game), true);
  const records = storage.getItem(RECORDS_KEY);
  const restored = start(32001, storage, true);
  assert.deepEqual(snapshotCombat(restored), frozen);
  assert.equal(storage.getItem(RECORDS_KEY), records);
  const chosen = takeRelic(restored, []);
  assert.equal(restored.pickPower(chosen), false);
  assert.equal(restored.status, 'running');
  restored.update(1);
  assert.ok(restored.time > 120 && restored.time < 122);
  assert.equal(restored.run, run);
  assert.ok(restored.nextDraft > restored.time);
});

test('checkpoints resume active and paused runs, reject broken saves, and clear on fresh start', () => {
  const storage = new MemoryStorage();
  const game = start(289, storage);
  play(game, ordnance, 45);
  assert.equal(saveCheckpoint(game), true);
  const restored = start(133, storage, true);
  assert.deepEqual(snapshotCombat(restored), snapshotCombat(game));
  restored.togglePause();
  assert.equal(saveCheckpoint(restored), true);
  const paused = start(579, storage, true);
  assert.equal(paused.status, 'paused');
  paused.update(3);
  assert.equal(paused.time, restored.time);
  clearCheckpoint(paused);
  assert.equal(storage.getItem(CHECKPOINT_KEY), null);
  storage.setItem(CHECKPOINT_KEY, '{"time":');
  const clean = start(121, storage, true);
  assert.equal(clean.time, 0);
  assert.equal(clean.run, game.run + 1);
  assert.equal(storage.getItem(CHECKPOINT_KEY), null);
  saveCheckpoint(clean);
  clean.restart();
  assert.equal(storage.getItem(CHECKPOINT_KEY), null);
});

test('replaying progress made after a checkpoint cannot pay lifetime kills twice', () => {
  const storage = new MemoryStorage();
  const game = start(37, storage);
  play(game, precision, 39);
  const atSave = game.kills;
  assert.equal(saveCheckpoint(game), true);
  play(game, precision, 72);
  assert.ok(game.kills > atSave);
  const resumed = start(53, storage, true);
  assert.equal(resumed.kills, atSave);
  assert.equal(resumed.progress.totalKills, game.kills);
  play(resumed, precision, 85);
  assert.equal(resumed.progress.totalKills, Math.max(game.kills, resumed.kills));
});

test('an older tab cannot overwrite or clear a newer run checkpoint', () => {
  const storage = new MemoryStorage();
  const older = start(3, storage);
  play(older, precision, 20);
  assert.equal(saveCheckpoint(older), true);
  const newer = start(5, storage);
  assert.ok(newer.run > older.run);
  play(newer, ordnance, 22);
  assert.equal(saveCheckpoint(newer), true);
  const saved = storage.getItem(CHECKPOINT_KEY);
  assert.equal(saveCheckpoint(older), false);
  assert.equal(clearCheckpoint(older), false);
  assert.equal(storage.getItem(CHECKPOINT_KEY), saved);
  const restored = start(7, storage, true);
  assert.deepEqual(snapshotCombat(restored), snapshotCombat(newer));
});

test('failure to write browser storage leaves combat playable in memory', () => {
  const fail = () => { throw new Error('Storage blocked'); };
  const game = start(31, { getItem: fail, setItem: fail, removeItem: fail }, true);
  assert.equal(saveCheckpoint(game), false);
  play(game, precision, 36);
  assert.ok(game.time >= 35 && game.kills > 0);
  assert.equal(game.run, 1);
});

test('an unattended run eventually ends; restarting preserves its record and clears run resources', () => {
  const storage = new MemoryStorage();
  const game = start(9, storage);
  play(game, null, 1000);
  assert.equal(game.status, 'over');
  assert.equal(game.hp, 0);
  assert.ok(game.kills > 0);
  assert.ok(game.time > 50, 'Opening should leave time to understand the shop.');
  const lifetime = game.progress.totalKills, run = game.run, time = game.time;
  game.update(5);
  assert.equal(game.time, time);
  assert.equal(game.buy('damage'), false);
  saveCheckpoint(game);
  assert.equal(storage.getItem(CHECKPOINT_KEY), null);
  game.restart();
  assert.equal(game.status, 'running');
  assert.equal(game.time, 0);
  assert.equal(game.bossKills, 0);
  assert.equal(game.kills, 0);
  assert.equal(game.hp, game.maxHp);
  assert.equal(game.progress.totalKills, lifetime);
  assert.ok(game.best >= Math.floor(time));
  assert.equal(game.run, run + 1);
  assert.ok(Object.values(game.powers).every(stacks => !stacks));
});

// These small encounters isolate interactions that can occur in a long run but
// are unreliable to hit by chance, such as killing a boss on the draft tick.
test('one kill on the draft boundary preserves both distinct rewards across a reload', () => {
  const storage = new MemoryStorage();
  const game = start(109, storage);
  play(game, precision, 119.99);
  const boss = game.spawn('sovereign', 9, 0);
  boss.hp = 1;
  game.gunClock = 0;
  assert.ok(game.focus(boss.id));
  game.update(1);
  assert.equal(game.bossKills, 1);
  assert.equal(game.draftReason, 'time');
  takeRelic(game, []);
  assert.equal(game.draftReason, 'boss');
  assert.equal(saveCheckpoint(game), true);
  const restored = start(5, storage, true);
  assert.deepEqual(restored.choices, game.choices);
  const second = takeRelic(restored, []);
  assert.equal(restored.pickPower(second), false);
  assert.equal(restored.status, 'running');
  assert.equal(restored.time, 120);
  assert.equal(restored.bossKills, 1);
  assert.equal(Object.values(restored.powers).reduce((sum, count) => sum + count, 0), 2);
});

test('splitters leave live offspring; shields and healing change the damage needed', () => {
  const game = start(293);
  game.enemies = [];
  game.spawnClock = 60;
  const parent = game.spawn('splitter', 20, 0);
  parent.hp = 1;
  game.inspect(parent.id);
  game.focus(parent.id);
  game.update(0.05);
  assert.equal(game.kills, 1);
  assert.equal(game.enemies.filter(enemy => enemy.type === 'crawler' && enemy.mini).length, 2);
  assert.equal(game.selected, 'tower');
  assert.equal(game.focusId, null);

  game.enemies = [];
  const aegis = game.spawn('aegis', 24, 0);
  game.gunClock = 0;
  game.update(0.05);
  assert.ok(aegis.shield < aegis.maxShield);
  assert.equal(aegis.hp, aegis.maxHp);
  const hitShield = aegis.shield;
  game.gunClock = 60;
  const cantor = game.spawn('cantor', 78, 0);
  const wounded = game.spawn('brute', 76, 0);
  wounded.hp = 2;
  game.update(8);
  assert.ok(wounded.hp > 2 && wounded.hp <= wounded.maxHp);
  assert.ok(aegis.shield > hitShield);
  assert.ok(game.enemies.includes(cantor));
});

test('a sovereign reaching the spire affects integrity and pays no kill or rare draft', () => {
  const game = start(79);
  game.enemies = [];
  const boss = game.spawn('sovereign', 2, 0);
  game.focus(boss.id);
  const scrap = game.scrap;
  game.update(0.05);
  assert.ok(game.hp < game.maxHp);
  assert.equal(game.bossKills, 0);
  assert.equal(game.kills, 0);
  assert.equal(game.scrap, scrap);
  assert.equal(game.status, 'running');
  assert.equal(game.focusId, null);
});

// Isolate relic + shop combinations in identical encounters, keeping one
// prerequisite absent in each control. The assertions observe actual combat.
function synergyEncounter(relic, upgrade, hasRelic, level) {
  const game = start(1013);
  game.enemies = [];
  game.levels[upgrade] = level;
  if (hasRelic) game.powers[relic] = 1;
  return game;
}

const synergyCases = [
  { hasRelic: false, level: 2, active: false },
  { hasRelic: true, level: 1, active: false },
  { hasRelic: true, level: 2, active: true }
];

test('Rimewire adds one damaging chain hop only with Cold snap and Arc chain II', () => {
  for (const { hasRelic, level, active } of synergyCases) {
    const game = synergyEncounter('frost', 'chain', hasRelic, level);
    assert.equal(game.synergyActive('rimewire'), active);
    const enemies = [10, 25, 40, 55].map(x => game.spawn('brute', x, 0));
    game.update(0.05);
    assert.equal(enemies.filter(enemy => enemy.hp < enemy.maxHp).length, 1 + level + Number(active));
    assert.equal(game.shots.filter(shot => shot.kind === 'chain').length, level + Number(active));
    assert.equal(enemies[3].hp < enemies[3].maxHp, active);
  }
});

test('Wildfire lets splash damage burn secondary targets only with Cinder rounds and Splash II', () => {
  for (const { hasRelic, level, active } of synergyCases) {
    const game = synergyEncounter('ember', 'splash', hasRelic, level);
    assert.equal(game.synergyActive('wildfire'), active);
    const primary = game.spawn('brute', 15, 0);
    const nearby = game.spawn('brute', 18, 0);
    const outside = game.spawn('brute', 45, 0);
    game.update(0.05);
    assert.ok(nearby.hp < nearby.maxHp, 'The secondary target must take the initial splash.');
    const primaryAfterShot = primary.hp, nearbyAfterShot = nearby.hp;
    game.update(0.5);
    assert.equal(primary.hp < primaryAfterShot, hasRelic);
    assert.equal(nearby.hp < nearbyAfterShot, active);
    assert.equal(outside.hp, outside.maxHp);
  }
});

test('Field medic heals on every third kill only with Siphon core and Repair II', () => {
  for (const { hasRelic, level, active } of synergyCases) {
    const game = synergyEncounter('repair', 'regen', hasRelic, level);
    assert.equal(game.synergyActive('fieldmedic'), active);
    game.hp = 50;
    // Resolve real kills without advancing time, so passive regeneration cannot
    // conceal healing on the wrong kill or a duplicated boundary payment.
    for (let kills = 1; kills <= 7; kills++) {
      const enemy = game.spawn('moth', 20, 0);
      game.fire(enemy);
      game.resolveContacts();
      assert.equal(game.kills, kills);
      const healed = hasRelic ? Math.floor(kills / (active ? 3 : 5)) : 0;
      assert.equal(game.hp, 50 + healed);
    }
  }
});

for (const build of [precision, ordnance]) {
  test(build.name + ' can defeat two sovereigns during continuous combat from a fresh profile', t => {
    const seeds = [29, 97, 313];
    let victors = 0;
    const types = new Set(), tiers = new Set(), confirmedBossDrafts = [];
    for (const seed of seeds) {
      const game = start(seed);
      game.openStarter();
      takeRelic(game, build.relics);
      let bosses = 0;
      play(game, build, 405, () => {
        for (const enemy of game.enemies) {
          types.add(enemy.type);
          tiers.add(enemy.tier);
        }
        if (game.bossKills > bosses) {
          assert.equal(game.status, 'draft');
          assert.equal(game.draftReason, 'boss');
          assert.ok(game.choices.some(id => ['twinshot','ward','repulse'].includes(id)));
          confirmedBossDrafts.push(game.time);
          bosses = game.bossKills;
        }
      });
      if (bosses >= 2) victors++;
      t.diagnostic('Seed ' + seed + ': ' + Math.floor(game.time) + 's, ' +
        game.kills + ' kills, ' + bosses + ' bosses, ' + Math.ceil(game.hp) + ' integrity.');
    }
    // Allow a hard seed while guarding against configurations with only one viable build.
    assert.ok(victors >= 2, build.name + ' reached the target in ' + victors + ' of 3 runs.');
    assert.deepEqual([...tiers].sort(), [1, 2, 3, 4]);
    assert.deepEqual([...types].sort(), Object.keys(ENEMIES).sort());
    assert.ok(confirmedBossDrafts.length >= victors * 2);
  });
}
