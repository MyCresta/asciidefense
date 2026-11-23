// Keep lifetime unlocks independent from the current run. Losing a checkpoint
// (including when browser storage is full) must never reset the player's record.
import { DOCTRINES, ENEMIES, POWERS, RUN_PROFILES, UPGRADES } from './content.js?v=3.9.0';
import { WEAPONS, TRAITS, MAX_GRADE } from './weapons.js?v=3.9.0';
import { createWorkshop, validWorkshop, validRolls, validMods } from './workshop.js?v=3.9.0';
import { ELITE_TRAITS, CURSES, ROUTES } from './hazards.js?v=3.9.0';

const KEY = 'last-spire.checkpoint.v3';
const LEGACY_KEY = 'last-spire.checkpoint.v2';
const RECORDS_KEY = 'last-spire.records.v1';
const VERSION = 3;
// A second tab can resume the same snapshot. A stale tab must not rewind
// the checkpoint after the other tab has advanced or finished that run.
const LAST_SNAPSHOT = Symbol.for('last-spire.checkpoint.last-snapshot');
const LEGACY_SNAPSHOT = Symbol.for('last-spire.checkpoint.legacy-snapshot');
const MAX_CHARS = 2 * 1024 * 1024;

const RUN_FIELDS = [
  'run', 'best', 'time', 'hp', 'maxHp', 'scrap', 'kills', 'bossKills',
  'threat', 'status', 'selected', 'focusId', 'levels', 'bonus', 'powers', 'doctrine',
  'choices', 'draftReason', 'nextDraft', 'nextBoss', 'warning', 'queue',
  'enemies', 'shots', 'effects', 'log', 'nextId', 'gunClock', 'spawnClock',
  'pulseAt', 'wardAt', 'starterReady', 'relics', 'fuseUsed', 'profile',
  'draftHistory', 'workshop', 'armory',
  'stats', 'daily', 'rngState', 'draftReturn',
  'curses', 'route', 'path', 'barrier', 'relicState', 'deck'
];
const RELIC_STATE = ['streak', 'streakUntil', 'plateUntil', 'hitAt', 'echo'];

const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const number = value => Number.isFinite(value) && Math.abs(value) <= Number.MAX_SAFE_INTEGER;
const natural = value => Number.isSafeInteger(value) && value >= 0;
const list = (value, limit) => Array.isArray(value) && value.length <= limit;
const has = (table, value) => typeof value === 'string' && Object.hasOwn(table, value);
const numbers = (object, keys) => keys.every(key => number(object[key]));
// Includes the margin used when splitter offspring appear near an entry edge.
const onField = (x, y) => number(x) && number(y) && Math.abs(x) <= 145 && Math.abs(y) <= 89;

function rankedMap(map, catalogue, capKey, complete) {
  if (!record(map)) return false;
  if (complete && !Object.keys(catalogue).every(key => Object.hasOwn(map, key))) return false;
  return Object.entries(map).every(([key, rank]) => has(catalogue, key)
    && natural(rank) && (catalogue[key][capKey] == null || rank <= catalogue[key][capKey]));
}

function validEnemy(enemy) {
  return record(enemy) && has(ENEMIES, enemy.type)
    && typeof enemy.id === 'string' && /^e\d{1,15}$/.test(enemy.id)
    && onField(enemy.x, enemy.y) && numbers(enemy, ['hp', 'maxHp', 'speed', 'damage', 'reward', 'shield',
      'maxShield', 'lastHit', 'slowUntil', 'burnUntil', 'burnDps', 'pulseAt', 'phaseOffset'])
    && enemy.hp > 0 && enemy.hp <= enemy.maxHp && enemy.shield >= 0 && enemy.shield <= enemy.maxShield
    && natural(enemy.tier) && enemy.tier >= 1 && enemy.tier <= 4
    && ['elite', 'boss', 'mini'].every(key => typeof enemy[key] === 'boolean')
    && (enemy.trait == null || has(ELITE_TRAITS, enemy.trait))
    && (enemy.rank === undefined || (natural(enemy.rank) && enemy.rank <= 10000));
}

