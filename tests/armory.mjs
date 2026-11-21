import assert from 'node:assert/strict';
import test from 'node:test';
import { saveCheckpoint } from '../checkpoint.js';
import { equipWeapon, weaponCost } from '../weapons.js';
import { MemoryStorage, start } from './support/gameplay.mjs';

test('each new run can pick its primary and pays for additional unique mounts', () => {
  const storage = new MemoryStorage();
  const game = start(91, storage);
  assert.equal(game.restart('sentinel', 'lance'), true);
  assert.deepEqual(game.armory.mounts.map(m => m.key), ['lance']);
  const wallet = game.scrap;
  assert.equal(weaponCost(game, 'coil', 0), 0);
  assert.equal(equipWeapon(game, 'coil', 0), true);
  assert.equal(game.scrap, wallet);
  assert.ok(game.armory.mounts[0].cooldown > 0);
  assert.ok(weaponCost(game, 'bolt', 0) > 0);
  assert.equal(equipWeapon(game, 'coil', 1), false);
  assert.equal(equipWeapon(game, 'bolt', 2), false);
  const price = weaponCost(game, 'bolt', 1);
  game.scrap = price - 1;
  assert.equal(equipWeapon(game, 'bolt', 1), false);
  assert.deepEqual(game.armory.mounts.map(m => m.key), ['coil']);
  game.scrap += 1;
  assert.equal(equipWeapon(game, 'bolt', 1), true);
  assert.equal(game.scrap, 0);
  game.scrap = weaponCost(game, 'lance', 2);
  assert.equal(equipWeapon(game, 'lance', 2), true);
  assert.equal(equipWeapon(game, 'scatter', 3), false);
  assert.equal(saveCheckpoint(game), true);
  assert.deepEqual(start(7, storage, true).armory, game.armory);
  assert.deepEqual(game.armory.mounts.map(m => m.key), ['coil', 'bolt', 'lance']);
});

test('weapon trajectories send the expected number of hits to distinct in-range enemies', () => {
  const geometry = {
    scatter: [[10,0], [17,4], [19,-5], [14,18], [70,0]],
    lance: [[10,0], [21,1], [39,-1], [20,10], [-15,0]],
    coil: [[8,0], [22,0], [35,0], [91,0], [-85,0]]
  };
  for (const [key, positions] of Object.entries(geometry)) {
    const game = start(9983);
    game.restart('sentinel', key);
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
    game.restart('sentinel', loadout[0]);
    game.scrap = 10000;
    for (let i = 1; i < loadout.length; i++) assert.equal(equipWeapon(game, loadout[i], i), true);
    game.armory.mounts.forEach((mount, index) => { mount.cooldown = index === slot ? 0 : 5; });
    game.enemies = [];
    const target = game.spawn('brute', 20, 0);
    game.update(1 / 60);
    assert.equal(game.shots.length, 1);
    damage.push(target.maxHp - target.hp);
  }
  assert.ok(damage[0] > damage[1] && damage[1] > damage[2] && damage[2] > 0);
});

test('an idle mount fires as soon as its own cooldown expires', () => {
  const game = start(43);
  game.scrap = weaponCost(game, 'lance', 1);
  assert.equal(equipWeapon(game, 'lance', 1), true);
  game.enemies = [];
  const target = game.spawn('brute', 21, 0);
  target.maxHp = target.hp = 500;
  game.armory.mounts[0].cooldown = 0;
  game.armory.mounts[1].cooldown = 0.4;
  game.update(0.05);
  assert.deepEqual(game.shots.map(shot => shot.kind), ['shot']);
  game.update(0.4);
  assert.deepEqual(game.shots.map(shot => shot.kind), ['lance']);
  assert.ok(game.armory.mounts[0].cooldown > 0);
});
