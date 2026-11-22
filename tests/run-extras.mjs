import assert from 'node:assert/strict';
import test from 'node:test';
import { saveCheckpoint } from '../checkpoint.js';
import { BARGAINS, ELITE_TRAITS, answerBargain, bloodPrice, boonActive } from '../hazards.js';
import { availableWeapons, fireMounts } from '../weapons.js';
import { CHECKPOINT_KEY, MemoryStorage, play, start } from './support/gameplay.mjs';

const mount = (key, extra = {}) => ({ key, grade: 1, trait: null, cooldown: 0, ...extra });

function quiet(seed = 31, storage) {
  const game = start(seed, storage);
  game.enemies = [];
  game.spawnClock = 1e6;
  return game;
}

test('a bargain is offered on schedule, expires unanswered, and can be struck or declined', () => {
  const game = quiet(31);
  game.update(94.9);
  assert.equal(game.bargain, null);
  game.update(0.2);
  assert.ok(game.bargain && Object.hasOwn(BARGAINS, game.bargain.key));
  const expires = game.bargain.expires;
  game.update(expires - game.time + 0.05);
  assert.equal(game.bargain, null, 'An unanswered offer is withdrawn');

  const blood = quiet(32);
  blood.bargain = { key: 'bloodprice', expires: 999 };
  const scrap = blood.scrap, price = bloodPrice(blood);
  assert.equal(answerBargain(blood, true), true);
  assert.equal(blood.scrap, scrap + price);
  assert.ok(boonActive(blood, 'bloodprice'));
  assert.equal(blood.stats.bargains, 1);

  const market = quiet(33);
  market.scrap = 100;
  market.bargain = { key: 'blackmarket', expires: 999 };
  const caches = market.workshop.caches;
  assert.equal(answerBargain(market, true), true);
  assert.equal(market.scrap, 60);
  assert.equal(market.workshop.caches, caches + 2);
  assert.equal(market.boon, null);

  const declined = quiet(34);
  declined.bargain = { key: 'goldrush', expires: 999 };
  assert.equal(answerBargain(declined, false), true);
  assert.equal(declined.boon, null);
  assert.equal(answerBargain(declined, true), false);
});

test('bargain effects change scrap, speed, fire rate and core damage only while active', () => {
  const game = quiet(40);
  const rate = game.rate;
  game.boon = { key: 'overdrive', until: game.time + 10 };
  assert.ok(Math.abs(game.rate - rate * 1.35) < 1e-9);
  const hp = game.hp;
  game.impact({ damage: 10, type: 'crawler' });
  const overdriveHit = hp - game.hp;
  game.boon = null;
  const before = game.hp;
  game.impact({ damage: 10, type: 'crawler' });
  assert.ok(overdriveHit > before - game.hp);

  const lull = quiet(41);
  lull.boon = { key: 'lull', until: lull.time + 10 };
  const crawler = lull.spawn('crawler', 30, 0);
  const scrap = lull.scrap;
  lull.rewardKill(crawler);
  assert.equal(lull.scrap, scrap);
});

test('elite hostiles roll a trait that changes how they fight', () => {
  const game = quiet(50);
  const traits = new Set();
  for (let i = 0; i < 60; i++) traits.add(game.spawn('crawler', 60, 0, { elite: true }).trait);
  assert.deepEqual([...traits].sort(), Object.keys(ELITE_TRAITS).sort());
  assert.equal(game.spawn('crawler', 60, 0).trait, null);

  const plated = quiet(51);
  const a = plated.spawn('brute', 60, 0, { elite: true });
  const b = plated.spawn('brute', 60, 5, { elite: true });
  for (const enemy of [a, b]) { enemy.shield = enemy.maxShield = 0; enemy.hp = enemy.maxHp = 1000; }
  a.trait = 'plated'; b.trait = 'swift';
  plated.hurt(a, 10); plated.hurt(b, 10);
  assert.ok(a.maxHp - a.hp < b.maxHp - b.hp);

  const volatile = quiet(52);
  const bomb = volatile.spawn('crawler', 30, 0, { elite: true });
  bomb.trait = 'volatile';
  bomb.hp = 0;
  volatile.resolveContacts();
  assert.equal(volatile.enemies.filter(enemy => enemy.mini).length, 2);
});