function visualEffect(effect) {
  return record(effect) && onField(effect.x, effect.y) && numbers(effect, ['life', 'maxLife'])
    && (effect.fromX === undefined && effect.fromY === undefined || onField(effect.fromX, effect.fromY))
    && effect.maxLife > 0 && effect.life >= 0 && effect.life <= effect.maxLife
    && Object.values(effect).every(value =>
      typeof value === 'boolean' || number(value) || (typeof value === 'string' && value.length <= 48));
}

function validArmory(armory) {
  if (!record(armory) || !Number.isInteger(armory.slots) || armory.slots < 1 || armory.slots > 3) return false;
  if (!list(armory.mounts, armory.slots) || !armory.mounts.length) return false;
  const keys = new Set();
  for (const mount of armory.mounts) {
    if (!record(mount) || !has(WEAPONS, mount.key) || !number(mount.cooldown) || mount.cooldown < 0 || keys.has(mount.key)) return false;
    if (!Number.isInteger(mount.grade) || mount.grade < 1 || mount.grade > MAX_GRADE) return false;
    if (mount.trait !== null && !has(TRAITS, mount.trait)) return false;
    if (!validRolls(mount.rolls) || !validMods(mount.mods) || (mount.shots !== undefined && !natural(mount.shots))) return false;
    keys.add(mount.key);
  }
  return true;
}

function validRunExtras(s) {
  if (s.draftReturn !== 'running' && s.draftReturn !== 'paused') return false;
  const stats = s.stats;
  if (!record(stats) || !numbers(stats, ['dealt', 'bestHit'])) return false;
  if (!record(stats.taken) || Object.keys(stats.taken).length > 16) return false;
  if (!Object.entries(stats.taken).every(([key, value]) => (key === 'siege' || has(ENEMIES, key)) && number(value) && value >= 0)) return false;
  if (stats.fatal !== null) return false;
  if (stats.trace !== undefined && !(list(stats.trace, 4000) && stats.trace.every(natural))) return false;
  if (!list(s.curses, 8) || !s.curses.every(key => has(CURSES, key)) || new Set(s.curses).size !== s.curses.length) return false;
  if (s.route !== null && !(record(s.route) && number(s.route.expires) && list(s.route.options, 2)
    && s.route.options.length === 2 && s.route.options.every(key => has(ROUTES, key)))) return false;
  if (s.path !== null && !(record(s.path) && has(ROUTES, s.path.key) && number(s.path.until))) return false;
  if (s.daily !== null && !(typeof s.daily === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s.daily))) return false;
  if (!number(s.barrier) || s.barrier < 0 || s.barrier > 1000) return false;
  if (!record(s.relicState) || !numbers(s.relicState, RELIC_STATE)) return false;
  if (s.deck !== null && !(list(s.deck, 512) && s.deck.every(key => has(POWERS, key)))) return false;
  return Number.isSafeInteger(s.rngState) && s.rngState >= 0 && s.rngState <= 0xFFFFFFFF;
}

