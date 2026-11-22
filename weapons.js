// Cadence and reach multiply the tower's fire rate and range for each mount.
export const WEAPONS = {
  bolt: {
    name: 'Bolt caster', role: 'PRECISION', scale: 1, cadence: 1.18, reach: 1,
    icon: '  |\\   \n==|=>> \n  |/   ',
    description: 'Fast, accurate single bolts. A steady carrier for critical hits and on-hit effects.'
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
    description: 'Each discharge jumps to two extra enemies. Arc chain adds further jumps.'
  }
};

export const MOUNT_OUTPUT = [1, .65, .5];
export const MAX_GRADE = 3;
export const GRADE_NAMES = ['Standard', 'Refined', 'Masterwork'];
const GRADE_SCALE = [1, 1.25, 1.5];

// Every found weapon rolls one trait, so the same frame can play differently between runs.
export const TRAITS = {
  rapid: { name: 'Rapid', description: '+20% fire rate.', cadence: 1.2 },
  long: { name: 'Long', description: '+15% reach.', reach: 1.15 },
  heavy: { name: 'Heavy', description: '+35% damage, -15% fire rate.', scale: 1.35, cadence: .85 },
  searing: { name: 'Searing', description: 'Hits set the target burning.', burn: .5 },
  forked: { name: 'Forked', description: 'Each hit chains to one more enemy.', chains: 1 }
};

const validMount = mount => mount && Object.hasOwn(WEAPONS, mount.key);

export function mountStats(mount) {
  const weapon = WEAPONS[mount.key];
  const trait = TRAITS[mount.trait] || {};
  const grade = Math.min(MAX_GRADE, Math.max(1, mount.grade || 1));
  return {
    scale: weapon.scale * GRADE_SCALE[grade - 1] * (trait.scale || 1),
    cadence: weapon.cadence * (trait.cadence || 1),
    reach: weapon.reach * (trait.reach || 1),
    chains: (mount.key === 'coil' ? 2 : 0) + (trait.chains || 0),
    burn: trait.burn || 0
  };
}

export function mountTitle(mount) {
  const trait = TRAITS[mount.trait];
  return (trait ? trait.name + ' ' : '') + WEAPONS[mount.key].name + ' G' + (mount.grade || 1);
}

// The starting weapon is drawn at random; later weapons only come from salvage caches.
export function initWeapons(game, primary = null) {
  const keys = Object.keys(WEAPONS);
  const key = Object.hasOwn(WEAPONS, primary) ? primary : keys[Math.min(keys.length - 1, Math.floor(game.random() * keys.length))];
  game.armory = { slots: 1, mounts: [{ key, grade: 1, trait: null, cooldown: 0 }] };
}

export function rollWeapon(game, exclude = []) {
  const keys = Object.keys(WEAPONS).filter(key => !exclude.includes(key));
  const pool = keys.length ? keys : Object.keys(WEAPONS);
  const weapon = pool[Math.min(pool.length - 1, Math.floor(game.random() * pool.length))];
  const traits = Object.keys(TRAITS);
  const trait = traits[Math.min(traits.length - 1, Math.floor(game.random() * traits.length))];
  const roll = game.random();
  const grade = roll < .08 + Math.min(.12, game.time / 3000) ? 3 : roll < .38 ? 2 : 1;
  return { key: 'arm:' + weapon, weapon, grade, trait };
}

export function maxWeaponRange(game) {
  const mounts = game.armory?.mounts?.filter(validMount);
  return mounts?.length ? game.range * Math.max(...mounts.map(m => mountStats(m).reach)) : game.range;
}

export function hardpointPrice(game) {
  const slots = game.armory.slots;
  return slots === 1 ? 180 : slots === 2 ? 1100 : Infinity;
}

// Install a found weapon. Returns 'installed', 'upgraded', 'full' (the player must choose a slot) or false.
export function receiveWeapon(game, item) {
  if (!item || !Object.hasOwn(WEAPONS, item.weapon)) return false;
  const { mounts, slots } = game.armory;
  const held = mounts.find(mount => mount.key === item.weapon);
  if (held) {
    if (held.grade >= MAX_GRADE) return 'full';
    held.grade = Math.min(MAX_GRADE, Math.max(held.grade + 1, item.grade));
    if (!held.trait) held.trait = item.trait;
    game.note(mountTitle(held) + ' reinforced.', 'upgrade');
    return 'upgraded';
  }
  if (mounts.length < slots) {
    const mount = { key: item.weapon, grade: item.grade, trait: item.trait, cooldown: 0 };
    mounts.push(mount);
    game.note(mountTitle(mount) + ' fitted to hardpoint ' + mounts.length + '.', 'upgrade');
    return 'installed';
  }
  return 'full';
}

// Replace the weapon on a hardpoint with a found weapon. Its recharge carries over.
export function replaceWeapon(game, item, slot) {
  const mounts = game.armory.mounts;
  if (!Number.isInteger(slot) || slot < 0 || slot >= mounts.length) return false;
  if (mounts.some((mount, i) => i !== slot && mount.key === item.weapon)) return false;
  const old = mounts[slot];
  mounts[slot] = { key: item.weapon, grade: item.grade, trait: item.trait, cooldown: old.cooldown };
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

export function fireMounts(game, dt) {
  for (const [slot, mount] of game.armory.mounts.entries()) {
    mount.cooldown = Math.max(0, mount.cooldown - dt);
    if (mount.cooldown > 0) continue;
    const stats = mountStats(mount);
    const reach = game.range * stats.reach;
    const focused = game.focusId && game.enemies.find(e => e.id === game.focusId && e.hp > 0 && Math.hypot(e.x, e.y) <= reach);
    const target = focused || game.nearest({x: 0, y: 0}, reach);
    if (!target) continue;
    const hit = game.fire(target, {
      kind: mount.key === 'bolt' ? 'shot' : mount.key,
      scale: stats.scale * MOUNT_OUTPUT[slot],
      extraChains: stats.chains,
      reach
    });
    if (stats.burn && target.hp > 0) {
      const remaining = Math.max(0, target.burnUntil - game.time) * target.burnDps;
      target.burnDps = (remaining + hit * stats.burn) / 3;
      target.burnUntil = game.time + 3;
      game.effect(target.x, target.y, 'burn', 3);
    }
    if (mount.key === 'scatter' || mount.key === 'lance') {
      const scatter = mount.key === 'scatter';
      for (const {enemy} of secondaryTargets(game, target, reach, scatter)) {
        game.beam(enemy, mount.key);
        game.strike(enemy, hit * (scatter ? .8 : .85), true);
      }
    }
    mount.cooldown = 1 / (game.rate * stats.cadence);
  }
  game.gunClock = game.armory.mounts[0].cooldown;
}
