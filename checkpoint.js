// Keep lifetime unlocks independent from the current run. Losing a checkpoint
// (including when browser storage is full) must never reset the player's record.
import { DOCTRINES, ENEMIES, POWERS, UPGRADES } from './content.js?v=2.0.0';

const KEY = 'last-spire.checkpoint.v2';
const RECORDS_KEY = 'last-spire.records.v1';
const VERSION = 2;
// A second tab can resume the same snapshot. A stale tab must not rewind
// the checkpoint after the other tab has advanced or finished that run.
const LAST_SNAPSHOT = Symbol.for('last-spire.checkpoint.last-snapshot');
const MAX_CHARS = 2 * 1024 * 1024;

const RUN_FIELDS = [
  'run', 'best', 'time', 'hp', 'maxHp', 'scrap', 'kills', 'bossKills',
  'threat', 'status', 'selected', 'focusId', 'levels', 'bonus', 'powers', 'doctrine',
  'choices', 'draftReason', 'nextDraft', 'nextBoss', 'warning', 'queue',
  'enemies', 'shots', 'effects', 'log', 'nextId', 'gunClock', 'spawnClock',
  'pulseAt', 'wardAt', 'starterReady', 'relics'
];

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
    && ['elite', 'boss', 'mini'].every(key => typeof enemy[key] === 'boolean');
}

function visualEffect(effect) {
  return record(effect) && onField(effect.x, effect.y) && numbers(effect, ['life', 'maxLife'])
    && (effect.fromX === undefined && effect.fromY === undefined || onField(effect.fromX, effect.fromY))
    && effect.maxLife > 0 && effect.life >= 0 && effect.life <= effect.maxLife
    && Object.values(effect).every(value =>
      typeof value === 'boolean' || number(value) || (typeof value === 'string' && value.length <= 48));
}

function validState(s, game) {
  if (!record(s) || s.run !== game.records.runs || !natural(s.run) || !s.run) return false;
  if (!['running', 'paused', 'draft'].includes(s.status) || !has(DOCTRINES, s.doctrine)) return false;
  if (!numbers(s, ['time', 'best', 'hp', 'maxHp', 'scrap', 'nextDraft', 'nextBoss',
    'gunClock', 'spawnClock', 'pulseAt', 'wardAt'])) return false;
  if (s.hp <= 0 || s.hp > s.maxHp || s.time < 0 || s.scrap < 0
    || s.nextDraft < s.time || s.nextBoss < s.time) return false;
  if (!['kills', 'bossKills', 'threat', 'nextId'].every(key => natural(s[key]))) return false;
  if (!rankedMap(s.levels, UPGRADES, 'maxLevel', true) || !rankedMap(s.powers, POWERS, 'maxStacks', false)) return false;
  if (!record(s.bonus) || !numbers(s.bonus, ['damage', 'range', 'rate']) || typeof s.starterReady !== 'boolean') return false;
  if (s.bonus.range < 0 || s.bonus.range > 140 || s.bonus.rate < 0 || s.bonus.damage < 0) return false;
  if (!list(s.relics, 100) || !s.relics.every(item => typeof item === 'string' && item.length <= 80)) return false;

  if (!list(s.choices, 3) || !s.choices.every(key => has(POWERS, key)) || new Set(s.choices).size !== s.choices.length) return false;
  if (s.status === 'draft') {
    if (s.choices.length !== 3 || !['starter', 'time', 'boss'].includes(s.draftReason)) return false;
    if (s.choices.some(key => POWERS[key].maxStacks != null && s.powers[key] >= POWERS[key].maxStacks)) return false;
  } else if (s.choices.length) return false;
  if (!list(s.queue, 16) || !s.queue.every(item => ['time', 'boss', 'starter'].includes(item))) return false;
  if (s.warning !== null && !(record(s.warning) && has(ENEMIES, s.warning.type)
    && onField(s.warning.x, s.warning.y) && number(s.warning.at) && typeof s.warning.edge === 'string' && s.warning.edge.length <= 16)) return false;

  if (!list(s.enemies, 2048) || !s.enemies.every(validEnemy)) return false;
  const ids = new Set(s.enemies.map(enemy => enemy.id));
  if (ids.size !== s.enemies.length || s.enemies.some(enemy => Number(enemy.id.slice(1)) >= s.nextId)) return false;
  if (s.selected !== 'tower' && !ids.has(s.selected)) return false;
  if (s.focusId != null && !ids.has(s.focusId)) return false;
  if (!list(s.shots, 1024) || !s.shots.every(visualEffect) || !list(s.effects, 2048) || !s.effects.every(visualEffect)) return false;
  return list(s.log, 150) && s.log.every(item => record(item) && number(item.time)
    && typeof item.type === 'string' && item.type.length <= 64 && typeof item.text === 'string' && item.text.length <= 512);
}

export function clearCheckpoint(game) {
  if (!game.storage) return false;
  try {
    // A superseded tab can finish after a newer run has already started.
    if (game.run && JSON.parse(game.storage.getItem(RECORDS_KEY))?.runs > game.run) return false;
    if (game.status === 'over' && game[LAST_SNAPSHOT] !== game.storage.getItem(KEY)) return false;
    game.storage.removeItem(KEY);
    game[LAST_SNAPSHOT] = null;
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
      if (!current || !(JSON.parse(current)?.state?.run < game.run)) return false;
    }
    const state = Object.fromEntries(RUN_FIELDS.map(key => [key, game[key]]));
    if (!validState(state, game)) return false;
    const serialized = JSON.stringify({ version: VERSION, state });
    if (serialized.length > MAX_CHARS) return false;
    if (serialized !== current) game.storage.setItem(KEY, serialized);
    game[LAST_SNAPSHOT] = serialized;
    return true;
  } catch { return false; }
}

export function restoreCheckpoint(game) {
  if (!game.storage) return false;
  try {
    const raw = game.storage.getItem(KEY);
    if (!raw) return false;
    const archive = raw.length <= MAX_CHARS ? JSON.parse(raw) : null;
    if (archive?.version === VERSION && validState(archive.state, game)) {
      // Only copy whitelisted data once the entire archive has passed validation.
      for (const key of RUN_FIELDS) game[key] = archive.state[key];
      game[LAST_SNAPSHOT] = raw;
      return true;
    }
  } catch { /* An invalid save starts a fresh run while lifetime records survive. */ }
  clearCheckpoint(game);
  return false;
}
