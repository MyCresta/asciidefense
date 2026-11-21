import { UPGRADES } from './content.js?v=3.0.0';
import { cost as relicCost } from './relic-effects.js?v=3.0.0';

const GRADES = ['Standard', 'Refined', 'Masterwork'];
const RESERVES = new Set(['scrap', 'prospect']);
const natural = value => Number.isSafeInteger(value) && value >= 0;
const canWork = game => game.status === 'running' || game.status === 'paused';

export function createWorkshop() {
  return {
    caches: 1, found: 0, commissioned: 0, tunes: 0, repairs: 0, opened: 0,
    rerolls: 0, dryKills: 0, lastDrop: -1, offer: [], returnStatus: 'running'
  };
}

export function validWorkshop(state, levels, time, status) {
  if (!state || typeof state !== 'object' || Array.isArray(state)) return false;
  const counters = ['caches', 'found', 'commissioned', 'tunes', 'repairs', 'opened', 'rerolls', 'dryKills'];
  if (!counters.every(key => natural(state[key]))) return false;
  if (!Number.isFinite(state.lastDrop) || state.lastDrop < -1 || state.lastDrop > time) return false;
  if (state.returnStatus !== 'running' && state.returnStatus !== 'paused') return false;
  if (!Array.isArray(state.offer) || ![0, 3].includes(state.offer.length)) return false;
  if (status === 'cache' && !state.offer.length) return false;
  if (!state.offer.length) return state.rerolls === 0;
  if (state.caches < 1 || new Set(state.offer.map(item => item?.key)).size !== 3) return false;
  // Other rewards can advance an upgrade in a shelved offer. Its printed
  // grade stays intact; installation clamps the gain or pays salvage instead.
  return state.offer.every(item => item && typeof item.key === 'string'
    && (Object.hasOwn(UPGRADES, item.key) && Object.hasOwn(levels, item.key) || RESERVES.has(item.key))
    && Number.isInteger(item.grade) && item.grade >= 1 && item.grade <= 3
    && Number.isInteger(item.levels) && item.levels >= 1 && item.levels <= item.grade);
}

function eligible(game) {
  return Object.keys(UPGRADES).filter(key => game.levels[key] < UPGRADES[key].maxLevel);
}

function salvageValue(game) {
  return 45 + Math.min(205, Math.floor(game.time / 30) * 4);
}

function assayPayouts(game) {
  const base = salvageValue(game);
  const low = Math.floor(base / 2);
  return [low, base, 2 * base - low];
}

function cashOut(game) {
  const w = game.workshop;
  const value = w.caches * salvageValue(game);
  if (!value) return;
  game.scrap += value;
  game.note(`Completed blueprints salvaged. +${value} scrap.`, 'upgrade');
  w.opened += w.caches;
  w.caches = 0;
  w.offer = [];
  w.rerolls = 0;
}

// Called once for each kill, including individual kills in a blast. A boss
// always delivers a cache. Ordinary drops have their own timer and kill pity.
export function awardSalvage(game, enemy) {
  const w = game.workshop;
  w.dryKills++;
  if (!enemy.boss) {
    if (w.found === 0) {
      if (w.dryKills < 5) return false;
    } else {
      const lateDelay = Math.min(65, Math.max(0, game.time - 240) / 8);
      const delay = Math.min(26, 12 + game.time / 22) + lateDelay;
      const minimum = enemy.elite ? Math.max(12, delay * .72) : delay;
      if (game.time - w.lastDrop < minimum) return false;
      const chance = enemy.elite ? .48 : .065 + Math.max(0, w.dryKills - 12) * .008;
      if (w.dryKills < 26 && game.random() >= chance) return false;
    }
  }
  w.caches++;
  w.found++;
  w.lastDrop = game.time;
  w.dryKills = 0;
  if (eligible(game).length) {
    game.note(enemy.boss ? 'Sovereign cache recovered.' : 'Salvage cache recovered.', 'upgrade');
    if (Number.isFinite(enemy.x) && Number.isFinite(enemy.y)) game.effect(enemy.x, enemy.y, 'cache', 4, .8);
  } else {
    cashOut(game);
  }
  return true;
}

function rollGrade(game) {
  const roll = game.random();
  if (roll < .06) return 3;
  if (roll < .32) return 2;
  return 1;
}

function draw(game, pool) {
  const i = Math.min(pool.length - 1, Math.floor(game.random() * pool.length));
  return pool.splice(i, 1)[0];
}

