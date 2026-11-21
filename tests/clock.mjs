import assert from 'node:assert/strict';
import test from 'node:test';
import { SimulationClock, SPEEDS } from '../clock.js';
import { start, takeRelic, play, shop, ordnance, precision, snapshotCombat } from './support/gameplay.mjs';

test('all five playback rates produce identical combat for the same seed, loadout and choices', () => {
  assert.deepEqual(SPEEDS, [1, 2, 3, 5, 10]);
  let reference;
  for (const rate of SPEEDS) {
    const game = start(329);
    const clock = new SimulationClock();
    game.openStarter();
    takeRelic(game, ordnance.relics);
    // Make the same purchase decisions every two simulated seconds, irrespective
    // of how many frames the player needed to reach that point.
    for (let segment = 0; segment < 24; segment++) {
      shop(game, ordnance);
      for (let frame = 0; frame < 120 / rate; frame++) clock.advance(game, 1 / 60, rate);
    }
    assert.ok(Math.abs(game.time - 48) < 1e-8);
    assert.ok(game.kills > 0);
    const state = snapshotCombat(game);
    if (!reference) reference = state;
    else assert.deepEqual(state, reference, 'Playback rate ' + rate);
  }
});

test('a large accelerated frame stops exactly on the draft and discards leftover simulation time', () => {
  const game = start(149);
  const clock = new SimulationClock();
  play(game, precision, 119.75);
  clock.advance(game, 0.8, 10);
  assert.equal(game.status, 'draft');
  assert.equal(game.time, 120);
  const frozen = snapshotCombat(game);
  clock.advance(game, 1, 10);
  assert.deepEqual(snapshotCombat(game), frozen);
  takeRelic(game, precision.relics);
  clock.advance(game, 0.001, 10);
  assert.equal(game.time, 120);
  clock.advance(game, 0.001, 10);
  assert.ok(Math.abs(game.time - (120 + 1 / 60)) < 1e-8);
  game.togglePause();
  clock.advance(game, 5, 10);
  game.togglePause();
  const resumed = game.time;
  clock.advance(game, 0.001, 10);
  assert.equal(game.time, resumed);
});
