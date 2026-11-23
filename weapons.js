import { stalled, criticalMultiplier } from './relic-effects.js?v=3.12.1';

// Cadence and reach multiply the tower's fire rate and range for each mount.
export const WEAPONS = {
  bolt: {
    name: 'Bolt caster', role: 'PRECISION', scale: 1, cadence: 1.18, reach: 1,
    icon: '  |\\   \n==|=>> \n  |/   ',
    description: 'Fast single bolts with +8% critical chance and +0.25x critical damage.'
  },
  scatter: {
    name: 'Scattergun', role: 'CLOSE DEFENSE', scale: .78, cadence: 1.12, reach: .83,
    icon: '   .--/\n==<---=\n   \u0027--\\',
    description: 'Fans pellets across up to three enemies in a short, wide cone.'
  },
  lance: {
    name: 'Rail lance', role: 'LONG RANGE', scale: 1.95, cadence: .53, reach: 1.35,
    icon: '   __  \n==[__]====>\n   --  ',
    description: 'Slow, heavy bolts pierce up to two more enemies lined up along the shot.'
  },
  coil: {
    name: 'Arc coil', role: 'CHAIN FIRE', scale: .75, cadence: .96, reach: .95,
    icon: '  ~\\   \n--((o))\n    /~ ',
    description: 'Jumps to two extra enemies. Arc upgrades count double.', downside: 'No blast.'
  },
  mortar: {
    name: 'Flak mortar', role: 'AREA DENIAL', scale: 1.25, cadence: .62, reach: 1.1, unlock: 120,
    icon: '   _   \n  (_)  \n==/ \\==',
    description: 'Shells burst on impact. Blast upgrades count double.', downside: 'No arcs.'
  },
  cryo: {
    name: 'Cryo projector', role: 'CONTROL', scale: .7, cadence: 1.05, reach: .9, unlock: 450,
    icon: '  \\|/  \n--=*=--\n  /|\\  ',
    description: 'Freezing bolts slow the target and anything standing next to it.'
  },
  beam: {
    name: 'Ion beam', role: 'FOCUS', scale: .3, cadence: 3.2, reach: .92, unlock: 250,
    icon: ' .-.   \n(( ))==\n \'-\'   ',
    description: 'A steady beam that grows stronger the longer it holds one target, up to +120%.', downside: 'No arcs. Half blast. Starts over on a new target.'
  },
  pulse: {
    name: 'Pulse ring', role: 'SHOCKWAVE', scale: 1, cadence: .55, reach: .62, unlock: 600,
    icon: ' ( . ) \n( (o) )\n ( . ) ',
    description: 'Hits every hostile close to the Spire at once. Every 3 seconds it also knocks them back.', downside: 'Short reach. No arcs or blast.'
  }
};

// Later weapon types join the pool once enough hostiles have fallen across all runs.
export function availableWeapons(game) {
  const kills = game.progress?.totalKills ?? 0;
  return Object.keys(WEAPONS).filter(key => !WEAPONS[key].unlock || kills >= WEAPONS[key].unlock);
}

export const MOUNT_OUTPUT = [1, .65, .5];
export const MAX_GRADE = 10;
export const GRADE_NAMES = ['Standard', 'Refined', 'Tuned', 'Masterwork', 'Exotic', 'Prime', 'Mythic', 'Legend', 'Ascendant', 'Apex'];
// Each grade adds a little less than the one before, so a weapon keeps growing all run.
const GRADE_SCALE = [1, 1.2, 1.38, 1.54, 1.68, 1.8, 1.9, 2, 2.09, 2.18];
// A weapon gains a random mod when it reaches each of these grades.
export const MOD_GRADES = [3, 6, 9];
// Every find rolls its own damage, fire rate and reach, from -8% to +12%.
export const ROLL_MIN = -8, ROLL_MAX = 12, TEMPER_MAX = 20;
export const ROLL_STATS = { power: 'dmg', cadence: 'rate', reach: 'reach' };

