import assert from 'node:assert/strict';
import test from 'node:test';
import { saveCheckpoint } from '../checkpoint.js';
import { WEAPONS, TRAITS, MODS, MAX_GRADE, mountStats, earnHardpoint } from '../weapons.js';
import { openCache, pickBlueprint, closeCache, foundry, forgeWeapon, workshopCosts, fitChoices } from '../workshop.js';
import { CHECKPOINT_KEY, MemoryStorage, start } from './support/gameplay.mjs';

const mount = (key, extra = {}) => ({ key, grade: 1, trait: null, cooldown: 0, ...extra });

function openArmsCache(game) {
  game.bossKills = 1;
  assert.equal(earnHardpoint(game), true);
  game.workshop.caches++;
  game.workshop.armsCaches++;
  assert.equal(openCache(game), true);
  assert.equal(game.status, 'cache');
  return game.workshop.offer;
}

test('each run starts with one random, untraited weapon and no free choice', () => {
  const starts = new Set();
  for (let seed = 1; seed <= 40; seed++) {
    const game = start(seed * 97);
    assert.equal(game.armory.slots, 1);
    assert.equal(game.armory.mounts.length, 1);
    const [primary] = game.armory.mounts;
    assert.ok(Object.hasOwn(WEAPONS, primary.key));
    assert.equal(primary.grade, 1);
    assert.equal(primary.trait, null);
    starts.add(primary.key);
  }
  assert.ok(starts.size >= 3, 'Starting weapons should vary between runs');
});

test('hardpoints cannot be bought and open at the first and third sovereign', () => {
  const storage = new MemoryStorage();
  const game = start(91, storage);
  game.scrap = 1e6;
  assert.equal(foundry(game, 'hardpoint'), false);
  assert.equal(earnHardpoint(game), false);
  const offer = openArmsCache(game);
  assert.equal(game.armory.slots, 2);
  assert.equal(offer.length, 3);
  assert.equal(new Set(offer.map(item => item.weapon)).size, 3);
  for (const item of offer) {
    assert.ok(Object.hasOwn(WEAPONS, item.weapon));
    assert.ok(item.grade >= 1 && item.grade <= 3);
    assert.ok(Object.hasOwn(TRAITS, item.trait));
  }
  assert.equal(saveCheckpoint(game), true);
  assert.deepEqual(start(7, storage, true).workshop.offer, offer);
  const fresh = offer.find(item => !game.armory.mounts.some(m => m.key === item.weapon));
  assert.equal(pickBlueprint(game, fresh.key), true);
  assert.equal(game.status, 'running');
  assert.equal(game.armory.mounts.length, 2);
  assert.deepEqual(game.armory.mounts[1], mount(fresh.weapon, { grade: fresh.grade, trait: fresh.trait, rolls: fresh.rolls, mods: fresh.mods }));
  game.bossKills = 2;
  assert.equal(earnHardpoint(game), false);
  game.bossKills = 3;
  assert.equal(earnHardpoint(game), true);
  assert.equal(game.armory.slots, 3);
  assert.equal(earnHardpoint(game), false);
});

test('the forge spends rising scrap to raise a weapon up to the top grade', () => {
  const game = start(92);
  game.scrap = 1e6;
  const prices = [];
  while (Number.isFinite(workshopCosts(game).forge[0])) {
    prices.push(workshopCosts(game).forge[0]);
    assert.equal(forgeWeapon(game, 0), true);
  }
  assert.equal(game.armory.mounts[0].grade, MAX_GRADE);
  assert.equal(prices.length, MAX_GRADE - 1);
  assert.ok(prices.every((price, i) => !i || price > prices[i - 1]));
  assert.equal(forgeWeapon(game, 0), false);
  assert.ok(mountStats(mount('bolt', { grade: 5 })).scale > mountStats(mount('bolt', { grade: 3 })).scale);
});

