import assert from 'node:assert/strict';
import test from 'node:test';
import { ENEMIES, POWERS, RUN_PROFILES } from '../content.js';
import * as Relics from '../relic-effects.js';

function hostile(x, y = 0, hp = 100) {
  return { x, y, hp, maxHp: hp, shield: 0 };
}

function arena(powers) {
  return {
    powers, enemies: [], time: 4, damage: 10, range: 40,
    hp: 100, maxHp: 100, scrap: 0, bossKills: 0,
    hurt(target, amount) { target.hp = Math.max(0, target.hp - amount); },
    beam() {}, effect() {}, note() {}
  };
}

function near(actual, expected) {
  assert.ok(Math.abs(actual - expected) < 1e-8, 'Expected ' + expected + ', got ' + actual);
}

test('the catalog contains distinct diagrams and complete encounter profiles', () => {
  const powers = Object.values(POWERS);
  const tiers = Object.groupBy(powers, p => p.rarity);
  assert.ok(tiers.common.length >= 20 && tiers.uncommon.length >= 10 && tiers.rare.length >= 8);
  assert.equal(new Set(powers.map(p => p.sigil)).size, powers.length);
  for (const power of powers) {
    const rows = power.sigil.split('\n');
    assert.equal(rows.length, 3, power.name);
    assert(rows.every(row => /^[ -~]{1,12}$/.test(row)), power.name);
    assert.equal(Boolean(power.rare), power.rarity === 'rare');
    assert.equal(Boolean(power.reserve), power.maxStacks == null);
  }
  for (const profile of Object.values(RUN_PROFILES)) {
    for (const key of ['hp','speed','interval','damage','salvage']) assert(profile[key] > 0, profile.name);
    assert(Number.isFinite(profile.supply) && profile.description && profile.tactic);
    for (const [species, weight] of Object.entries(profile.enemyWeights)) assert(ENEMIES[species] && weight > 0);
  }
});

test('stat relics apply both sides of each trade and honor health and timing thresholds', () => {
  const game = arena({rail:1, repeater:1, clockwork:1, redline:1, ballast:1, glass:1,
    regicide:1, mesh:1, precision:1, caliper:2, bulwark:3, triage:2});
  game.bossKills = 7;
  near(Relics.stat(game, 'range', 40), 45);
  near(Relics.stat(game, 'rate', 1), 1.45 * .88);
  near(Relics.stat(game, 'damage', 10), 10 * 1.45 * .8 * 1.88);
  near(Relics.stat(game, 'splash', 12), 6);
  near(Relics.stat(game, 'chain', 1), 3);
  near(Relics.stat(game, 'armor', 1.5), 7.5);
  near(Relics.stat(game, 'critChance', .1), .51);
  near(Relics.stat(game, 'critChance', .95), 1);
  near(Relics.criticalMultiplier(game), 1.6);
  near(Relics.stat(game, 'regen', .2), .2);
  game.hp = 49;
  game.time = 13;
  near(Relics.stat(game, 'regen', .2), 1.6);
  near(Relics.stat(game, 'rate', 1), 1.45 * .88 * 1.55 * 1.45);
});

test('targeting, focus, group size, and distance change shot output', () => {
  const game = arena({longshot:1, buckshot:1, firstblood:1, spotter:1, packhunter:1});
  const target = { ...hostile(35), id: 'focus' };
  const neighbor = hostile(35,12);
  game.enemies = [target, neighbor];
  game.focusId = target.id;
  near(Relics.hitFactor(game, target, true), 1.30 * 1.45 * 1.35);
  game.enemies.push(hostile(34));
  near(Relics.hitFactor(game, target, false), 1.30 * 1.35 * 1.4);
  target.x = 10;
  target.hp--;
  near(Relics.hitFactor(game, target, true), 1.35 * 1.35);
});