function validState(s, game) {
  if (!validRunExtras(s)) return false;
  if (!record(s) || s.run !== game.records.runs || !natural(s.run) || !s.run) return false;
  if (!['running', 'paused', 'draft', 'cache'].includes(s.status) || !has(DOCTRINES, s.doctrine)) return false;
  if (!has(RUN_PROFILES, s.profile) || typeof s.fuseUsed !== 'boolean') return false;
  if (!list(s.draftHistory, 24) || !s.draftHistory.every(key => has(POWERS, key))) return false;
  if (!numbers(s, ['time', 'best', 'hp', 'maxHp', 'scrap', 'nextDraft', 'nextBoss',
    'gunClock', 'spawnClock', 'pulseAt', 'wardAt'])) return false;
  if (s.hp <= 0 || s.hp > s.maxHp || s.time < 0 || s.scrap < 0
    || s.nextDraft < s.time || s.nextBoss < s.time) return false;
  if (!['kills', 'bossKills', 'threat', 'nextId'].every(key => natural(s[key]))) return false;
  if (!rankedMap(s.levels, UPGRADES, 'maxLevel', true) || !rankedMap(s.powers, POWERS, 'maxStacks', false)) return false;
  if (!validArmory(s.armory)) return false;
  if (!validWorkshop(s.workshop, s.levels, s.time, s.status)) return false;
  if (!record(s.bonus) || !numbers(s.bonus, ['damage', 'range', 'rate']) || typeof s.starterReady !== 'boolean') return false;
  if (s.bonus.range < 0 || s.bonus.range > 140 || s.bonus.rate < 0 || s.bonus.damage < 0) return false;
  if (!list(s.relics, 100) || !s.relics.every(item => typeof item === 'string' && item.length <= 80)) return false;

  if (!list(s.choices, 3) || !s.choices.every(key => has(POWERS, key)) || new Set(s.choices).size !== s.choices.length) return false;
  if (s.status === 'draft') {
    if (s.choices.length !== 3 || !['starter', 'time', 'boss', 'bought'].includes(s.draftReason)) return false;
    if (s.choices.some(key => POWERS[key].maxStacks != null && s.powers[key] >= POWERS[key].maxStacks)) return false;
  } else if (s.choices.length) return false;
  if (!list(s.queue, 16) || !s.queue.every(item => ['time', 'boss', 'starter', 'bought'].includes(item))) return false;
  if (s.warning !== null && !(record(s.warning) && has(ENEMIES, s.warning.type)
    && onField(s.warning.x, s.warning.y) && number(s.warning.at) && typeof s.warning.edge === 'string' && s.warning.edge.length <= 16)) return false;

  if (!list(s.enemies, 2048) || !s.enemies.every(validEnemy)) return false;
  const ids = new Set(s.enemies.map(enemy => enemy.id));
  if (ids.size !== s.enemies.length || s.enemies.some(enemy => Number(enemy.id.slice(1)) >= s.nextId)) return false;
  if (s.selected !== 'tower' && !ids.has(s.selected)) return false;
  if (s.focusId != null && !ids.has(s.focusId)) return false;
  if (!list(s.shots, 1024) || !s.shots.every(visualEffect) || !list(s.effects, 2048) || !s.effects.every(visualEffect)) return false;
  return list(s.log, 100) && s.log.every(item => record(item) && number(item.time)
    && typeof item.type === 'string' && item.type.length <= 64 && typeof item.text === 'string' && item.text.length <= 512);
}

export function clearCheckpoint(game) {
  if (!game.storage) return false;
  try {
    // A superseded tab can finish after a newer run has already started.
    if (game.run && JSON.parse(game.storage.getItem(RECORDS_KEY))?.runs > game.run) return false;
    if (game.run && (game[LAST_SNAPSHOT] ?? null) !== game.storage.getItem(KEY)) return false;
    game.storage.removeItem(KEY);
    game.storage.removeItem(LEGACY_KEY);
    game[LAST_SNAPSHOT] = null;
    delete game[LEGACY_SNAPSHOT];
    return true;
  } catch { return false; }
}

export function saveCheckpoint(game) {
  if (!game.storage || game.status === 'over') return false;
  try {
    const records = JSON.parse(game.storage.getItem(RECORDS_KEY));
    if (records?.runs !== game.run) return false;
    const current = game.storage.getItem(KEY);
    if (current !== (game[LAST_SNAPSHOT] ?? null)) {
      // An explicit new run can replace a checkpoint for the previous run.
      if (!current || current.length > MAX_CHARS || !(JSON.parse(current)?.state?.run < game.run)) return false;
    }
    const state = Object.fromEntries(RUN_FIELDS.map(key => [key, game[key]]));
    if (!validState(state, game)) return false;
    const serialized = JSON.stringify({ version: VERSION, state });
    if (serialized.length > MAX_CHARS) return false;
    if (serialized !== current) game.storage.setItem(KEY, serialized);
    game[LAST_SNAPSHOT] = serialized;
    // Commit the new copy before removing its source. A write failure leaves
    // the last playable snapshot available on the next reload.
    if (game[LEGACY_SNAPSHOT]) {
      try {
        if (game.storage.getItem(LEGACY_KEY) === game[LEGACY_SNAPSHOT]) game.storage.removeItem(LEGACY_KEY);
        delete game[LEGACY_SNAPSHOT];
      } catch { /* The new checkpoint is committed. Retry cleanup on the next save. */ }
    }
    return true;
  } catch { return false; }
}

