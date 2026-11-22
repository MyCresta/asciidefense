import { UPGRADES } from './content.js?v=3.2.0';
import { cost as relicCost } from './relic-effects.js?v=3.2.0';
import { WEAPONS, MAX_GRADE, GRADE_NAMES, TRAITS, availableWeapons, rollWeapon, receiveWeapon, replaceWeapon, hardpointPrice, mountTitle } from './weapons.js?v=3.2.0';

const GRADES = ['Standard', 'Refined', 'Masterwork'];
const RESERVES = new Set(['scrap', 'prospect']);
const natural = value => Number.isSafeInteger(value) && value >= 0;
const canWork = game => game.status === 'running' || game.status === 'paused';

export function createWorkshop() {
  return {
    caches: 1, found: 0, commissioned: 0, tunes: 0, repairs: 0, opened: 0,
    rerolls: 0, dryKills: 0, lastDrop: -1, offer: [], returnStatus: 'running',
    armsCaches: 0, weaponDue: 0, pending: null
  };
}

export function validWorkshop(state, levels, time, status) {
  if (!state || typeof state !== 'object' || Array.isArray(state)) return false;
  const counters = ['caches', 'found', 'commissioned', 'tunes', 'repairs', 'opened', 'rerolls', 'dryKills', 'armsCaches', 'weaponDue'];
  if (!counters.every(key => natural(state[key]))) return false;
  if (!Number.isFinite(state.lastDrop) || state.lastDrop < -1 || state.lastDrop > time) return false;
  if (state.returnStatus !== 'running' && state.returnStatus !== 'paused') return false;
  if (!Array.isArray(state.offer) || ![0, 3].includes(state.offer.length)) return false;
  if (state.armsCaches > state.caches) return false;
  if (state.pending !== null && (status !== 'cache' || !validWeaponItem(state.pending))) return false;
  if (status === 'cache' && !state.offer.length) return false;
  if (!state.offer.length) return state.rerolls === 0;
  if (state.caches < 1 || new Set(state.offer.map(item => item?.key)).size !== 3) return false;
  if (state.offer.some(item => item?.weapon !== undefined)) {
    return state.offer.every(item => item && (item.weapon === undefined ? validBlueprint(item, levels) : validWeaponItem(item)));
  }
  // Other rewards can advance an upgrade in a shelved offer. Its printed
  // grade stays intact; installation clamps the gain or pays salvage instead.
  return state.offer.every(item => item && validBlueprint(item, levels));
}

function validBlueprint(item, levels) {
  return typeof item.key === 'string'
    && (Object.hasOwn(UPGRADES, item.key) && Object.hasOwn(levels, item.key) || RESERVES.has(item.key))
    && Number.isInteger(item.grade) && item.grade >= 1 && item.grade <= 3
    && Number.isInteger(item.levels) && item.levels >= 1 && item.levels <= item.grade;
}

function validWeaponItem(item) {
  return item !== null && typeof item === 'object' && Object.hasOwn(WEAPONS, item.weapon)
    && item.key === 'arm:' + item.weapon && Number.isInteger(item.grade) && item.grade >= 1 && item.grade <= MAX_GRADE
    && (item.trait === null || Object.hasOwn(TRAITS, item.trait));
}

const isWeapon = item => item?.weapon !== undefined;

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
  w.armsCaches = 0;
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
  if (enemy.boss) w.weaponDue++;
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

function rollArms(game, previous = []) {
  const offer = [];
  const seen = previous.map(item => item.weapon);
  while (offer.length < 3) {
    const taken = offer.map(item => item.weapon);
    const pool = availableWeapons(game);
    const fresh = pool.filter(key => !taken.includes(key) && !seen.includes(key));
    offer.push(rollWeapon(game, fresh.length ? pool.filter(key => !fresh.includes(key)) : taken));
  }
  return offer;
}

// A third of ordinary caches carry one found weapon. A sovereign cache always does.
function rollOffer(game, previous = [], kind = 'mixed') {
  if (kind === 'arms') return rollArms(game, previous);
  const armed = kind === 'armed' || game.random() < 1 / 3;
  if (armed) {
    const prior = previous.find(isWeapon);
    const blueprints = rollBlueprints(game, previous.filter(item => !isWeapon(item))).slice(0, 2);
    const weapon = rollWeapon(game, prior ? [prior.weapon] : []);
    const offer = [...blueprints];
    offer.splice(Math.floor(game.random() * 3), 0, weapon);
    return offer;
  }
  return rollBlueprints(game, previous);
}

