// Run the complete suite with node --test tests/*.mjs
import assert from 'node:assert/strict';
import test from 'node:test';
import { ENEMIES, POWERS, UPGRADES } from '../content.js';
import { saveCheckpoint, clearCheckpoint } from '../checkpoint.js';
import {
  CHECKPOINT_KEY, RECORDS_KEY, MemoryStorage, start, precision, ordnance,
  play, takeRelic, snapshotCombat
} from './support/gameplay.mjs';

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

test('the relic deck presents varied families, avoids recent alternatives, and keeps rares for boss rewards', () => {
  const rarities = Object.values(POWERS).filter(power => !power.reserve).map(power => power.rarity);
  assert.ok(rarities.filter(r => r === 'common').length >= 15);
  assert.ok(rarities.filter(r => r === 'uncommon').length >= 8);
  assert.ok(rarities.filter(r => r === 'rare').length >= 6);
  const game = start(211);
  const seen = new Set();
  const history = [];
  const reasons = ['starter','time','time','time','boss','boss'];
  for (const reason of reasons) {
    game.openDraft(reason);
    const offered = [...game.choices];
    assert.equal(new Set(offered).size, 3);
    assert.ok(new Set(offered.map(key => POWERS[key].family)).size >= 2);
    assert.ok(offered.every(key => reason === 'boss' ? POWERS[key].rarity === 'rare' : POWERS[key].rarity !== 'rare'));
    if (history.length) assert.ok(offered.every(key => !history.at(-1).includes(key)), 'Immediate repeated offer');
    for (const key of offered) seen.add(key);
    history.push(offered);
    takeRelic(game, []);
  }
  assert.ok(seen.size >= 15);
  assert.ok(game.draftHistory.length >= 3);
});

test('combat history retains the latest 100 entries in reverse chronological order across reloads', () => {
  const storage = new MemoryStorage();
  const game = start(37, storage);
  for (let i = 0; i < 125; i++) {
    game.time = i / 2;
    game.note('Contact ' + i, 'contact');
  }
  assert.equal(game.log.length, 100);
  assert.equal(game.log[0].text, 'Contact 124');
  assert.equal(game.log.at(-1).text, 'Contact 25');
  for (let i = 1; i < game.log.length; i++) assert.ok(game.log[i].time <= game.log[i - 1].time);
  assert.equal(saveCheckpoint(game), true);
  assert.deepEqual(start(83, storage, true).log, game.log);
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
  game.armory.mounts[0].cooldown = 0;
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
  game.armory.mounts[0].cooldown = 0;
  game.update(0.05);
  assert.ok(aegis.shield < aegis.maxShield);
  assert.equal(aegis.hp, aegis.maxHp);
  const hitShield = aegis.shield;
  game.armory.mounts[0].cooldown = 60;
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
      play(game, build, 450, () => {
        for (const enemy of game.enemies) {
          types.add(enemy.type);
          tiers.add(enemy.tier);
        }
        if (game.bossKills > bosses) {
          assert.equal(game.status, 'draft');
          assert.equal(game.draftReason, 'boss');
          assert.ok(game.choices.some(id => POWERS[id].rarity === 'rare'));
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


test('one veteran purchase policy still produces different builds after eight minutes', t => {
  const seeds = [29, 97, 313, 1381, 1877, 2927, 3833, 4451];
  const builds = new Set(), profiles = new Set(), openers = new Set(), ranks = [];
  for (const seed of seeds) {
    const storage = new MemoryStorage();
    storage.setItem(RECORDS_KEY, JSON.stringify({ runs: 20, totalKills: 1300, best: 850 }));
    const game = start(seed, storage);
    game.openStarter();
    openers.add([...game.choices].sort().join('/'));
    takeRelic(game, precision.relics);
    play(game, precision, 480);
    profiles.add(game.profile);
    if (game.time >= 480 - 1e-7) {
      builds.add(Object.values(game.levels).join('/'));
      ranks.push(Object.values(game.levels).reduce((total, level) => total + level, 0));
    }
  }
  t.diagnostic(ranks.length + '/' + seeds.length + ' reached 08:00 with ' + builds.size +
    ' rank distributions, ' + profiles.size + ' encounter profiles and ' + openers.size + ' opening offers.');
  assert.ok(ranks.length >= 4, 'Veteran builds can reach eight minutes.');
  assert.ok(builds.size >= 4 && profiles.size >= 3 && openers.size >= 4);
  const maxRanks = Object.values(UPGRADES).reduce((sum, row) => sum + row.maxLevel, 0);
  assert.ok(ranks.filter(total => total < maxRanks).length >= 4);
});
