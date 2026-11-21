import assert from 'node:assert/strict';
import test from 'node:test';
import { UPGRADES } from '../content.js';
import { saveCheckpoint } from '../checkpoint.js';
import { openCache, closeCache, pickBlueprint, rerollCache, foundry, workshopCosts } from '../workshop.js';
import { CHECKPOINT_KEY, RECORDS_KEY, MemoryStorage, start, snapshotCombat } from './support/gameplay.mjs';

// This state has only fields emitted by the shipped v2 checkpoint writer.
function legacyCheckpoint(status) {
  const pending = status === 'draft';
  return { version: 2, state: {
    run: 1, best: 0, time: 837, hp: 100, maxHp: 100, scrap: 17000, kills: 3600, bossKills: 4,
    threat: 19, status, selected: 'e1', focusId: 'e1',
    levels: { range: 10, rate: 10, damage: 10, splash: 10, crit: 8, chain: 5, armor: 8, regen: 6, bounty: 5 },
    bonus: { damage: 0, range: 0, rate: 0 }, powers: { frost: 1, headhunter: 1, overclock: 2, scope: 1 },
    doctrine: 'sentinel', choices: pending ? ['ward','twinshot','repulse'] : [],
    draftReason: pending ? 'boss' : null, nextDraft: 840, nextBoss: 880, warning: null, queue: [],
    enemies: [{ id: 'e1', type: 'crawler', x: -79.52, y: -39.52, hp: 7, maxHp: 7, speed: 2.244,
      damage: 8, reward: 3, tier: 1, boss: false, elite: false, mini: false, shield: 0, maxShield: 0,
      lastHit: -1000, slowUntil: 0, burnUntil: 0, burnDps: 0, pulseAt: 5, phaseOffset: 2.59 }],
    shots: [], effects: [], log: [{ time: 833, text: 'Spire core online.', type: 'system' }],
    nextId: 8, gunClock: 0.65, spawnClock: 1.9, pulseAt: 0, wardAt: 0, starterReady: false, relics: []
  }};
}

test('v2 active, paused and pending-draft saves keep maxed ranks and 17,000 scrap in the new foundry', () => {
  for (const status of ['running','paused','draft']) {
    const storage = new MemoryStorage();
    const old = legacyCheckpoint(status);
    const records = JSON.stringify({ runs: 1, best: 837, totalKills: 3600, credits: { 1: 3600 } });
    storage.setItem(RECORDS_KEY, records);
    storage.setItem('last-spire.checkpoint.v2', JSON.stringify(old));
    const game = start(77, storage, true);
    for (const key of ['run','time','hp','scrap','status','kills','bossKills','selected','focusId','choices','levels','powers']) {
      assert.deepEqual(game[key], old.state[key], 'v2 field ' + key);
    }
    assert.equal(storage.getItem(RECORDS_KEY), records);
    assert.equal(storage.getItem('last-spire.checkpoint.v2'), null);
    assert.ok(storage.getItem(CHECKPOINT_KEY));
    assert.equal(game.armory.mounts[0].key, 'bolt');
    assert.equal(game.armory.mounts[0].cooldown, old.state.gunClock);
    if (status === 'draft') {
      assert.equal(game.pickPower('ward'), true);
      assert.equal(game.pickPower('ward'), false);
    } else if (status === 'paused') game.togglePause();
    const before = game.damage;
    assert.equal(foundry(game, 'tune'), true);
    assert.ok(game.damage > before && game.scrap < 17000);
    assert.equal(saveCheckpoint(game), true);
    assert.deepEqual(snapshotCombat(start(91, storage, true)), snapshotCombat(game));
  }
});

test('schematics install only earned choices, persist across shelving, and cannot be claimed twice', () => {
  const storage = new MemoryStorage();
  const game = start(37, storage);
  const initialRanks = { ...game.levels };
  const scrap = game.scrap, caches = game.workshop.caches;
  assert.ok(caches >= 1);
  assert.equal(game.buy('range'), false);
  assert.equal(openCache(game), true);
  const choices = structuredClone(game.workshop.offer);
  assert.equal(choices.length, 3);
  assert.equal(new Set(choices.map(card => card.key)).size, 3);
  assert.equal(game.status, 'cache');
  game.update(5);
  assert.equal(game.time, 0);
  const missing = Object.keys(UPGRADES).find(key => !choices.some(card => card.key === key));
  assert.equal(pickBlueprint(game, missing), false);
  assert.deepEqual(game.levels, initialRanks);
  assert.equal(closeCache(game), true);
  assert.equal(game.status, 'running');
  assert.equal(saveCheckpoint(game), true);
  const reloaded = start(711, storage, true);
  assert.equal(openCache(reloaded), true);
  assert.deepEqual(reloaded.workshop.offer, choices);
  assert.equal(saveCheckpoint(reloaded), true);
  const waiting = start(131, storage, true);
  assert.equal(waiting.status, 'cache');
  assert.deepEqual(waiting.workshop.offer, choices);
  const first = choices[0];
  assert.equal(pickBlueprint(waiting, first.key), true);
  assert.equal(waiting.levels[first.key], Math.min(UPGRADES[first.key].maxLevel, initialRanks[first.key] + first.levels));
  assert.equal(waiting.scrap, scrap);
  assert.equal(waiting.workshop.caches, caches - 1);
  assert.equal(pickBlueprint(waiting, first.key), false);
  assert.equal(saveCheckpoint(waiting), true);
  const paid = start(511, storage, true);
  assert.deepEqual(paid.levels, waiting.levels);
  assert.equal(paid.workshop.caches, waiting.workshop.caches);
  assert.equal(pickBlueprint(paid, first.key), false);
});