// Each weapon bends the shared upgrades its own way: blasts, arcs or critical hits.
export const ROLE_RULES = {
  bolt: { crit: .08, critPower: 1.125 },
  coil: { chain: 2, splash: 0 },
  mortar: { chain: 0, splash: 2 },
  beam: { chain: 0, splash: .35 },
  pulse: { chain: 0, splash: 0 }
};
// The ion beam ramps by 12% per consecutive hit on the same target.
export const BEAM_RAMP = .12, BEAM_MAX = 1.2;
export const PULSE_PUSH = 5, PULSE_PUSH_EVERY = 3;

// Extra hardpoints are earned by defeating sovereigns, never bought.
export const HARDPOINT_BOSSES = [0, 1, 3];

export function earnHardpoint(game) {
  const slots = game.armory.slots;
  if (slots >= HARDPOINT_BOSSES.length || game.bossKills < HARDPOINT_BOSSES[slots]) return false;
  game.armory.slots++;
  game.note('Hardpoint ' + game.armory.slots + ' opened.', 'upgrade');
  return true;
}

// The forge raises a fitted weapon one grade. Each grade costs more than the last.
export function forgePrice(mount) {
  return mount && mount.grade < MAX_GRADE ? Math.round(120 * 1.52 ** (mount.grade - 1)) : Infinity;
}

// Every found weapon rolls one trait, so the same frame can play differently between runs.
export const TRAITS = {
  rapid: { name: 'Rapid', description: '+20% fire rate.', cadence: 1.2 },
  long: { name: 'Long', description: '+15% reach.', reach: 1.15 },
  heavy: { name: 'Heavy', description: '+35% damage.', downside: '-15% fire rate.', scale: 1.35, cadence: .85 },
  searing: { name: 'Searing', description: 'Hits set the target burning.', burn: .5 },
  forked: { name: 'Forked', description: 'Each hit chains to one more enemy.', chains: 1 },
  keen: { name: 'Keen', description: '+6% critical chance.', crit: .06 },
  chilling: { name: 'Chilling', description: 'Hits slow the target for 2 seconds.', chill: 2 },
  hunting: { name: 'Hunting', description: '+30% damage to elites and sovereigns.', hunter: .3 },
  volatile: { name: 'Volatile', description: 'Kills burst for 40% damage nearby.', burst: .4 },
  capacitor: { name: 'Capacitor', description: 'Every 5th shot deals +150% damage.', charge: 5 }
};

// Mods are rolled at random as a weapon climbs grades, so no two weapons grow alike.
export const MODS = {
  hollow: { name: 'Hollow points', short: '+15% dmg', scale: 1.15 },
  servo: { name: 'Servo feed', short: '+12% rate', cadence: 1.12 },
  optic: { name: 'Scope rail', short: '+12% reach', reach: 1.12 },
  arc: { name: 'Arc emitter', short: '+1 arc', chains: 1 },
  incendiary: { name: 'Igniter', short: 'Hits burn', burn: .3 },
  cryo: { name: 'Coolant line', short: 'Hits slow', chill: 1.5 },
  overpressure: { name: 'Overpressure', short: '+5% crit, +10% crit dmg', crit: .05, critPower: 1.1 },
  ricochet: { name: 'Ricochet', short: 'Kills bounce 50%', bounce: .5 },
  shredder: { name: 'Shredder', short: '+50% vs shields', shred: .5 },
  reaper: { name: 'Culling edge', short: 'Executes below 8%', cull: .08 },
  scavenger: { name: 'Salvage hook', short: 'Kills +1 scrap', loot: 1 },
  twin: { name: 'Twin feed', short: '15% double shot', twin: .15 },
  blast: { name: 'Shell casing', short: 'Small burst 40%', burst: .4 }
};