test('a duplicate find reinforces the held weapon, a maxed one is tempered, then reclaimed', () => {
  const game = start(55);
  const key = game.armory.mounts[0].key;
  const rolls = { ...game.armory.mounts[0].rolls };
  game.workshop.caches = 1;
  game.workshop.offer = [{ key: 'arm:' + key, weapon: key, grade: 1, trait: 'rapid' }, { key: 'scrap', grade: 1, levels: 1 }, { key: 'prospect', grade: 1, levels: 1 }];
  assert.equal(openCache(game), true);
  assert.equal(pickBlueprint(game, 'arm:' + key), true);
  assert.deepEqual(game.armory.mounts[0], mount(key, { grade: 2, trait: 'rapid', rolls, mods: [] }));
  game.armory.mounts[0].grade = MAX_GRADE;
  game.armory.mounts[0].rolls = { power: 20, cadence: 20, reach: 10 };
  const dupe = () => {
    game.workshop.caches = 1;
    game.workshop.offer = [{ key: 'arm:' + key, weapon: key, grade: 2, trait: 'long' }, { key: 'scrap', grade: 1, levels: 1 }, { key: 'prospect', grade: 1, levels: 1 }];
    assert.equal(openCache(game), true);
    assert.equal(pickBlueprint(game, 'arm:' + key), true);
  };
  const scrap = game.scrap;
  dupe();
  assert.deepEqual(game.armory.mounts[0].rolls, { power: 20, cadence: 20, reach: 15 });
  dupe();
  assert.equal(game.armory.mounts[0].rolls.reach, 20);
  assert.equal(game.scrap, scrap);
  dupe();
  assert.ok(game.scrap > scrap);
  assert.equal(game.armory.mounts[0].trait, 'rapid');
});

test('weapons roll their own stats and gain a random mod at grades 3, 6 and 9', () => {
  const game = start(77);
  game.scrap = 1e7;
  const [primary] = game.armory.mounts;
  for (const value of Object.values(primary.rolls)) assert.ok(value >= -8 && value <= 12);
  const base = mountStats(mount(primary.key));
  const rolled = mountStats({ ...primary, mods: [] });
  assert.ok(Math.abs(rolled.scale / base.scale - (1 + primary.rolls.power / 100)) < 1e-9);
  while (forgeWeapon(game, 0)) { /* forge to the top */ }
  assert.equal(primary.grade, MAX_GRADE);
  assert.equal(primary.mods.length, 3);
  assert.equal(new Set(primary.mods).size, 3);
  for (const key of primary.mods) assert.ok(Object.hasOwn(MODS, key));
  assert.equal(saveCheckpoint(game), true);
});

test('a find with full hardpoints asks which weapon to replace and keeps its reload', () => {
  const storage = new MemoryStorage();
  const game = start(300, storage);
  const held = game.armory.mounts[0].key;
  const other = Object.keys(WEAPONS).find(key => key !== held);
  game.armory.mounts[0].cooldown = 0.7;
  game.workshop.caches = 1;
  game.workshop.offer = [{ key: 'arm:' + other, weapon: other, grade: 2, trait: 'heavy' }, { key: 'scrap', grade: 1, levels: 1 }, { key: 'prospect', grade: 1, levels: 1 }];
  assert.equal(openCache(game), true);
  assert.equal(pickBlueprint(game, 'arm:' + other), true);
  assert.equal(game.status, 'cache');
  assert.deepEqual(fitChoices(game).map(choice => choice.key), ['fit:0', 'fit:scrap']);
  assert.equal(saveCheckpoint(game), true);
  assert.deepEqual(start(3, storage, true).workshop.pending, game.workshop.pending);
  assert.equal(closeCache(game), true);
  assert.equal(game.status, 'running');
  game.workshop.pending = null;
  assert.equal(openCache(game), true);
  assert.equal(pickBlueprint(game, 'arm:' + other), true);
  assert.equal(pickBlueprint(game, 'fit:0'), true);
  assert.equal(game.status, 'running');
  assert.equal(game.workshop.caches, 0);
  assert.deepEqual(game.armory.mounts, [mount(other, { grade: 2, trait: 'heavy', cooldown: 0.7 })]);

});

