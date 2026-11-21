import assert from 'node:assert/strict';
import { Game } from '../../engine.js';
import { POWERS, UPGRADES } from '../../content.js';
import { openCache, pickBlueprint, foundry, workshopCosts } from '../../workshop.js';
import { equipWeapon, weaponCost } from '../../weapons.js';

export const RECORDS_KEY = 'last-spire.records.v1';
export const CHECKPOINT_KEY = 'last-spire.checkpoint.v3';

export class MemoryStorage {
  items = new Map();
  getItem(key) { return this.items.get(key) ?? null; }
  setItem(key, value) { this.items.set(key, String(value)); }
  removeItem(key) { this.items.delete(key); }
}

// Park-Miller with a positive, nonzero seed. Every enemy, shot and offered
// relic uses the same injected stream as the production simulation.
function seededRandom(seed) {
  let state = seed;
  return () => {
    state = state * 16807 % 2147483647;
    return (state - 1) / 2147483646;
  };
}

export function start(seed = 19, storage = new MemoryStorage(), resume = false) {
  return new Game({ random: seededRandom(seed), storage, resume });
}

export const precision = {
  name: 'Precision',
  weights: { damage: 1.55, rate: 1.3, crit: 0.95, range: 0.5, bounty: 0.45, chain: 0.25, splash: 0.22, armor: 0.15, regen: 0.1 },
  relics: ['headhunter', 'ember', 'overclock', 'twinshot', 'ward', 'scope']
};
export const ordnance = {
  name: 'Ordnance',
  weights: { splash: 1.25, chain: 1.15, rate: 0.96, damage: 0.9, range: 0.65, bounty: 0.45, armor: 0.22, regen: 0.18, crit: 0.12 },
  relics: ['fracture', 'tesla', 'repulse', 'frost', 'twinshot', 'overclock']
};

// Apply the same price and relic priorities on every seed, restricted to the
// schematics enemies actually drop. Fit dissimilar support weapons and buy
// services from earned scrap. No free currency or rank grants in full runs.
export function shop(game, build) {
  if (game.workshop.caches && openCache(game) && game.status === 'cache') {
    const value = card => {
      if (!(card.key in UPGRADES)) return -1;
      const upgrade = UPGRADES[card.key];
      return card.levels * build.weights[card.key] /
        (upgrade.baseCost * upgrade.growth ** game.levels[card.key]);
    };
    const [best] = [...game.workshop.offer].sort((a, b) => value(b) - value(a));
    const before = game.scrap, level = game.levels[best.key];
    assert.equal(pickBlueprint(game, best.key), true);
    if (best.key in UPGRADES) assert.ok(game.levels[best.key] > level);
    assert.ok(game.scrap >= before);
  }
  const mounts = game.armory.mounts;
  const desired = build === precision ? ['bolt','lance','scatter'] : ['scatter','coil','lance'];
  if (game.time < 1 && mounts[0].key !== desired[0]) {
    assert.equal(equipWeapon(game, desired[0], 0), true);
  }
  const nextSlot = mounts.length;
  const weapon = desired[nextSlot];
  if (weapon && !mounts.some(mount => mount.key === weapon) && game.scrap >= weaponCost(game, weapon, nextSlot)) {
    equipWeapon(game, weapon, nextSlot);
  }
  const costs = workshopCosts(game);
  if (game.hp < 0.6 * game.maxHp && game.scrap >= costs.repair) {
    foundry(game, 'repair');
  } else if (game.scrap >= costs.tune) {
    foundry(game, 'tune');
  } else if (game.scrap >= costs.commission && nextSlot === 3) {
    foundry(game, 'commission');
  }
}

export function takeRelic(game, priority) {
  assert.equal(game.status, 'draft');
  assert.equal(game.choices.length, 3);
  assert.equal(new Set(game.choices).size, 3);
  for (const key of game.choices) {
    assert.ok(Object.hasOwn(POWERS, key), 'Draft offered unknown relic ' + key);
    const cap = POWERS[key].maxStacks;
    assert.ok(cap == null || (game.powers[key] || 0) < cap, 'Draft offered exhausted relic ' + key);
  }
  const chosen = priority.find(key => game.choices.includes(key)) ?? game.choices[0];
  const before = game.powers[chosen] || 0;
  assert.equal(game.pickPower(chosen), true);
  assert.equal(game.powers[chosen], before + 1);
  return chosen;
}

export function play(game, build, limit, onStep = () => {}) {
  while (game.status !== 'over' && game.time < limit - 1e-7) {
    if (game.status === 'draft') {
      takeRelic(game, build?.relics || []);
      continue;
    }
    assert.equal(game.status, 'running');
    if (build) shop(game, build);
    const before = game.time;
    const seconds = Math.min(1, limit - before);
    // Match the production clock's 60 fixed simulation ticks per second. A large
    // update has coarser collision and cooldown decisions at high fire rates.
    for (let i = 0; i < 60 && i / 60 < seconds - 1e-10 && game.status === 'running'; i++) {
      game.update(Math.min(1 / 60, seconds - i / 60));
    }
    assert.ok(game.time > before || game.status !== 'running', 'Combat clock stalled');
    onStep(game);
  }
}

export function snapshotCombat(game) {
  return structuredClone({
    run: game.run, status: game.status, time: game.time, hp: game.hp,
    starterReady: game.starterReady, doctrine: game.doctrine, selected: game.selected,
    draftReason: game.draftReason, warning: game.warning, queue: game.queue, focusId: game.focusId,
    workshop: game.workshop, profile: game.profile, draftHistory: game.draftHistory,
    armory: game.armory, fuseUsed: game.fuseUsed,
    scrap: game.scrap, kills: game.kills, enemies: game.enemies,
    levels: game.levels, choices: game.choices, powers: game.powers,
    nextDraft: game.nextDraft, nextBoss: game.nextBoss, bossKills: game.bossKills
  });
}