// A weapon trait plus the matching relic forms a combo.
export const WEAPON_COMBOS = {
  firestorm: { name: 'Firestorm', trait: 'searing', power: 'ember', description: 'Burning enemies spread fire when they die.' },
  stormcell: { name: 'Storm cell', trait: 'forked', power: 'tesla', description: 'Forked weapons chain twice more.' },
  hairtrigger: { name: 'Hair trigger', trait: 'rapid', power: 'overclock', description: 'Rapid weapons fire 15% faster again.' },
  glacier: { name: 'Glacier', trait: 'chilling', power: 'frost', description: 'Chilling weapons freeze targets for 1 second.' },
  manhunt: { name: 'Manhunt', trait: 'hunting', power: 'headhunter', description: 'Hunting weapons deal another +30% to elites and sovereigns.' },
  chainfire: { name: 'Chain fire', trait: 'volatile', power: 'bloom', description: 'Volatile bursts are twice as wide.' },
  overload: { name: 'Overload', trait: 'capacitor', power: 'overclock', description: 'Capacitor weapons charge every 3rd shot.' },
  assassin: { name: 'Assassin', trait: 'keen', power: 'precision', description: 'Keen weapons get another +6% critical chance.' }
};

export function weaponComboActive(game, key) {
  const combo = WEAPON_COMBOS[key];
  return Boolean(combo && game.powers?.[combo.power] && game.armory?.mounts.some(mount => mount.trait === combo.trait));
}

const comboFor = (game, trait) => Object.keys(WEAPON_COMBOS).find(key => WEAPON_COMBOS[key].trait === trait && weaponComboActive(game, key));

// Fire spreads from a burning enemy that dies while Firestorm is active.
export function spreadFire(game, fallen) {
  if (!(fallen.burnUntil > game.time) || !weaponComboActive(game, 'firestorm')) return;
  for (const enemy of game.enemies) {
    if (enemy === fallen || enemy.hp <= 0 || Math.hypot(enemy.x - fallen.x, enemy.y - fallen.y) > 9) continue;
    enemy.burnDps = Math.max(enemy.burnDps, fallen.burnDps);
    enemy.burnUntil = game.time + 3;
  }
  game.effect(fallen.x, fallen.y, 'burn', 9);
}

const validMount = mount => mount && Object.hasOwn(WEAPONS, mount.key);
const pick = (game, list) => list[Math.min(list.length - 1, Math.floor(game.random() * list.length))];
const rollOf = (mount, stat) => 1 + (mount.rolls?.[stat] || 0) / 100;

// All of a mount's trait and mods as one list of effect tables.
function parts(mount) {
  return [TRAITS[mount.trait], ...(mount.mods || []).map(key => MODS[key])].filter(Boolean);
}

export function mountStats(mount, game = null) {
  const weapon = WEAPONS[mount.key];
  const grade = Math.min(MAX_GRADE, Math.max(1, mount.grade || 1));
  const stats = {
    scale: weapon.scale * GRADE_SCALE[grade - 1] * rollOf(mount, 'power'),
    cadence: weapon.cadence * rollOf(mount, 'cadence'),
    reach: weapon.reach * rollOf(mount, 'reach'),
    chains: mount.key === 'coil' ? 2 : 0,
    burn: 0, chill: 0, hunter: 0, burst: 0, crit: 0, critPower: 1, bounce: 0, shred: 0, cull: 0, loot: 0, twin: 0, charge: 0
  };
  for (const part of parts(mount)) {
    for (const key of ['scale', 'cadence', 'reach', 'critPower']) if (part[key]) stats[key] *= part[key];
    for (const key of ['chains', 'burn', 'chill', 'hunter', 'burst', 'crit', 'bounce', 'shred', 'cull', 'loot', 'twin']) if (part[key]) stats[key] += part[key];
    if (part.charge) stats.charge = part.charge;
  }
  return game ? comboBoost(game, mount, stats) : stats;
}

function comboBoost(game, mount, stats) {
  const combo = comboFor(game, mount.trait);
  if (combo === 'stormcell') stats.chains += 2;
  if (combo === 'hairtrigger') stats.cadence *= 1.15;
  if (combo === 'manhunt') stats.hunter += .3;
  if (combo === 'overload') stats.charge = 3;
  if (combo === 'assassin') stats.crit += .06;
  return stats;
}