test('grades and traits change the stats a mount fires with', () => {
  const base = mountStats(mount('bolt'));
  assert.ok(mountStats(mount('bolt', { grade: 3 })).scale > mountStats(mount('bolt', { grade: 2 })).scale);
  assert.ok(mountStats(mount('bolt', { grade: 2 })).scale > base.scale);
  assert.ok(mountStats(mount('bolt', { trait: 'rapid' })).cadence > base.cadence);
  assert.ok(mountStats(mount('bolt', { trait: 'long' })).reach > base.reach);
  const heavy = mountStats(mount('bolt', { trait: 'heavy' }));
  assert.ok(heavy.scale > base.scale && heavy.cadence < base.cadence);
  assert.equal(mountStats(mount('bolt', { trait: 'forked' })).chains, base.chains + 1);

  const game = start(77);
  game.armory.mounts = [mount('bolt', { trait: 'searing' })];
  game.enemies = [];
  const target = game.spawn('brute', 20, 0);
  target.maxHp = target.hp = 1000;
  game.update(1 / 60);
  const afterShot = target.hp;
  assert.ok(target.burnUntil > game.time);
  game.armory.mounts[0].cooldown = 60;
  game.update(0.5);
  assert.ok(target.hp < afterShot, 'A searing hit keeps burning');
});

test('a sovereign drops an arms cache and opens the second hardpoint', () => {
  const game = start(12);
  game.enemies = [];
  game.workshop.dryKills = 0;
  const boss = game.spawn('sovereign', 9, 0);
  boss.hp = 1;
  game.armory.mounts[0] = mount('bolt');
  game.focus(boss.id);
  game.update(0.05);
  assert.ok(game.workshop.caches >= 1);
  if (game.status === 'draft') game.pickPower(game.choices[0]);
  if (game.status === 'draft') game.pickPower(game.choices[0]);
  assert.equal(openCache(game), true);
  assert.equal(game.armory.slots, 2);
  assert.equal(game.workshop.offer.filter(item => item.weapon).length, 3);
});

test('weapon trajectories send the expected number of hits to distinct in-range enemies', () => {
  const geometry = {
    scatter: [[10,0], [17,4], [19,-5], [14,18], [70,0]],
    lance: [[10,0], [21,1], [39,-1], [20,10], [-15,0]],
    coil: [[8,0], [22,0], [35,0], [91,0], [-85,0]]
  };
  for (const [key, positions] of Object.entries(geometry)) {
    const game = start(9983);
    game.armory.mounts = [mount(key)];
    game.enemies = [];
    const enemies = positions.map(([x, y]) => game.spawn('brute', x, y));
    game.focus(enemies[0].id);
    game.update(0.05);
    assert.deepEqual(enemies.map(enemy => enemy.hp < enemy.maxHp), [true,true,true,false,false], key);
    assert.equal(game.shots.length, 3);
    assert.equal(new Set(game.shots.map(shot => [shot.x,shot.y].join(','))).size, 3);
  }
});

test('the same bolt loses output on auxiliary mounts without sharing another mount cooldown', () => {
  const damage = [];
  for (const slot of [0, 1, 2]) {
    const game = start(709);
    const loadout = ['coil', 'lance', 'scatter'];
    loadout[slot] = 'bolt';
    game.armory = { slots: 3, mounts: loadout.map((key, index) => mount(key, { cooldown: index === slot ? 0 : 5 })) };
    game.enemies = [];
    const target = game.spawn('brute', 20, 0);
    game.update(1 / 60);
    assert.equal(game.shots.length, 1);
    damage.push(target.maxHp - target.hp);
  }
  assert.ok(damage[0] > damage[1] && damage[1] > damage[2] && damage[2] > 0);
});

test('a version 3 save keeps its fitted weapons as untraited standard finds', () => {
  const storage = new MemoryStorage();
  const game = start(43, storage);
  assert.equal(saveCheckpoint(game), true);
  const saved = JSON.parse(storage.getItem(CHECKPOINT_KEY));
  const { armsCaches, weaponDue, pending, ...workshop } = saved.state.workshop;
  saved.state.workshop = workshop;
  saved.state.armory = { mounts: [{ key: 'lance', cooldown: 0.25 }, { key: 'bolt', cooldown: 0 }], refits: 1 };
  storage.setItem(CHECKPOINT_KEY, JSON.stringify(saved));
  const restored = start(5, storage, true);
  assert.deepEqual(restored.armory, { slots: 2, mounts: [mount('lance', { cooldown: 0.25 }), mount('bolt')] });
  assert.equal(restored.workshop.armsCaches, 0);
});
