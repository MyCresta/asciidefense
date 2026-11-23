import { UPGRADES } from './content.js?v=3.9.0';
import { cost as relicCost } from './relic-effects.js?v=3.9.0';
import { CURSES, applyCurse, cursed } from './hazards.js?v=3.9.0';
import { WEAPONS, MAX_GRADE, GRADE_NAMES, TRAITS, MODS, ROLL_STATS, ROLL_MIN, TEMPER_MAX, availableWeapons, rollWeapon, receiveWeapon, replaceWeapon, forgePrice, mountTitle, setGrade, rollText } from './weapons.js?v=3.9.0';

const GRADES = ['Standard', 'Refined', 'Masterwork'];
const RESERVES = new Set(['scrap', 'prospect']);
const natural = value => Number.isSafeInteger(value) && value >= 0;
const canWork = game => game.status === 'running' || game.status === 'paused';

export function createWorkshop() {
  return {
    caches: 1, found: 0, commissioned: 0, tunes: 0, repairs: 0, opened: 0,
    rerolls: 0, dryKills: 0, lastDrop: -1, offer: [], returnStatus: 'running',
    armsCaches: 0, weaponDue: 0, pending: null, drafts: 0
  };
}

export function validWorkshop(state, levels, time, status) {
  if (!state || typeof state !== 'object' || Array.isArray(state)) return false;
  const counters = ['caches', 'found', 'commissioned', 'tunes', 'repairs', 'opened', 'rerolls', 'dryKills', 'armsCaches', 'weaponDue'];
  if (!counters.every(key => natural(state[key]))) return false;
  if (state.drafts !== undefined && !natural(state.drafts)) return false;
  if (!Number.isFinite(state.lastDrop) || state.lastDrop < -1 || state.lastDrop > time) return false;
  if (state.returnStatus !== 'running' && state.returnStatus !== 'paused') return false;
  if (!Array.isArray(state.offer) || ![0, 3].includes(state.offer.length)) return false;
  if (state.armsCaches > state.caches) return false;
  if (state.pending !== null && (status !== 'cache' || !validWeaponItem(state.pending))) return false;
  if (status === 'cache' && !state.offer.length) return false;
  if (!state.offer.length) return state.rerolls === 0;
  if (state.caches < 1 || new Set(state.offer.map(item => item?.key)).size !== 3) return false;
  if (state.offer.some(item => item?.weapon !== undefined || item?.curse !== undefined)) {
    return state.offer.every(item => item && (item.weapon !== undefined ? validWeaponItem(item)
      : item.curse !== undefined ? Object.hasOwn(CURSES, item.curse) && item.key === 'curse:' + item.curse : validBlueprint(item, levels)));
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

export function validRolls(rolls) {
  return rolls === undefined || (rolls !== null && typeof rolls === 'object'
    && Object.keys(ROLL_STATS).every(key => Number.isInteger(rolls[key]) && rolls[key] >= ROLL_MIN && rolls[key] <= TEMPER_MAX));
}

export function validMods(mods) {
  return mods === undefined || (Array.isArray(mods) && mods.length <= 3 && new Set(mods).size === mods.length
    && mods.every(key => typeof key === 'string' && Object.hasOwn(MODS, key)));
}

function validWeaponItem(item) {
  return item !== null && typeof item === 'object' && Object.hasOwn(WEAPONS, item.weapon)
    && item.key === 'arm:' + item.weapon && Number.isInteger(item.grade) && item.grade >= 1 && item.grade <= MAX_GRADE
    && (item.trait === null || Object.hasOwn(TRAITS, item.trait)) && validRolls(item.rolls) && validMods(item.mods);
}

const isWeapon = item => item?.weapon !== undefined;
const isCurse = item => item?.curse !== undefined;

// After three minutes a cache may hide one cursed card among its blueprints.
function maybeCurse(game, offer) {
  const open = Object.keys(CURSES).filter(key => !cursed(game, key));
  if (game.time < 180 || !open.length || game.random() >= .1) return offer;
  const curse = open[Math.min(open.length - 1, Math.floor(game.random() * open.length))];
  const slots = offer.map((item, i) => isWeapon(item) ? -1 : i).filter(i => i >= 0);
  const slot = slots[Math.min(slots.length - 1, Math.floor(game.random() * slots.length))];
  offer[slot] = { key: 'curse:' + curse, curse, grade: 3 };
  return offer;
}

// Advanced upgrades join the cache pool a few minutes in, once the basics are rolling.
function eligible(game) {
  return Object.keys(UPGRADES).filter(key => game.levels[key] < UPGRADES[key].maxLevel && game.time >= (UPGRADES[key].after || 0));
}

function salvageValue(game) {
  return Math.round((45 + Math.min(205, Math.floor(game.time / 30) * 4)) * (game.powers?.recycler ? 1.5 : 1));
}

function assayPayouts(game) {
  const base = salvageValue(game);
  const low = Math.floor(base / 2);
  return [low, base, 2 * base - low];
}

function cashOut(game) {
  const w = game.workshop;
  if (w.armsCaches) return;
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
// always delivers an arms cache. Other drops have their own timer and kill pity.
// Ordinary hostiles mostly drop a small cache, which installs one random upgrade
// on the spot. Elites drop a big cache, which offers a pick of three.
export function awardSalvage(game, enemy) {
  const w = game.workshop;
  w.dryKills++;
  // Magpie: elites always drop a big cache, on a short timer of their own.
  const magpie = enemy.elite && game.powers?.magpie;
  if (!enemy.boss) {
    if (w.found === 0 && !magpie) {
      if (w.dryKills < 5) return false;
    } else {
      const lateDelay = Math.min(65, Math.max(0, game.time - 240) / 8);
      const sooner = 1 - .06 * (game.levels.salvage || 0) - (game.powers?.scavenger ? .15 : 0);
      const delay = (Math.min(26, 12 + game.time / 22) + lateDelay) * sooner;
      const minimum = magpie ? Math.min(20, delay * .4) : enemy.elite ? Math.max(12, delay * .72) : delay;
      if (w.lastDrop >= 0 && game.time - w.lastDrop < minimum) return false;
      const chance = magpie ? 1 : enemy.elite ? .48 : .065 + Math.max(0, w.dryKills - 12) * .008;
      if (w.dryKills < 26 && chance < 1 && game.random() >= chance) return false;
    }
  }
  w.found++;
  w.lastDrop = game.time;
  w.dryKills = 0;
  const here = Number.isFinite(enemy.x) && Number.isFinite(enemy.y);
  if (!enemy.boss && !enemy.elite && game.random() >= .15) {
    smallCache(game);
    if (game.powers?.lucky && game.random() < (game.powers.lucky > 1 ? .6 : .35)) smallCache(game);
    if (here) game.effect(enemy.x, enemy.y, 'cache', 3, .6);
    return true;
  }
  w.caches++;
  if (enemy.boss) w.armsCaches++;
  if (enemy.boss || eligible(game).length) {
    game.note(enemy.boss ? 'Arms cache recovered.' : 'Big cache recovered.', 'upgrade');
    if (here) game.effect(enemy.x, enemy.y, 'cache', 4, .8);
  } else {
    cashOut(game);
  }
  return true;
}

// A small cache installs one random upgrade at once, with no pause.
export function smallCache(game) {
  const keys = eligible(game);
  if (!keys.length) {
    const value = Math.ceil(salvageValue(game) / 2);
    game.scrap += value;
    game.note(`Small cache: +${value} scrap.`, 'upgrade');
    game.effect(0, 0, 'gain', 1, 1.8, '+$' + value);
    return 'scrap';
  }
  const key = keys[Math.min(keys.length - 1, Math.floor(game.random() * keys.length))];
  const from = game.levels[key];
  const gain = Math.min(game.random() < .2 ? 2 : 1, UPGRADES[key].maxLevel - from);
  game.levels[key] = from + gain;
  game.note(`Small cache: ${UPGRADES[key].label} Lv.${from + gain}.`, 'upgrade');
  const stacked = game.effects.filter(effect => effect.type === 'gain').length;
  game.effect(0, 0, 'gain', 1 + stacked, 1.8, '+' + UPGRADES[key].label + ' ' + (from + gain));
  game.noteSynergies?.(key, from);
  return key;
}

function rollGrade(game) {
  const roll = game.random() * (game.powers?.appraiser ? .55 : 1);
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
    return maybeCurse(game, offer);
  }
  return maybeCurse(game, rollBlueprints(game, previous));
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
  if (isCurse(item)) {
    const curse = CURSES[item.curse];
    return { name: curse.name, grade: 3, rarity: 'Cursed', description: curse.upside + '. ' + curse.downside + '.', effect: 'Lasts all run', curse: true, icon: '  .-.  \n (x x) \n  |=|  ' };
  }
  if (isWeapon(item)) {
    const gun = WEAPONS[item.weapon], trait = TRAITS[item.trait];
    const mounts = game.armory.mounts;
    const held = mounts.find(mount => mount.key === item.weapon);
    const name = (trait ? trait.name + ' ' : '') + gun.name;
    const maxed = held && held.grade >= MAX_GRADE;
    const tempered = maxed && Object.keys(ROLL_STATS).some(stat => (held.rolls?.[stat] ?? 0) < TEMPER_MAX);
    const effect = held
      ? (maxed ? (tempered ? 'Temper your G' + MAX_GRADE + ': +5% to its weakest roll' : 'Fully tempered. Pick to reclaim +' + salvageValue(game) + ' scrap')
        : 'Reinforce yours to G' + Math.min(MAX_GRADE, Math.max(held.grade + 1, grade)) + ', keeping the best rolls')
      : mounts.length < game.armory.slots ? 'Fits empty hardpoint ' + (mounts.length + 1) : 'Replace a fitted weapon';
    const mods = (item.mods || []).map(key => MODS[key].name).join(', ');
    return { name, grade, rarity: GRADE_NAMES[grade - 1], description: trait ? trait.description : gun.description,
      effect, rolls: rollText(item.rolls) + (mods ? '\nMods: ' + mods : ''), weapon: true, icon: gun.icon, role: gun.role };
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
  if (isCurse(item)) {
    if (!applyCurse(game, item.curse)) game.scrap += salvageValue(game);
    return finishCache(game);
  }
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
    commission: remaining ? price(40 * 1.4 ** w.commissioned + 10 * w.commissioned) : Infinity,
    forge: game.armory.mounts.map(mount => Number.isFinite(forgePrice(mount)) ? price(forgePrice(mount) * (1 - .15 * (game.powers?.smelter || 0))) : Infinity),
    repair: game.hp < game.maxHp ? price((24 + 9 * w.repairs + 3 * Math.floor(game.time / 50)) * (cursed(game, 'hunger') ? 2 : 1)) : Infinity,
    tune: price(30 + 12 * w.tunes + 1.5 * w.tunes ** 2 + .05 * w.tunes ** 3),
    relic: relicDraftOpen(game) ? price(180 * 1.5 ** (w.drafts || 0) + 2 * Math.floor(game.time / 30)) : Infinity,
    reroll: game.status === 'cache' && remaining > 3
      ? (game.powers?.broker && w.rerolls === 0 ? 0 : price(14 * 1.9 ** w.rerolls + 2 * Math.floor(game.time / 70))) : Infinity
  };
}

// A bought relic draft needs at least one relic left to offer.
function relicDraftOpen(game) {
  return typeof game.openDraft === 'function' && Object.keys(game.powers || {}).length < 200;
}

export function rerollCache(game) {
  const w = game.workshop;
  const price = workshopCosts(game).reroll;
  if (w.pending || !Number.isFinite(price) || game.scrap < price) return false;
  const kind = w.offer.every(isWeapon) ? 'arms' : w.offer.some(isWeapon) ? 'armed' : 'blueprints';
  w.offer = kind === 'blueprints' ? maybeCurse(game, rollBlueprints(game, w.offer.filter(item => !isCurse(item)))) : rollOffer(game, w.offer.filter(item => !isCurse(item)), kind);
  w.rerolls++;
  game.scrap -= price;
  return true;
}

// The forge spends scrap to raise a fitted weapon one grade.
export function forgeWeapon(game, slot) {
  const mount = game.armory.mounts[slot];
  const price = workshopCosts(game).forge[slot];
  if (!canWork(game) || !mount || !Number.isFinite(price) || game.scrap < price) return false;
  game.scrap -= price;
  setGrade(game, mount, mount.grade + 1);
  game.note(`${mountTitle(mount)} forged.`, 'upgrade');
  return true;
}

export function foundry(game, service) {
  if (!canWork(game) || !['commission', 'repair', 'tune', 'relic'].includes(service)) return false;
  const price = workshopCosts(game)[service];
  if (!Number.isFinite(price) || game.scrap < price) return false;
  const w = game.workshop;
  game.scrap -= price;
  if (service === 'commission') {
    w.caches++;
    w.commissioned++;
    game.note('Big cache ordered.', 'upgrade');
  } else if (service === 'relic') {
    w.drafts = (w.drafts || 0) + 1;
    game.note('Relic draft bought.', 'upgrade');
    game.openDraft('bought');
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