export function mountTitle(mount) {
  const trait = TRAITS[mount.trait];
  return (trait ? trait.name + ' ' : '') + WEAPONS[mount.key].name + ' G' + (mount.grade || 1);
}

// The rolls and mods that make this copy of a weapon different from the next.
export function rollText(rolls) {
  if (!rolls) return '';
  return Object.entries(ROLL_STATS).map(([key, label]) => (rolls[key] >= 0 ? '+' : '') + rolls[key] + '% ' + label).join('  ');
}

export function modText(mount) {
  return (mount.mods || []).map(key => MODS[key].name + ' (' + MODS[key].short + ')').join(', ');
}

export function describeMount(mount) {
  return [rollText(mount.rolls), modText(mount)].filter(Boolean).join('. ');
}

export function rollStats(game) {
  const roll = () => ROLL_MIN + Math.floor(game.random() * (ROLL_MAX - ROLL_MIN + 1));
  return { power: roll(), cadence: roll(), reach: roll() };
}

// Raise a mount to a grade, rolling a new mod for each mod grade it passes.
export function setGrade(game, mount, grade) {
  const from = mount.grade || 1;
  mount.grade = Math.min(MAX_GRADE, Math.max(from, grade));
  for (const at of MOD_GRADES) {
    if (from < at && mount.grade >= at) {
      const open = Object.keys(MODS).filter(key => !(mount.mods || []).includes(key));
      if (!open.length) continue;
      const mod = pick(game, open);
      mount.mods = [...(mount.mods || []), mod];
      game.note?.(WEAPONS[mount.weapon ?? mount.key].name + ' gained ' + MODS[mod].name + '.', 'upgrade');
    }
  }
  return mount;
}

// The starting weapon is drawn at random; later weapons only come from salvage caches.
export function initWeapons(game, primary = null) {
  const keys = availableWeapons(game);
  const key = Object.hasOwn(WEAPONS, primary) ? primary : pick(game, keys);
  game.armory = { slots: 1, mounts: [{ key, grade: 1, trait: null, cooldown: 0, rolls: rollStats(game), mods: [] }] };
}

// Later finds start at higher grades, so a replacement can keep up with a forged weapon.
export function rollWeapon(game, exclude = []) {
  const keys = availableWeapons(game).filter(key => !exclude.includes(key));
  const pool = keys.length ? keys : availableWeapons(game);
  const weapon = pick(game, pool);
  const trait = pick(game, Object.keys(TRAITS));
  const roll = game.random();
  const floor = Math.floor(Math.min(game.time, 2400) / 600);
  const grade = Math.min(MAX_GRADE, 1 + floor + (roll < .08 + Math.min(.12, game.time / 3000) ? 2 : roll < .38 ? 1 : 0));
  const item = { key: 'arm:' + weapon, weapon, grade: 1, trait, rolls: rollStats(game), mods: [] };
  setGrade({ random: game.random }, item, grade);
  return item;
}

// How each weapon behaves beyond its numbers, for the weapon info panel.
export const WEAPON_HANDLING = {
  bolt: 'Single target',
  scatter: 'Cone, 2 more at 80%',
  lance: 'Pierces 2 more at 85%',
  coil: 'Arcs to 2 more',
  mortar: 'Shell burst 9u at 70%',
  cryo: 'Slows within 7u',
  beam: 'Ramps to +120% on one target',
  pulse: 'Hits all in reach, push every 3s'
};

const one = value => String(Number(value.toFixed(1)));
const percent = value => Math.round(value * 100) + '%';

