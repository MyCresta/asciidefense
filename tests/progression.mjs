import assert from 'node:assert/strict';
import test from 'node:test';
import { POWERS, UPGRADES, SYNERGIES } from '../content.js';
import { CURSES, applyCurse } from '../hazards.js';
import { saveCheckpoint } from '../checkpoint.js';
import { foundry, workshopCosts, smallCache } from '../workshop.js';
import { WEAPON_COMBOS, TRAITS, MODS, mountStats } from '../weapons.js';
import { MemoryStorage, start, snapshotCombat } from './support/gameplay.mjs';

function quiet(seed = 31, storage) {
  const game = start(seed, storage);
  game.enemies = [];
  game.spawnClock = 1e6;
  game.nextDraft = game.nextBoss = 1e6;
  return game;
}

test('each run deals a different relic deck from part of the pool', () => {
  const decks = new Set();
  for (let seed = 1; seed <= 6; seed++) {
    const game = start(seed * 31);
    const regular = Object.keys(POWERS).filter(key => !POWERS[key].reserve);
    const dealt = game.deck.filter(key => !POWERS[key].reserve);
    assert.ok(dealt.length < regular.length * .7 && dealt.length > regular.length * .4);
    for (let i = 0; i < 6; i++) {
      game.openDraft(i % 3 ? 'time' : 'boss');
      for (const key of game.choices) assert.ok(game.deck.includes(key), key + ' is outside the deck');
      game.pickPower(game.choices[0]);
    }
    decks.add(dealt.sort().join());
  }
  assert.equal(decks.size, 6);
});

test('owned relics with a second rank come back as an upgrade', () => {
  const game = quiet(5);
  const ranked = Object.keys(POWERS).filter(key => POWERS[key].next);
  assert.ok(ranked.length >= 12);
  for (const key of ranked) {
    assert.equal(POWERS[key].maxStacks, 2);
    game.powers[key] = 1;
  }
  const offered = new Set();
  for (let i = 0; i < 30; i++) {
    game.openDraft('time');
    for (const key of game.choices) if (ranked.includes(key)) offered.add(key);
    game.status = 'running'; game.choices = [];
  }
  assert.ok(offered.size > 0);
});

test('upgrades go past their old caps for half value, and advanced upgrades join after four minutes', () => {
  const game = quiet(8);
  game.levels.damage = UPGRADES.damage.soft;
  const atSoft = game.damage;
  game.levels.damage = UPGRADES.damage.soft + 2;
  const step = game.damage - atSoft;
  game.levels.damage = UPGRADES.damage.soft - 2;
  assert.ok(Math.abs(step * 2 - (atSoft - game.damage)) < 1e-9);
  for (const key of Object.keys(UPGRADES)) game.levels[key] = UPGRADES[key].after ? 0 : UPGRADES[key].maxLevel - 1;
  game.time = 10;
  for (let i = 0; i < 20; i++) smallCache(game);
  for (const key of Object.keys(UPGRADES)) if (UPGRADES[key].after) assert.equal(game.levels[key], 0, key);
  game.time = 300;
  for (let i = 0; i < 40; i++) smallCache(game);
  assert.ok(Object.keys(UPGRADES).some(key => UPGRADES[key].after && game.levels[key] > 0));
});

test('the barrier absorbs impacts and recharges after a quiet spell', () => {
  const game = quiet(9);
  game.levels.barrier = 3;
  for (let i = 0; i < 600; i++) game.update(1 / 60);
  assert.ok(Math.abs(game.barrier - 18) < 1e-6);
  const hp = game.hp;
  game.impact({ damage: 10, type: 'crawler' });
  assert.equal(game.hp, hp);
  assert.ok(Math.abs(game.barrier - 8) < 1e-6);
  game.update(1);
  assert.ok(Math.abs(game.barrier - 8) < 1e-6);
});

test('a relic draft can be bought with scrap and rises in price', () => {
  const game = quiet(10);
  game.scrap = 1e5;
  const first = workshopCosts(game).relic;
  assert.equal(foundry(game, 'relic'), true);
  assert.equal(game.status, 'draft');
  assert.equal(game.draftReason, 'bought');
  assert.equal(game.scrap, 1e5 - first);
  const storage = game.storage;
  assert.equal(saveCheckpoint(game), true);
  assert.deepEqual(snapshotCombat(start(4, storage, true)), snapshotCombat(game));
  game.pickPower(game.choices[0]);
  assert.ok(workshopCosts(game).relic > first);
});

test('every relic, combo, curse, trait and mod runs in combat and survives a checkpoint', () => {
  const storage = new MemoryStorage();
  const game = start(12, storage);
  for (const key of Object.keys(POWERS)) if (!POWERS[key].reserve) game.powers[key] = POWERS[key].maxStacks || 1;
  for (const key of Object.keys(UPGRADES)) game.levels[key] = UPGRADES[key].maxLevel;
  for (const key of Object.keys(CURSES)) assert.equal(applyCurse(game, key), true);
  for (const key of Object.keys(SYNERGIES)) assert.ok(game.synergyActive(key), key);
  game.bossKills = 3;
  game.armory.slots = 3;
  const traits = Object.keys(TRAITS), mods = Object.keys(MODS);
  game.armory.mounts = ['bolt', 'scatter', 'coil'].map((key, i) => ({ key, grade: 10, trait: traits[i * 3 % traits.length], cooldown: 0,
    rolls: { power: 5, cadence: 5, reach: 5 }, mods: mods.slice(i * 3, i * 3 + 3) }));
  for (const trait of traits) {
    game.armory.mounts[0].trait = trait;
    assert.ok(mountStats(game.armory.mounts[0], game).scale > 0);
  }
  for (const key of Object.keys(WEAPON_COMBOS)) {
    game.armory.mounts[0].trait = WEAPON_COMBOS[key].trait;
    for (let i = 0; i < 30; i++) game.update(1 / 60);
  }
  game.nextDraft = game.nextBoss = 1e6;
  for (let i = 0; i < 60 * 40 && game.status === 'running'; i++) game.update(1 / 60);
  assert.ok(game.kills > 0);
  assert.ok(Number.isFinite(game.damage) && Number.isFinite(game.rate) && Number.isFinite(game.hp));
  if (game.status === 'running') {
    assert.equal(saveCheckpoint(game), true);
    assert.deepEqual(snapshotCombat(start(1, storage, true)), snapshotCombat(game));
  }
});
