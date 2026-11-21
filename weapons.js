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

export function initWeapons(game, primary = 'bolt') {
  game.armory = { mounts: [{ key: Object.hasOwn(WEAPONS, primary) ? primary : 'bolt', cooldown: 0 }], refits: 0 };
}

export function maxWeaponRange(game) {
  const mounts = game.armory?.mounts;
  return mounts?.length ? game.range * Math.max(...mounts.map(m => WEAPONS[m.key].reach)) : game.range;
}

export function mountPrice(game, slot) {
  const { mounts, refits } = game.armory;
  if (!Number.isInteger(slot) || slot < 0 || slot >= MOUNT_OUTPUT.length || slot > mounts.length) return Infinity;
  if (slot === mounts.length) return slot === 1 ? 180 : 1100;
  if (slot === 0 && !refits && game.time < 120) return 0;
  return 35 + 7 * (game.threat - 1) + 10 * refits;
}

export function weaponCost(game, key, slot) {
  if (!Object.hasOwn(WEAPONS, key) || game.armory.mounts.some(mount => mount.key === key)) return Infinity;
  return mountPrice(game, slot);
}

export function equipWeapon(game, key, slot) {
  const cost = weaponCost(game, key, slot);
  if (!['paused', 'running'].includes(game.status) || !Number.isFinite(cost) || game.scrap < cost) return false;
  const replacing = slot < game.armory.mounts.length;
  game.scrap -= cost;
  if (replacing) game.armory.refits++;
  // Refitting a loaded weapon cannot be used to bypass its recharge.
  const cooldown = Math.max(game.armory.mounts[slot]?.cooldown || 0, 1 / (game.rate * WEAPONS[key].cadence));
  game.armory.mounts[slot] = { key, cooldown };
  game.note(WEAPONS[key].name + ' fitted to mount ' + (slot + 1) + '.', 'upgrade');
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
    const weapon = WEAPONS[mount.key];
    const reach = game.range * weapon.reach;
    const focused = game.focusId && game.enemies.find(e => e.id === game.focusId && e.hp > 0 && Math.hypot(e.x, e.y) <= reach);
    const target = focused || game.nearest({x: 0, y: 0}, reach);
    if (!target) continue;
    const hit = game.fire(target, {
      kind: mount.key === 'bolt' ? 'shot' : mount.key,
      scale: weapon.scale * MOUNT_OUTPUT[slot],
      extraChains: mount.key === 'coil' ? 2 : 0,
      reach
    });
    if (mount.key === 'scatter' || mount.key === 'lance') {
      const scatter = mount.key === 'scatter';
      for (const {enemy} of secondaryTargets(game, target, reach, scatter)) {
        game.beam(enemy, mount.key);
        game.strike(enemy, hit * (scatter ? .8 : .85), true);
      }
    }
    mount.cooldown = 1 / (game.rate * weapon.cadence);
  }
  game.gunClock = game.armory.mounts[0].cooldown;
}