function upgradeLegacyState(state) {
  // V2 and V3 share their combat rules for already-installed items. Preserve
  // the exact ranks, wallet, timers and any relics already shown to the player.
  if (!record(state) || !list(state.choices, 3) || !['running', 'paused', 'draft'].includes(state.status)) return null;
  return addRunExtras({
    ...state, profile: 'baseline', fuseUsed: false,
    draftHistory: [...state.choices], workshop: createWorkshop(),
    armory: { slots: 1, mounts: [{ key: 'bolt', grade: 1, trait: null, cooldown: state.gunClock }] }
  });
}

// Version 3 saves chose and refitted weapons freely. Keep their fitted weapons
// as standard, untraited finds on the same hardpoints.
function upgradeFittedState(state) {
  if (!record(state) || !record(state.armory) || !Array.isArray(state.armory.mounts) || !record(state.workshop)) return state;
  const { armory, workshop } = state;
  if (armory.slots === undefined && armory.refits !== undefined) {
    state.armory = {
      slots: armory.mounts.length,
      mounts: armory.mounts.map(mount => record(mount) ? { key: mount.key, grade: 1, trait: null, cooldown: mount.cooldown } : mount)
    };
  }
  if (workshop.armsCaches === undefined) state.workshop = { ...workshop, armsCaches: 0, weaponDue: 0, pending: null };
  return addRunExtras(state);
}

// Saves from before run statistics and the daily challenge.
function addRunExtras(state) {
  if (!record(state)) return state;
  // Saves from before the deeper progression: new upgrades start at zero and the whole relic pool stays open.
  if (state.deck === undefined) {
    const levels = record(state.levels) ? { ...state.levels } : state.levels;
    if (record(levels)) for (const key of Object.keys(UPGRADES)) if (levels[key] === undefined) levels[key] = 0;
    state = { ...state, levels, barrier: 0, deck: null, relicState: { streak: 0, streakUntil: 0, plateUntil: 0, hitAt: -1000, echo: 0 } };
  }
  if (state.curses === undefined) state = { ...state, curses: [], route: null, path: null };
  if (state.draftReturn === undefined) state = { ...state, draftReturn: 'running' };
  if (state.stats !== undefined) return state;
  return {
    ...state, daily: null, rngState: 0,
    stats: { dealt: 0, bestHit: 0, taken: {}, fatal: null }
  };
}

export function restoreCheckpoint(game) {
  if (!game.storage) return false;
  try {
    const current = game.storage.getItem(KEY);
    const legacy = current === null;
    const raw = legacy ? game.storage.getItem(LEGACY_KEY) : current;
    if (raw === null) return false;
    const archive = raw.length <= MAX_CHARS ? JSON.parse(raw) : null;
    const supported = archive?.version === (legacy ? 2 : VERSION);
    const state = supported && (legacy ? upgradeLegacyState(archive.state) : upgradeFittedState(archive.state));
    if (validState(state, game)) {
      // Only copy whitelisted data once the entire archive has passed validation.
      for (const key of RUN_FIELDS) game[key] = state[key];
      game[LAST_SNAPSHOT] = current;
      if (legacy) {
        game[LEGACY_SNAPSHOT] = raw;
        saveCheckpoint(game);
      }
      return true;
    }
  } catch { /* An invalid save starts a fresh run while lifetime records survive. */ }
  clearCheckpoint(game);
  return false;
}
