import assert from 'node:assert/strict';
import test from 'node:test';
import { saveCheckpoint } from '../checkpoint.js';
import { CURSES, applyCurse, chooseRoute, offerRoute } from '../hazards.js';
import { PERKS, buyPerk, perkBank } from '../perks.js';
import { mountStats, weaponComboActive } from '../weapons.js';
import { openCache, pickBlueprint, workshopCosts } from '../workshop.js';
import { MemoryStorage, play, start } from './support/gameplay.mjs';

const mount = (key, extra = {}) => ({ key, grade: 1, trait: null, cooldown: 0, ...extra });

function quiet(seed = 11, storage) {
  const game = start(seed, storage);
  game.enemies = [];
  game.spawnClock = 1e6;
  return game;
}

test('a weapon trait and its relic form a combo that changes the weapon', () => {
  const game = quiet(1);
  game.armory.mounts = [mount('bolt', { trait: 'forked' })];
  const before = mountStats(game.armory.mounts[0], game).chains;
  assert.equal(weaponComboActive(game, 'stormcell'), false);
  game.powers.tesla = 1;
  assert.equal(weaponComboActive(game, 'stormcell'), true);
  assert.equal(mountStats(game.armory.mounts[0], game).chains, before + 2);

  game.armory.mounts = [mount('bolt', { trait: 'searing' })];
  game.powers.ember = 1;
  const dying = game.spawn('crawler', 20, 0);
  const neighbour = game.spawn('crawler', 24, 0);
  dying.burnUntil = game.time + 2; dying.burnDps = 5; dying.hp = 0;
  game.resolveContacts();
  assert.ok(neighbour.burnUntil > game.time, 'Firestorm spreads fire to a neighbour');
});

test('perks cost lifetime kills once and apply to normal runs but not the daily', () => {
  const storage = new MemoryStorage();
  const game = start(2, storage);
  game.progress = { ...game.progress, totalKills: 300 };
  assert.equal(perkBank(game), 300);
  assert.equal(buyPerk(game, 'stash'), true);
  assert.equal(buyPerk(game, 'stash'), false);
  assert.equal(perkBank(game), 300 - PERKS.stash.cost);
  assert.equal(buyPerk(game, 'bastion'), false, 'Not enough kills left');
  game.restart('sentinel');
  assert.equal(game.workshop.caches, 2);
  game.restart('sentinel', null, { daily: true });
  assert.equal(game.workshop.caches, 1);
});

test('a route is offered after a sovereign falls and pays out when it ends', () => {
  const game = quiet(3);
  const boss = game.spawn('sovereign', 20, 0);
  boss.hp = 0;
  game.resolveContacts();
  assert.ok(game.route && game.route.options.length === 2 && game.route.options[0] !== game.route.options[1]);
  game.status = 'running';
  game.route.options = ['swarm', 'convoy'];
  const caches = game.workshop.caches;
  assert.equal(chooseRoute(game, 0), true);
  assert.equal(game.path.key, 'swarm');
  game.queue = [];
  game.nextDraft = 1e6;
  game.update(151);
  assert.equal(game.path, null);
  assert.equal(game.workshop.caches, caches + 1);

  const late = quiet(4);
  offerRoute(late);
  late.update(21);
  assert.ok(late.path, 'An unanswered route takes the first option');
});

test('cursed cards trade a lasting upside for a lasting downside', () => {
  const game = quiet(5);
  const damage = game.damage, maxHp = game.maxHp;
  assert.equal(applyCurse(game, 'glass'), true);
  assert.ok(game.damage > damage && game.maxHp < maxHp);
  assert.equal(applyCurse(game, 'glass'), false);
  const repair = (game.hp = 1, workshopCosts(game).repair);
  applyCurse(game, 'hunger');
  assert.equal(workshopCosts(game).repair, repair * 2);

  const cache = quiet(6);
  cache.time = 400;
  cache.nextDraft = cache.nextBoss = cache.nextBargain = 1000;
  cache.workshop.caches = 1;
  cache.workshop.offer = [{ key: 'curse:greed', curse: 'greed', grade: 3 }, { key: 'scrap', grade: 1, levels: 1 }, { key: 'prospect', grade: 1, levels: 1 }];
  assert.equal(openCache(cache), true);
  assert.equal(saveCheckpoint(cache), true);
  assert.equal(pickBlueprint(cache, 'curse:greed'), true);
  assert.deepEqual(cache.curses, ['greed']);
  assert.ok(Object.keys(CURSES).length >= 3);
});

test('later sovereigns bring escorts, longer siege range and split when destroyed', () => {
  const game = quiet(7);
  game.nextBoss = 160 + 180 * 3;
  game.warning = { type: 'sovereign', at: game.nextBoss, x: 120, y: 0, edge: 'E' };
  game.time = game.nextBoss;
  game.scheduleBoss();
  const boss = game.enemies.find(enemy => enemy.boss);
  assert.equal(boss.rank, 4);
  assert.equal(game.enemies.filter(enemy => enemy.type === 'aegis').length, 2);
  boss.hp = 0;
  game.resolveContacts();
  const halves = game.enemies.filter(enemy => enemy.type === 'sovereign');
  assert.equal(halves.length, 2);
  assert.ok(halves.every(half => !half.boss && half.maxHp < boss.maxHp));
  assert.equal(game.bossKills, 1);
});

test('the daily challenge records a kill trace for racing the best attempt', () => {
  const storage = new MemoryStorage();
  const game = start(8, storage);
  game.restart('sentinel', null, { daily: true });
  play(game, null, 95);
  assert.equal(game.stats.trace.length, 3);
  game.saveDaily(true);
  assert.deepEqual(game.dailyRecord.trace, game.stats.trace);
});