test('the daily challenge replays the same run and survives a reload', () => {
  const runs = [1, 2].map(seed => {
    const game = start(seed * 1000);
    assert.equal(game.restart('sentinel', null, { daily: true }), true);
    return game;
  });
  assert.equal(runs[0].profile, runs[1].profile);
  assert.deepEqual(runs[0].armory, runs[1].armory);
  assert.deepEqual(runs[0].enemies, runs[1].enemies);
  for (const game of runs) play(game, null, 30);
  assert.deepEqual(runs[0].enemies.map(e => [e.type, e.x, e.y]), runs[1].enemies.map(e => [e.type, e.x, e.y]));

  const storage = new MemoryStorage();
  const game = start(5, storage);
  game.restart('sentinel', null, { daily: true });
  play(game, null, 20);
  assert.equal(saveCheckpoint(game), true);
  const resumed = start(9, storage, true);
  assert.equal(resumed.daily, game.daily);
  assert.equal(resumed.random(), game.random());
});

test('run statistics record damage dealt, the biggest hit and what hurt the core', () => {
  const game = quiet(60);
  game.armory.mounts = [mount('bolt')];
  const target = game.spawn('brute', 20, 0);
  target.maxHp = target.hp = 500;
  game.update(0.05);
  assert.ok(game.stats.dealt > 0 && game.stats.bestHit > 0);
  game.hp = 3;
  game.impact({ damage: 20, type: 'wraith' });
  assert.ok(game.stats.taken.wraith > 0);
  assert.equal(game.stats.fatal, 'wraith');
});

test('mortar and cryo join the weapon pool through lifetime kills and fire as described', () => {
  const fresh = start(70);
  fresh.progress = { ...fresh.progress, totalKills: 0 };
  assert.ok(!availableWeapons(fresh).includes('mortar'));
  fresh.progress = { ...fresh.progress, totalKills: 1000 };
  assert.ok(availableWeapons(fresh).includes('mortar') && availableWeapons(fresh).includes('cryo'));

  const game = quiet(71);
  game.armory.mounts = [mount('mortar')];
  const target = game.spawn('brute', 20, 0);
  const near = game.spawn('brute', 24, 0);
  const far = game.spawn('brute', 50, 0);
  game.focus(target.id);
  fireMounts(game, 0);
  assert.ok(near.hp < near.maxHp && far.hp === far.maxHp);

  const cold = quiet(72);
  cold.armory.mounts = [mount('cryo')];
  const chilled = cold.spawn('brute', 20, 0);
  const beside = cold.spawn('brute', 23, 0);
  cold.focus(chilled.id);
  fireMounts(cold, 0);
  assert.ok(chilled.slowUntil > cold.time && beside.slowUntil > cold.time);
});

test('older saves gain bargain, statistics and daily fields', () => {
  const storage = new MemoryStorage();
  const game = start(80, storage);
  assert.equal(saveCheckpoint(game), true);
  const saved = JSON.parse(storage.getItem(CHECKPOINT_KEY));
  for (const key of ['bargain', 'boon', 'nextBargain', 'lastBargain', 'stats', 'daily', 'rngState']) delete saved.state[key];
  const { armsCaches, weaponDue, pending, ...workshop } = saved.state.workshop;
  saved.state.workshop = workshop;
  saved.state.armory = { mounts: saved.state.armory.mounts.map(({ key, cooldown }) => ({ key, cooldown })), refits: 0 };
  storage.setItem(CHECKPOINT_KEY, JSON.stringify(saved));
  const restored = start(3, storage, true);
  assert.equal(restored.run, game.run);
  assert.equal(restored.bargain, null);
  assert.equal(restored.daily, null);
  assert.deepEqual(restored.stats.taken, {});
});