// The numbers one fitted weapon actually fires with: shared tower stats bent by the
// weapon's role, grade, rolls, trait and mods. Rows are [label, value].
export function weaponReport(game, slot) {
  const mount = game.armory.mounts[slot];
  if (!validMount(mount)) return [];
  const stats = mountStats(mount, game);
  const role = ROLE_RULES[mount.key] || {};
  const crit = Math.min(1, game.critChance + (role.crit || 0) + stats.crit);
  const critDamage = criticalMultiplier(game) * (role.critPower || 1) * stats.critPower;
  const splash = game.splash * (role.splash ?? 1);
  const arcs = role.chain === 0 ? 0 : game.chain * (role.chain ?? 1) + stats.chains;
  const rows = [
    ['Damage', one(game.damage * stats.scale * MOUNT_OUTPUT[slot])],
    ['Fire rate', (game.rate * stats.cadence).toFixed(2) + '/s'],
    ['Range', one(game.range * stats.reach) + 'u'],
    ['Crit', percent(crit)],
    ['Crit dmg', one(critDamage) + 'x'],
    ['Splash', role.splash === 0 ? 'None' : splash ? one(splash) + 'u' : 'Off'],
    ['Arcs', role.chain === 0 ? 'None' : String(arcs)],
    ['Output', percent(MOUNT_OUTPUT[slot])],
    ['Handling', WEAPON_HANDLING[mount.key]]
  ];
  const extras = [];
  if (stats.burn) extras.push('burns');
  if (stats.chill) extras.push('slows');
  if (stats.hunter) extras.push('+' + percent(stats.hunter) + ' elites');
  if (stats.burst) extras.push('kill burst');
  if (stats.bounce) extras.push('kills bounce');
  if (stats.shred) extras.push('+' + percent(stats.shred) + ' shields');
  if (stats.cull) extras.push('executes <' + percent(stats.cull));
  if (stats.twin) extras.push(percent(stats.twin) + ' double shot');
  if (stats.charge) extras.push('every ' + stats.charge + 'th shot +150%');
  if (extras.length) rows.push(['Extras', extras.join(', ')]);
  return rows;
}

export function maxWeaponRange(game) {
  const mounts = game.armory?.mounts?.filter(validMount);
  return mounts?.length ? game.range * Math.max(...mounts.map(m => mountStats(m).reach)) : game.range;
}

// A copy of a maxed weapon tempers its weakest roll instead.
export function temper(mount) {
  if (!mount.rolls) mount.rolls = { power: 0, cadence: 0, reach: 0 };
  const [weakest] = Object.keys(ROLL_STATS).sort((a, b) => mount.rolls[a] - mount.rolls[b]);
  if (mount.rolls[weakest] >= TEMPER_MAX) return null;
  mount.rolls[weakest] = Math.min(TEMPER_MAX, mount.rolls[weakest] + 5);
  return weakest;
}

// Install a found weapon. Returns 'installed', 'upgraded', 'tempered', 'full' (the player must choose a slot) or false.
export function receiveWeapon(game, item) {
  if (!item || !Object.hasOwn(WEAPONS, item.weapon)) return false;
  const { mounts, slots } = game.armory;
  const held = mounts.find(mount => mount.key === item.weapon);
  if (held) {
    if (held.grade >= MAX_GRADE) {
      const stat = temper(held);
      if (!stat) return 'full';
      game.note(mountTitle(held) + ' tempered: ' + ROLL_STATS[stat] + ' ' + held.rolls[stat] + '%.', 'upgrade');
      return 'tempered';
    }
    // A copy keeps the better of each roll and pushes the grade up.
    if (item.rolls) {
      held.rolls = held.rolls || { power: 0, cadence: 0, reach: 0 };
      for (const key of Object.keys(ROLL_STATS)) held.rolls[key] = Math.max(held.rolls[key], item.rolls[key]);
    }
    setGrade(game, held, Math.max(held.grade + 1, item.grade));
    if (!held.trait) held.trait = item.trait;
    game.note(mountTitle(held) + ' reinforced.', 'upgrade');
    return 'upgraded';
  }
  if (mounts.length < slots) {
    const mount = fitted(item, 0);
    mounts.push(mount);
    game.note(mountTitle(mount) + ' fitted to hardpoint ' + mounts.length + '.', 'upgrade');
    return 'installed';
  }
  return 'full';
}

function fitted(item, cooldown) {
  const mount = { key: item.weapon, grade: item.grade, trait: item.trait, cooldown };
  if (item.rolls) mount.rolls = { ...item.rolls };
  if (item.mods) mount.mods = [...item.mods];
  return mount;
}