function rollOffer(game, previous = []) {
  const keys = eligible(game);
  if (keys.length < 3) keys.push('scrap');
  if (keys.length < 3) keys.push('prospect');
  const seen = new Set(previous.map(item => item.key));
  const fresh = keys.filter(key => !seen.has(key));
  const repeats = keys.filter(key => seen.has(key));
  const offer = [];
  while (offer.length < 3) {
    const key = draw(game, fresh.length ? fresh : repeats);
    const grade = RESERVES.has(key) ? 1 : rollGrade(game);
    const levels = RESERVES.has(key) ? 1 : Math.min(grade, UPGRADES[key].maxLevel - game.levels[key]);
    offer.push({ key, grade, levels });
  }
  return offer;
}

export function describeBlueprint(game, item) {
  const { key, grade } = item;
  const rarity = GRADES[grade - 1];
  if (key === 'prospect') {
    return {
      name: 'Unsorted alloy', grade, rarity, description: 'Assay the salvage. Each payout is equally likely.',
      effect: assayPayouts(game).map(value => '$' + value).join(' / ')
    };
  }
  const upgrade = UPGRADES[key];
  if (key === 'scrap' || game.levels[key] >= upgrade.maxLevel) {
    return { name: 'Reclaim alloy', grade, rarity, description: 'Convert this blueprint to scrap.', effect: '+' + salvageValue(game) + ' scrap' };
  }
  const from = game.levels[key];
  const gain = Math.min(item.levels, upgrade.maxLevel - from);
  return { name: upgrade.label, grade, rarity, description: upgrade.description, effect: 'Lv.' + from + ' -> ' + (from + gain) + '  /  +' + gain };
}

export function openCache(game) {
  const w = game.workshop;
  if (!canWork(game) || !w.caches) return false;
  if (!eligible(game).length) {
    cashOut(game);
    return true;
  }
  w.returnStatus = game.status;
  if (!w.offer.length) w.offer = rollOffer(game);
  game.status = 'cache';
  return true;
}

export function closeCache(game) {
  if (game.status !== 'cache') return false;
  game.status = game.workshop.returnStatus;
  return true;
}

export function pickBlueprint(game, key) {
  const w = game.workshop;
  if (game.status !== 'cache' || !w.caches) return false;
  const item = w.offer.find(choice => choice.key === key);
  if (!item) return false;
  const from = game.levels[key];
  if (RESERVES.has(key) || from >= UPGRADES[key].maxLevel) {
    const value = key === 'prospect' ? draw(game, assayPayouts(game)) : salvageValue(game);
    game.scrap += value;
    game.note(`Blueprint reclaimed. +${value} scrap.`, 'upgrade');
  } else {
    const next = Math.min(from + item.levels, UPGRADES[key].maxLevel);
    game.levels[key] = next;
    game.note(`${UPGRADES[key].name} upgraded to ${next} (+${next - from}).`, 'upgrade');
    game.noteSynergies?.(key, from);
  }
  w.caches--;
  w.opened++;
  w.offer = [];
  w.rerolls = 0;
  closeCache(game);
  if (!eligible(game).length) cashOut(game);
  return true;
}

export function workshopCosts(game) {
  const w = game.workshop;
  const remaining = eligible(game).length;
  const price = raw => relicCost(game, Math.min(Number.MAX_SAFE_INTEGER, Math.round(raw)));
  return {
    commission: remaining ? price(34 * 1.58 ** w.commissioned + 8 * w.commissioned) : Infinity,
    repair: game.hp < game.maxHp ? price(24 + 9 * w.repairs + 3 * Math.floor(game.time / 50)) : Infinity,
    tune: price(32 + 10 * w.tunes + 4 * w.tunes ** 2),
    reroll: game.status === 'cache' && remaining > 3 ? price(14 * 1.9 ** w.rerolls + 2 * Math.floor(game.time / 70)) : Infinity
  };
}

export function rerollCache(game) {
  const w = game.workshop;
  const price = workshopCosts(game).reroll;
  if (!Number.isFinite(price) || game.scrap < price) return false;
  w.offer = rollOffer(game, w.offer);
  w.rerolls++;
  game.scrap -= price;
  return true;
}

export function foundry(game, service) {
  if (!canWork(game) || !['commission', 'repair', 'tune'].includes(service)) return false;
  const price = workshopCosts(game)[service];
  if (!Number.isFinite(price) || game.scrap < price) return false;
  const w = game.workshop;
  game.scrap -= price;
  if (service === 'commission') {
    w.caches++;
    w.commissioned++;
    game.note('Commissioned a salvage cache.', 'upgrade');
  } else if (service === 'repair') {
    const previous = game.hp;
    game.hp = Math.min(game.maxHp, previous + Math.ceil(game.maxHp * .35));
    w.repairs++;
    game.note(`Field repair. +${Math.ceil(game.hp - previous)} integrity.`, 'system');
  } else {
    w.tunes++;
    game.note(`Core tuning rank ${w.tunes} installed.`, 'upgrade');
  }
  return true;
}