test('destroyed hostiles award early, continuing and boss salvage; a core impact awards nothing', () => {
  const game = start(913);
  game.enemies = [];
  const opening = game.workshop.caches;
  const escaped = game.spawn('brute', 1, 0);
  game.resolveContacts();
  assert.equal(game.kills, 0);
  assert.equal(game.workshop.caches, opening);
  assert.ok(!game.enemies.includes(escaped));
  const cacheTicks = [];
  let prior = opening;
  for (let i = 1; i <= 110; i++) {
    const creep = game.spawn('crawler', 20, 0);
    creep.hp = 0;
    game.resolveContacts();
    game.time += 2;
    if (game.workshop.caches > prior) cacheTicks.push(i);
    prior = game.workshop.caches;
  }
  assert.ok(cacheTicks.length >= 3);
  assert.ok(cacheTicks[0] <= 12, 'The first enemy drop must arrive early.');
  const boss = game.spawn('sovereign', 30, 0);
  boss.hp = 0;
  game.resolveContacts();
  assert.equal(game.workshop.caches, prior + 1);
  assert.equal(game.bossKills, 1);
});

test('a capped tower turns banked and future dropped caches into spendable scrap once', () => {
  const game = start(801);
  for (const [key, row] of Object.entries(UPGRADES)) game.levels[key] = row.maxLevel;
  const scrap = game.scrap;
  assert.equal(openCache(game), true);
  assert.equal(game.status, 'running');
  assert.equal(game.workshop.caches, 0);
  assert.ok(game.scrap > scrap);
  const cashed = game.scrap;
  assert.equal(openCache(game), false);
  assert.equal(game.scrap, cashed);
  game.enemies = [];
  const boss = game.spawn('sovereign', 20, 0);
  boss.hp = 0;
  game.resolveContacts();
  assert.equal(game.workshop.caches, 0);
  assert.ok(game.scrap - cashed > boss.reward, 'Award both bounty and cache salvage');
  const paid = game.scrap;
  game.resolveContacts();
  assert.equal(game.scrap, paid);
});

test('rerolls cost scrap, change the current selection and keep the cache banked', () => {
  const game = start(71);
  assert.equal(openCache(game), true);
  const offer = structuredClone(game.workshop.offer), bank = game.workshop.caches;
  const cost = workshopCosts(game).reroll;
  assert.ok(Number.isFinite(cost) && cost > 0);
  game.scrap = cost - 1;
  assert.equal(rerollCache(game), false);
  assert.deepEqual(game.workshop.offer, offer);
  game.scrap = cost;
  assert.equal(rerollCache(game), true);
  assert.notDeepEqual(game.workshop.offer.map(card => card.key).sort(), offer.map(card => card.key).sort());
  assert.equal(game.workshop.caches, bank);
  assert.equal(game.scrap, 0);
  assert.equal(game.status, 'cache');
});

test('when one schematic rank remains its offer still has three usable, distinct outcomes', () => {
  const game = start(97);
  for (const [key, row] of Object.entries(UPGRADES)) game.levels[key] = row.maxLevel;
  game.levels.damage--;
  const bank = game.workshop.caches;
  assert.equal(openCache(game), true);
  assert.deepEqual(game.workshop.offer.map(card => card.key).sort(), ['damage', 'prospect', 'scrap']);
  assert.equal(rerollCache(game), false);
  assert.equal(pickBlueprint(game, 'damage'), true);
  assert.equal(game.levels.damage, UPGRADES.damage.maxLevel);
  assert.equal(game.workshop.caches, bank - 1);
  assert.equal(game.status, 'running');
});

test('the foundry spends scrap on repair, additional schematics, and lasting tuning beyond rank caps', () => {
  const game = start(211);
  game.scrap = 17000;
  const balance = game.scrap;
  assert.equal(foundry(game, 'repair'), false);
  assert.equal(game.scrap, balance);
  game.hp = Math.ceil(game.maxHp / 2);
  const wounded = game.hp;
  const repairCost = workshopCosts(game).repair;
  assert.equal(foundry(game, 'repair'), true);
  assert.ok(game.hp > wounded && game.hp <= game.maxHp);
  assert.equal(game.scrap, balance - repairCost);
  const bank = game.workshop.caches;
  const price = workshopCosts(game).commission;
  const bankBalance = game.scrap;
  assert.equal(foundry(game, 'commission'), true);
  assert.equal(game.workshop.caches, bank + 1);
  assert.equal(game.scrap, bankBalance - price);
  for (const [key, row] of Object.entries(UPGRADES)) game.levels[key] = row.maxLevel;
  let paid = 0;
  const afterUpgrade = game.scrap, damage = game.damage, rate = game.rate;
  for (let step = 0; step < 4; step++) {
    const cost = workshopCosts(game).tune;
    assert.ok(Number.isFinite(cost) && cost > 0);
    assert.equal(foundry(game, 'tune'), true);
    paid += cost;
  }
  assert.ok(game.damage > damage && game.rate > rate);
  assert.equal(afterUpgrade - game.scrap, paid);
  assert.ok(paid > 0);
});