function rollBlueprints(game, previous = []) {
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
  if (isWeapon(item)) {
    const gun = WEAPONS[item.weapon], trait = TRAITS[item.trait];
    const mounts = game.armory.mounts;
    const held = mounts.find(mount => mount.key === item.weapon);
    const name = (trait ? trait.name + ' ' : '') + gun.name;
    const effect = held
      ? (held.grade >= MAX_GRADE ? 'Already masterwork. Pick to reclaim +' + salvageValue(game) + ' scrap' : 'Reinforce yours to G' + Math.min(MAX_GRADE, Math.max(held.grade + 1, grade)))
      : mounts.length < game.armory.slots ? 'Fits empty hardpoint ' + (mounts.length + 1) : 'Replace a fitted weapon';
    return { name, grade, rarity: GRADE_NAMES[grade - 1], description: gun.description + (trait ? ' ' + trait.description : ''), effect, weapon: true, icon: gun.icon, role: gun.role };
  }
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
  if (!eligible(game).length && !w.armsCaches && !w.offer.length) {
    cashOut(game);
    return true;
  }
  w.returnStatus = game.status;
  if (!w.offer.length) {
    const kind = w.armsCaches ? 'arms' : w.weaponDue ? 'armed' : 'mixed';
    w.offer = rollOffer(game, [], kind);
    if (kind === 'arms') w.armsCaches--;
    else if (w.offer.some(isWeapon) && w.weaponDue) w.weaponDue--;
  }
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
  if (w.pending) return fitPending(game, key);
  const item = w.offer.find(choice => choice.key === key);
  if (!item) return false;
  if (isWeapon(item)) {
    const result = receiveWeapon(game, item);
    if (result === 'full' && game.armory.mounts.some(mount => mount.key === item.weapon)) {
      const value = salvageValue(game);
      game.scrap += value;
      game.note(`Duplicate ${WEAPONS[item.weapon].name} reclaimed. +${value} scrap.`, 'upgrade');
    } else if (result === 'full') {
      w.pending = { ...item };
      return true;
    } else if (!result) return false;
    return finishCache(game);
  }
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
  return finishCache(game);
}

function finishCache(game) {
  const w = game.workshop;
  w.caches--;
  w.opened++;
  w.offer = [];
  w.rerolls = 0;
  w.pending = null;
  closeCache(game);
  if (!eligible(game).length && !w.armsCaches) cashOut(game);
  return true;
}

// With every hardpoint full, a new weapon replaces one of them or is reclaimed for scrap.
export function fitChoices(game) {
  const w = game.workshop;
  if (!w.pending) return [];
  return [...game.armory.mounts.map((mount, slot) => ({ key: 'fit:' + slot, slot, mount })), { key: 'fit:scrap', slot: -1 }];
}

export function fitPending(game, key) {
  const w = game.workshop;
  const choice = fitChoices(game).find(option => option.key === key);
  if (game.status !== 'cache' || !choice) return false;
  if (choice.slot < 0) {
    const value = salvageValue(game);
    game.scrap += value;
    game.note(`${mountTitle({ key: w.pending.weapon, grade: w.pending.grade, trait: w.pending.trait })} reclaimed. +${value} scrap.`, 'upgrade');
  } else if (!replaceWeapon(game, w.pending, choice.slot)) return false;
  return finishCache(game);
}

export function cancelFit(game) {
  const w = game.workshop;
  if (game.status !== 'cache' || !w.pending) return false;
  w.pending = null;
  return true;
}

export function workshopCosts(game) {
  const w = game.workshop;
  const remaining = eligible(game).length;
  const price = raw => relicCost(game, Math.min(Number.MAX_SAFE_INTEGER, Math.round(raw)));
  return {
    hardpoint: Number.isFinite(hardpointPrice(game)) ? price(hardpointPrice(game)) : Infinity,
    commission: remaining ? price(34 * 1.58 ** w.commissioned + 8 * w.commissioned) : Infinity,
    repair: game.hp < game.maxHp ? price(24 + 9 * w.repairs + 3 * Math.floor(game.time / 50)) : Infinity,
    tune: price(32 + 10 * w.tunes + 4 * w.tunes ** 2),
    reroll: game.status === 'cache' && remaining > 3 ? price(14 * 1.9 ** w.rerolls + 2 * Math.floor(game.time / 70)) : Infinity
  };
}

export function rerollCache(game) {
  const w = game.workshop;
  const price = workshopCosts(game).reroll;
  if (w.pending || !Number.isFinite(price) || game.scrap < price) return false;
  const kind = w.offer.every(isWeapon) ? 'arms' : w.offer.some(isWeapon) ? 'armed' : 'blueprints';
  w.offer = kind === 'blueprints' ? rollBlueprints(game, w.offer) : rollOffer(game, w.offer, kind);
  w.rerolls++;
  game.scrap -= price;
  return true;
}

export function foundry(game, service) {
  if (!canWork(game) || !['commission', 'repair', 'tune', 'hardpoint'].includes(service)) return false;
  const price = workshopCosts(game)[service];
  if (!Number.isFinite(price) || game.scrap < price) return false;
  const w = game.workshop;
  game.scrap -= price;
  if (service === 'hardpoint') {
    game.armory.slots++;
    w.caches++;
    w.armsCaches++;
    game.note(`Hardpoint ${game.armory.slots} opened. An arms cache is ready.`, 'upgrade');
  } else if (service === 'commission') {
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