test('control fields and cyclic damage respect range, time, and living targets', () => {
  const game = arena({crowfoot:1, stasis:1, mortar:1, horizon:1});
  const close = hostile(15,0,90), healthier = hostile(29,0,100), far = hostile(42,0,120);
  game.enemies = [close, healthier, far];
  game.time = 1.99;
  assert.equal(Relics.speed(game, close, 4), 0);
  assert.equal(Relics.speed(game, far, 4), 4);
  game.time = 2;
  near(Relics.speed(game, close, 4), 3.2);
  near(Relics.speed(game, healthier, 4), 4);
  game.time = 16.02;
  Relics.onTick(game, .05);
  assert.deepEqual(game.enemies.map(e => e.hp), [90,80,120]);
  game.time = 16.07;
  Relics.onTick(game,.05);
  assert.equal(healthier.hp,80);
  game.time = 30.02;
  Relics.onTick(game,.05);
  assert.deepEqual(game.enemies.map(e=>e.hp), [70,60,100]);
});

test('critical spray, on-kill blasts and primary executions have different target rules', () => {
  const game = arena({tracer:1,galvanic:1,bloom:1,execute:1});
  const target = hostile(0), neighbor = hostile(11), fringe = hostile(13);
  game.enemies = [target,neighbor,fringe];
  game.hp = 95;
  Relics.onCritical(game,target,40);
  assert.deepEqual(game.enemies.map(e=>e.hp), [100,80,100]);
  assert.equal(game.hp,96);
  target.hp = 15;
  target.boss = true;
  Relics.onFire(game,target);
  assert.equal(target.hp,15);
  target.boss = false;
  Relics.onFire(game,target);
  assert.equal(target.hp,0);
  Relics.onDeath(game,target);
  assert.deepEqual(game.enemies.map(e=>e.hp),[0,72,92]);
});

test('cash effects respect time, pricing, kill position, and each relic install', () => {
  const game = arena({stipend:2,foundry:2,poacher:1,royalty:1,ballast:1});
  game.time = 40;
  Relics.onTick(game,.08);
  assert.equal(game.scrap,10);
  assert.equal(Relics.cost(game,100),84);
  assert.equal(Relics.cost(game,1),1);
  assert.equal(Relics.bounty(game,hostile(15),8),11);
  assert.equal(Relics.bounty(game,hostile(21),8),8);
  Relics.onPick(game,'ballast');
  assert.deepEqual([game.scrap,game.hp,game.maxHp], [28,140,140]);
  Relics.onPick(game,'caliper');
  assert.deepEqual([game.scrap,game.hp,game.maxHp], [46,140,140]);
});

test('core impacts trigger retaliation and consume a lethal rescue exactly once', () => {
  const game = arena({glass:1,returnfire:1,fuse:1});
  game.hp = 15;
  game.enemies = [hostile(22), hostile(23)];
  let damage = Relics.impact(game, game.enemies[0], 8);
  assert.equal(damage,10);
  game.hp -= damage;
  assert.deepEqual(game.enemies.map(e=>e.hp), [80,100]);
  damage = Relics.impact(game, game.enemies[0], 8);
  game.hp -= damage;
  assert.equal(game.hp,40);
  assert.equal(game.fuseUsed,true);
  damage = Relics.impact(game,game.enemies[0],40);
  assert.equal(damage,50);
});

test('the game applies a drafted relic in the foundry and through the combat loop', async () => {
  const { Game } = await import('../engine.js');
  const { workshopCosts } = await import('../workshop.js');
  const game = new Game({ storage: null, random: () => .5 });
  const normalPrice = workshopCosts(game).tune;
  game.status = 'draft';
  game.choices = ['foundry','bulwark','caliper'];
  assert(game.pickPower('foundry'));
  assert.equal(workshopCosts(game).tune, Math.round(.92 * normalPrice));

  game.enemies = [];
  game.spawnClock = 100;
  game.powers.bloom = 1;
  const seed = game.spawn('moth', 12, 0);
  const next = game.spawn('moth', 23, 0);
  const last = game.spawn('moth', 34, 0);
  next.hp = last.hp = 4;
  seed.hp = 0;
  game.resolveContacts();
  assert.equal(game.kills, 3);
  assert.equal(game.enemies.length, 0);

  game.powers.fuse = 1;
  game.hp = 2;
  game.spawn('brute', 0.5, 0);
  game.armory.mounts[0].cooldown = 5;
  game.update(.01);
  assert(game.fuseUsed);
  assert.equal(game.status, 'running');
  near(game.hp, game.maxHp * .4);
});
