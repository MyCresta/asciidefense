// Combat hooks only use elapsed fight time, installed stacks and existing combat state.
export function stat(game, key, base) {
  const p = game.powers;
  switch (key) {
    case 'range':
      return Math.max(8, base * (p.rail ? 1.30 : 1) - (p.ballast ? 7 : 0));
    case 'rate': {
      let rate = base;
      if (p.clockwork && game.time % 12 < 3) rate *= 1.45;
      if (p.redline && game.hp < game.maxHp / 2) rate *= 1.55;
      if (p.repeater) rate *= 1.45;
      return p.rail ? rate * .88 : rate;
    }
    case 'damage': {
      let damage = base;
      if (p.glass) damage *= 1.45;
      if (p.repeater) damage *= .8;
      if (p.regicide) damage *= 1 + .22 * Math.min(game.bossKills, 4);
      return damage;
    }
    case 'splash': return p.mesh ? base * .5 : base;
    case 'chain': return base + (p.mesh ? 2 : 0);
    case 'critChance': return Math.min(1, base + (p.caliper || 0) * .08 + (p.precision ? .25 : 0));
    case 'armor': return base + (p.bulwark || 0) * 2;
    case 'regen': return base + (game.hp < game.maxHp / 2 ? (p.triage || 0) * .7 : 0);
    default: return base;
  }
}

function inRadius(point, center, radius) {
  return (point.x - center.x) ** 2 + (point.y - center.y) ** 2 <= radius * radius;
}

const CORE = { x: 0, y: 0 };

export function hitFactor(game, target, direct) {
  const p = game.powers;
  let factor = 1;
  if (p.longshot && !inRadius(target, CORE, 32)) factor *= 1.3;
  if (p.buckshot && inRadius(target, CORE, 18)) factor *= 1.35;
  if (p.firstblood && direct && target.hp === target.maxHp) factor *= 1.45;
  if (p.spotter && target.id === game.focusId) factor *= 1.35;
  if (p.packhunter) {
    let neighbors = 0;
    for (const other of game.enemies) {
      if (other !== target && other.hp > 0 && inRadius(target, other, 12) && ++neighbors === 2) {
        factor *= 1.4;
        break;
      }
    }
  }
  return factor;
}

export function speed(game, target, base) {
  if (game.powers.stasis && game.time % 12 < 2 && inRadius(target, CORE, game.range)) return 0;
  if (game.powers.crowfoot && inRadius(target, CORE, 16)) return base * .8;
  return base;
}

export function criticalMultiplier(game) {
  return game.powers.precision ? 1.6 : 2;
}

export function cost(game, price) {
  return Math.max(1, Math.round(price * (1 - .08 * (game.powers.foundry || 0))));
}

export function bounty(game, enemy, base) {
  return base + (game.powers.poacher && inRadius(enemy, CORE, 18) ? 3 : 0);
}

function burst(game, center, radius, damage) {
  game.effect(center.x, center.y, 'splash', radius);
  for (const enemy of game.enemies) {
    if (enemy !== center && enemy.hp > 0 && inRadius(enemy, center, radius)) game.hurt(enemy, damage);
  }
}

export function onCritical(game, target, amount) {
  if (game.powers.galvanic && game.hp > 0) game.hp = Math.min(game.maxHp, game.hp + 1);
  if (game.powers.tracer) burst(game, target, 11, amount * .5);
}

export function onFire(game, target) {
  if (game.powers.execute && !target.boss && target.hp > 0 && target.hp <= .15 * target.maxHp) {
    game.hurt(target, target.hp + target.shield);
    game.effect(target.x, target.y, 'crit', 7);
  }
}

export function onDeath(game, enemy) {
  if (game.powers.bloom) burst(game, enemy, 13, game.damage * .8);
}

export function impact(game, enemy, base) {
  const damage = game.powers.glass ? Math.ceil(base * 1.25) : base;
  if (game.powers.returnfire) burst(game, CORE, 22, damage * 2);
  if (game.powers.fuse && !game.fuseUsed && game.hp > 0 && damage >= game.hp) {
    game.fuseUsed = true;
    game.effect(0, 0, 'ward', 15, .8);
    game.note('Phoenix fuse burned. Core restored to 40%.', 'system');
    // The caller subtracts this signed delta; a depleted core can finish above its previous HP.
    return game.hp - game.maxHp * .4;
  }
  return damage;
}

export function onPick(game, key) {
  if (key === 'ballast') {
    game.maxHp += 40;
    game.hp += 40;
  }
  if (game.powers.royalty) game.scrap += 18;
}

function crossedPeriod(time, dt, period) {
  return Math.floor((time + 1e-9) / period) > Math.floor((time - dt + 1e-9) / period);
}

export function onTick(game, dt) {
  const p = game.powers;
  if (p.stipend && crossedPeriod(game.time, dt, 20)) game.scrap += 5 * p.stipend;
  if (p.mortar && crossedPeriod(game.time, dt, 16)) {
    let target = null;
    for (const enemy of game.enemies) {
      if (enemy.hp > 0 && inRadius(enemy, CORE, game.range) && (!target || enemy.hp > target.hp)) target = enemy;
    }
    if (target) {
      game.beam(target, 'crit');
      game.hurt(target, 2 * game.damage);
    }
  }
  if (p.horizon && crossedPeriod(game.time, dt, 30)) {
    for (const enemy of game.enemies) {
      if (enemy.hp <= 0) continue;
      game.effect(enemy.x, enemy.y, 'crit', 4);
      game.hurt(enemy, 2 * game.damage);
    }
  }
}