// Replace the weapon on a hardpoint with a found weapon. Its recharge carries over.
export function replaceWeapon(game, item, slot) {
  const mounts = game.armory.mounts;
  if (!Number.isInteger(slot) || slot < 0 || slot >= mounts.length) return false;
  if (mounts.some((mount, i) => i !== slot && mount.key === item.weapon)) return false;
  const old = mounts[slot];
  mounts[slot] = fitted(item, old.cooldown);
  game.note(mountTitle(mounts[slot]) + ' replaced ' + WEAPONS[old.key].name + ' on hardpoint ' + (slot + 1) + '.', 'upgrade');
  return true;
}

function secondaryTargets(game, target, reach, scatter) {
  const length = Math.hypot(target.x, target.y);
  if (!length) return [];
  const dx = target.x / length, dy = target.y / length;
  const contacts = [];
  for (const enemy of game.enemies) {
    if (enemy === target || enemy.hp <= 0) continue;
    const along = enemy.x * dx + enemy.y * dy;
    const across = Math.abs(enemy.x * dy - enemy.y * dx);
    if (along <= 0 || Math.hypot(enemy.x, enemy.y) > reach) continue;
    if (across <= (scatter ? along * .64 : 3.8)) contacts.push({enemy, along});
  }
  return contacts.sort((a, b) => a.along - b.along).slice(0, 2);
}

function burstAround(game, center, damage, radius) {
  game.effect(center.x, center.y, 'splash', radius);
  for (const enemy of game.enemies) {
    if (enemy !== center && enemy.hp > 0 && Math.hypot(enemy.x - center.x, enemy.y - center.y) <= radius) game.strike(enemy, damage, false);
  }
}

// Push a hostile straight away from the Spire, keeping it on the field.
function shove(enemy, units) {
  const gap = Math.hypot(enemy.x, enemy.y);
  if (gap <= 0) return;
  const factor = (gap + units) / gap;
  enemy.x = Math.max(-139, Math.min(139, enemy.x * factor));
  enemy.y = Math.max(-83, Math.min(83, enemy.y * factor));
}

