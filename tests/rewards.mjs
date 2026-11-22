import assert from 'node:assert/strict';
import test from 'node:test';
import { POWERS } from '../content.js';
import { saveCheckpoint } from '../checkpoint.js';
import { fireMounts } from '../weapons.js';
import { awardSalvage, smallCache } from '../workshop.js';
import { MemoryStorage, start } from './support/gameplay.mjs';

const mount = (key, extra = {}) => ({ key, grade: 1, trait: null, cooldown: 0, ...extra });

function quiet(seed = 31, storage) {
  const game = start(seed, storage);
  game.enemies = [];
  game.spawnClock = 1e6;
  game.nextDraft = game.nextBoss = 1e6;
  return game;
}

function volley(key, levels) {
  const game = quiet(400);
  Object.assign(game.levels, levels);
  game.armory.mounts = [mount(key)];
  const target = game.spawn('brute', 20, 0);
  const near = game.spawn('brute', 26, 0);
  const far = game.spawn('brute', 40, 0);
  for (const enemy of [target, near, far]) enemy.hp = enemy.maxHp = 1e4;
  game.focus(target.id);
  fireMounts(game, 0);
  return { near: near.hp < near.maxHp, far: far.hp < far.maxHp };
}

test('mortar doubles blast and cannot arc; arc coil doubles arcs and cannot blast', () => {
  // The mortar's own shell bursts within 9 units. Arc levels add nothing to it.
  assert.deepEqual(volley('mortar', { chain: 3, splash: 0 }), { near: true, far: false });
  assert.equal(volley('mortar', { chain: 0, splash: 6 }).far, true, 'Doubled blast reaches 20 units');
  assert.deepEqual(volley('coil', { chain: 0, splash: 6 }), { near: true, far: true }, 'Coil still arcs on its own');
  const coil = quiet(401);
  coil.levels.splash = 6;
  coil.armory.mounts = [mount('coil')];
  const target = coil.spawn('brute', 20, 0);
  const side = coil.spawn('brute', 20, 3);
  for (const enemy of [target, side]) enemy.hp = enemy.maxHp = 1e4;
  coil.focus(target.id);
  fireMounts(coil, 0);
  assert.ok(!coil.effects.some(effect => effect.type === 'splash'), 'Coil fires no blast');
});

test('bolt casters crit more often than other weapons', () => {
  const crits = key => {
    const game = quiet(402);
    game.armory.mounts = [mount(key)];
    const target = game.spawn('brute', 15, 0);
    target.hp = target.maxHp = 1e9;
    let count = 0;
    for (let i = 0; i < 400; i++) {
      game.armory.mounts[0].cooldown = 0;
      fireMounts(game, 0);
      count += game.shots.at(-1).crit ? 1 : 0;
    }
    return count;
  };
  assert.ok(crits('bolt') > crits('lance') + 20);
});

test('ordinary kills drop small caches that install an upgrade at once without pausing', () => {
  const game = quiet(410);
  const levels = Object.values(game.levels).reduce((a, b) => a + b, 0);
  assert.notEqual(smallCache(game), 'scrap');
  assert.equal(Object.values(game.levels).reduce((a, b) => a + b, 0) > levels, true);
  assert.equal(game.status, 'running');
  let small = 0, big = 0;
  for (let i = 0; i < 400; i++) {
    const caches = game.workshop.caches, found = game.workshop.found;
    game.time += 40;
    awardSalvage(game, { x: 0, y: 0, boss: false, elite: false });
    if (game.workshop.found > found) game.workshop.caches > caches ? big++ : small++;
  }
  assert.ok(small > big * 3 && big > 0);
  const elite = quiet(411);
  elite.powers.magpie = 1;
  const before = elite.workshop.caches;
  awardSalvage(elite, { x: 0, y: 0, elite: true });
  assert.equal(elite.workshop.caches, before + 1);
});

test('new relics: reaper, overkill, ricochet, midas, hoard and wild card', () => {
  const reaper = quiet(420);
  reaper.powers.reaper = 3;
  reaper.armory.mounts = [mount('lance')];
  const tough = reaper.spawn('brute', 15, 0);
  tough.hp = tough.maxHp = 1e9;
  for (let i = 0; i < 300 && tough.hp > 0; i++) { reaper.armory.mounts[0].cooldown = 0; fireMounts(reaper, 0); }
  assert.equal(tough.hp, 0);

  for (const key of ['overkill', 'ricochet']) {
    const game = quiet(421);
    game.powers[key] = 1;
    game.armory.mounts = [mount('lance')];
    const weak = game.spawn('crawler', 15, 0);
    weak.hp = 1;
    const next = game.spawn('brute', 15, 15);
    game.focus(weak.id);
    fireMounts(game, 0);
    assert.ok(next.hp < next.maxHp, key + ' carries on to the next hostile');
  }

  const midas = quiet(422);
  midas.powers.midas = 1;
  const scrap = midas.scrap;
  midas.salvage(25);
  assert.ok(midas.scrap > scrap);

  const hoard = quiet(423);
  hoard.scrap = 0;
  const plain = hoard.damage;
  hoard.powers.hoard = 1;
  hoard.scrap = 1000;
  assert.ok(Math.abs(hoard.damage / plain - 1.4) < 1e-9);

  const wild = quiet(424);
  wild.openDraft('time');
  wild.choices[0] = 'wildcard';
  assert.equal(wild.pickPower('wildcard'), true);
  const owned = Object.values(wild.powers).reduce((a, b) => a + b, 0);
  assert.equal(owned, 3);
});

test('dilation, cold blood and bounty board change speed, damage and pay', () => {
  const game = quiet(430);
  const enemy = game.spawn('brute', 10, 0);
  const base = enemy.speed;
  game.powers.dilation = 1;
  enemy.x = 6;
  const step = game.enemies[0];
  const before = Math.hypot(step.x, step.y);
  game.advance(step, 1);
  assert.ok(before - Math.hypot(step.x, step.y) < base * .8);

  const cold = quiet(431);
  const a = cold.spawn('brute', 20, 0), b = cold.spawn('brute', 20, 5);
  for (const e of [a, b]) e.hp = e.maxHp = 1e4;
  cold.powers.coldblood = 1;
  a.slowUntil = cold.time + 5;
  cold.strike(a, 100); cold.strike(b, 100);
  assert.ok(a.maxHp - a.hp > b.maxHp - b.hp);

  const pay = quiet(432);
  const elite = pay.spawn('brute', 20, 0, { elite: true });
  let scrap = pay.scrap;
  pay.rewardKill(elite);
  const plain = pay.scrap - scrap;
  pay.powers.warrant = 1;
  scrap = pay.scrap;
  pay.rewardKill(elite);
  assert.ok(pay.scrap - scrap >= plain * 2 - 1);
});

test('every new relic is in the pool and a run holding them still saves', () => {
  for (const key of ['reaper', 'overkill', 'ricochet', 'coinflip', 'hoard', 'midas', 'jackpot', 'warrant', 'lucky', 'magpie', 'dilation', 'coldblood', 'pyre', 'wildcard']) {
    assert.ok(Object.hasOwn(POWERS, key), key);
  }
  const storage = new MemoryStorage();
  const game = quiet(440, storage);
  Object.assign(game.powers, { reaper: 1, hoard: 1, coinflip: 1 });
  game.armory.mounts[0].grade = 5;
  assert.equal(saveCheckpoint(game), true);
  const back = start(1, storage, true);
  assert.equal(back.armory.mounts[0].grade, 5);
  assert.equal(back.powers.hoard, 1);
});