function fireMount(game, mount, slot, stats, target, reach, bonus = 1) {
  let scale = stats.scale * MOUNT_OUTPUT[slot] * bonus;
  if (stats.charge) {
    mount.shots = ((mount.shots || 0) + 1) % stats.charge;
    if (mount.shots === 0) scale *= 2.5;
  }
  if (slot === 0 && game.powers?.echo && game.relicState) {
    game.relicState.echo = ((game.relicState.echo || 0) + 1) % 4;
    if (game.relicState.echo === 0) scale *= 2;
  }
  if (mount.key === 'beam') {
    mount.focus = mount.beamLock === target.id ? Math.min(Math.round(BEAM_MAX / BEAM_RAMP), (mount.focus || 0) + 1) : 0;
    mount.beamLock = target.id;
    scale *= 1 + BEAM_RAMP * mount.focus;
  }
  if (stats.hunter && (target.elite || target.boss)) scale *= 1 + stats.hunter;
  if (stats.shred && (target.shield > 0 || target.trait === 'plated' || target.type === 'brute')) scale *= 1 + stats.shred;
  const hit = game.fire(target, {
    kind: mount.key === 'bolt' ? 'shot' : mount.key,
    scale,
    extraChains: stats.chains,
    role: { ...ROLE_RULES[mount.key], crit: (ROLE_RULES[mount.key]?.crit || 0) + stats.crit,
      critPower: (ROLE_RULES[mount.key]?.critPower || 1) * stats.critPower },
    reach
  });
  if (stats.burn && target.hp > 0) {
    const remaining = Math.max(0, target.burnUntil - game.time) * target.burnDps;
    target.burnDps = (remaining + hit * stats.burn) / 3;
    target.burnUntil = game.time + 3;
    game.effect(target.x, target.y, 'burn', 3);
  }
  if (stats.chill && target.hp > 0) {
    target.slowUntil = Math.max(target.slowUntil, game.time + stats.chill);
    if (comboFor(game, mount.trait) === 'glacier') target.frozenUntil = game.time + 1;
  }
  if (stats.cull && target.hp > 0 && !target.boss && target.hp <= stats.cull * target.maxHp) game.hurt(target, target.hp + target.shield);
  if (mount.key === 'mortar') {
    game.effect(target.x, target.y, 'splash', 9);
    for (const enemy of game.enemies) {
      if (enemy !== target && enemy.hp > 0 && Math.hypot(enemy.x - target.x, enemy.y - target.y) <= 9) game.strike(enemy, hit * .7, false);
    }
  }
  if (mount.key === 'pulse') {
    game.effect(0, 0, 'pulse', reach, .45);
    // The knockback has its own timer, so a fast pulse cannot pin hostiles in place.
    const push = game.time >= (mount.pushAt || 0);
    if (push) mount.pushAt = game.time + PULSE_PUSH_EVERY;
    for (const enemy of game.enemies) {
      if (enemy.hp <= 0 || Math.hypot(enemy.x, enemy.y) > reach) continue;
      if (enemy !== target) game.strike(enemy, hit, true);
      if (push) shove(enemy, enemy.boss ? PULSE_PUSH * .4 : PULSE_PUSH);
    }
  }
  if (mount.key === 'cryo') {
    for (const enemy of game.enemies) {
      if (enemy.hp > 0 && Math.hypot(enemy.x - target.x, enemy.y - target.y) <= 7) enemy.slowUntil = Math.max(enemy.slowUntil, game.time + 2.5);
    }
    game.effect(target.x, target.y, 'chill', 7, .5);
  }
  if (mount.key === 'scatter' || mount.key === 'lance') {
    const scatter = mount.key === 'scatter';
    for (const {enemy} of secondaryTargets(game, target, reach, scatter)) {
      game.beam(enemy, mount.key);
      game.strike(enemy, hit * (scatter ? .8 : .85), true);
    }
  }
  if (target.hp <= 0) {
    if (stats.burst) burstAround(game, target, hit * stats.burst, comboFor(game, mount.trait) === 'chainfire' ? 14 : 7);
    if (stats.loot) game.scrap += stats.loot;
    if (stats.bounce) {
      const next = game.nearest(target, 24, new Set([target.id]));
      if (next) { game.beam(next, 'twin', target); game.strike(next, hit * stats.bounce, true); }
    }
  }
  return hit;
}

export function fireMounts(game, dt) {
  // Overcharger stalls every weapon briefly; cooldowns still run down meanwhile.
  const stall = stalled(game);
  let lead = null;
  for (const [slot, mount] of game.armory.mounts.entries()) {
    mount.cooldown = Math.max(0, mount.cooldown - dt);
    if (slot === 0 && game.powers?.linked) lead = game.enemies.find(e => e.id === mount.lock && e.hp > 0) || null;
    if (mount.cooldown > 0 || stall) continue;
    const stats = mountStats(mount, game);
    const reach = game.range * stats.reach;
    const inReach = e => e && e.hp > 0 && Math.hypot(e.x, e.y) <= reach;
    const focused = game.focusId && game.enemies.find(e => e.id === game.focusId && inReach(e));
    // Fire link: aux weapons join the primary weapon's target and hit harder.
    const linked = slot > 0 && game.powers?.linked && inReach(lead) ? lead : null;
    const target = focused || linked || game.nearest({x: 0, y: 0}, reach);
    if (!target) continue;
    if (slot === 0) { mount.lock = target.id; lead = target; }
    fireMount(game, mount, slot, stats, target, reach, slot > 0 && game.powers?.linked ? 1.25 : 1);
    if (stats.twin && game.random() < stats.twin) {
      const again = target.hp > 0 ? target : game.nearest({x: 0, y: 0}, reach);
      if (again) fireMount(game, mount, slot, stats, again, reach);
    }
    mount.cooldown = 1 / (game.rate * stats.cadence);
  }
  game.gunClock = game.armory.mounts[0].cooldown;
}
