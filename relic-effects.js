// Combat hooks only use elapsed fight time, installed stacks and existing combat state.
// Bonuses of the same kind add together, so stacking relics grows power steadily instead of exponentially.
export function stat(game, key, base) {
  const p = game.powers;
  switch (key) {
    case 'range':
      return Math.max(8, base * (p.rail ? 1.30 : 1) - (p.ballast ? 7 : 0));
    case 'rate': {
      let bonus = .15 * (p.overclock || 0);
      if (p.clockwork && game.time % 12 < 3) bonus += .45;
      if (p.redline && game.hp < game.maxHp / 2) bonus += .4;
      if (p.repeater) bonus += .35;
      if (p.quickdraw && game.hp >= game.maxHp) bonus += .2;
      if (p.warcry && game.enemies.some(enemy => enemy.boss)) bonus += .3;
      if (p.overdrive && game.time % 45 < 6) bonus += 1;
      if (p.momentum) bonus += momentum(game);
      return base * (1 + bonus) * (p.rail ? .88 : 1);
    }
    case 'damage': {
      let bonus = 0;
      if (p.glass) bonus += .35;
      if (p.regicide) bonus += .15 * Math.min(game.bossKills, 4);
      // Hoard: banked scrap sharpens every shot, so saving up is a real choice.
      if (p.hoard) bonus += Math.min(.3, Math.max(0, game.scrap) / 3333);
      return base * (1 + bonus) * (p.repeater ? .8 : 1);
    }
    case 'splash': return p.mesh ? base * .5 : base;
    case 'chain': return base + (p.mesh ? 2 : 0) + Number(game.synergyActive?.('supercell') || false);
    case 'critChance': return Math.min(1, base + (p.caliper || 0) * .08 + (p.precision ? .18 : 0) + (p.deadeye || 0) * .06);
    case 'armor': return base + (p.bulwark || 0) * 2 + (p.plating && game.time < (game.relicState?.plateUntil || 0) ? 6 : 0);
    case 'regen': return base + (game.hp < game.maxHp / 2 ? (p.triage || 0) * .7 : 0);
    default: return base;
  }
}

// Momentum: stacks from recent kills, each lasting four seconds.
function momentum(game) {
  const state = game.relicState;
  return state && game.time < state.streakUntil ? Math.min(.3, .03 * state.streak) : 0;
}

function inRadius(point, center, radius) {
  return (point.x - center.x) ** 2 + (point.y - center.y) ** 2 <= radius * radius;
}

const CORE = { x: 0, y: 0 };

const FAST = new Set(['moth', 'wraith']);

export function hitFactor(game, target, direct) {
  const p = game.powers;
  let bonus = 0;
  if (p.longshot && !inRadius(target, CORE, 32)) bonus += .3;
  if (p.buckshot && inRadius(target, CORE, 18)) bonus += .35;
  if (p.firstblood && direct && target.hp === target.maxHp) bonus += .45;
  if (p.spotter && target.id === game.focusId) bonus += .35;
  if (p.coldblood && target.slowUntil > game.time) bonus += p.coldblood > 1 ? .5 : .3;
  if (p.pyre && target.burnUntil > game.time) bonus += p.pyre > 1 ? .45 : .25;
  if (p.headhunter && target.tier >= 3) bonus += .4;
  if (p.slug && (target.shield > 0 || target.trait === 'plated' || target.type === 'brute')) bonus += .3;
  if (p.tracker && (FAST.has(target.type) || target.trait === 'swift')) bonus += .25;
  if (p.tarpit && inRadius(target, CORE, tarRadius(game))) bonus += .1;
  if (target.elite || target.boss) bonus += .08 * (game.levels?.hunter || 0);
  if (p.packhunter) {
    let neighbors = 0;
    for (const other of game.enemies) {
      if (other !== target && other.hp > 0 && inRadius(target, other, 12) && ++neighbors === 2) {
        bonus += .4;
        break;
      }
    }
  }
  return 1 + bonus;
}

const tarRadius = game => game.synergyActive?.('killzone') ? 34 : 24;

// Extra critical chance against this particular target.
export function critBonus(game, target) {
  return game.powers.brittle && target.slowUntil > game.time ? .15 : 0;
}

export function speed(game, target, base) {
  if (game.powers.stasis && game.time % 12 < 2 && inRadius(target, CORE, game.range)) return 0;
  if (target.frozenUntil > game.time) return 0;
  let speed = base;
  if (game.powers.crowfoot && inRadius(target, CORE, 16)) speed *= .8;
  if (game.powers.tarpit && inRadius(target, CORE, tarRadius(game))) speed *= .85;
  if (game.powers.anchor && (target.elite || target.boss)) speed *= .75;
  // Time dilation: hostiles slow down the closer they get, down to half speed.
  if (game.powers.dilation) speed *= .5 + .5 * Math.min(1, Math.hypot(target.x, target.y) / 30);
  return speed;
}

// Burns: kindling and its combo make every burn tick harder.
export function burnFactor(game) {
  return 1 + (game.powers.kindling ? .5 : 0) + (game.synergyActive?.('meltdown') ? .5 : 0);
}

// A direct shot that destroys its target: carry the excess on, or bounce a new shot.
export function onKillShot(game, target, excess) {
  const p = game.powers;
  if (!p.overkill && !p.ricochet) return;
  const struck = new Set([target.id]);
  const next = game.nearest(target, 26, struck);
  if (!next) return;
  if (p.overkill && excess > 0) { game.beam(next, 'chain', target); game.strike(next, excess); }
  if (p.ricochet && next.hp > 0) { game.beam(next, 'twin', target); game.strike(next, game.damage * .6, true); }
  if (p.ricochet > 1) {
    struck.add(next.id);
    const third = game.nearest(target, 26, struck);
    if (third) { game.beam(third, 'twin', target); game.strike(third, game.damage * .6, true); }
  }
}

// Midas gear: every 25th kill drops a burst of scrap.
export function midas(game, previous, kills) {
  const every = game.powers.midas > 1 ? 15 : 25;
  const bursts = Math.floor(kills / every) - Math.floor(previous / every);
  if (bursts <= 0) return;
  const value = bursts * (15 + 3 * game.threat);
  game.scrap += value;
  game.effect(0, 0, 'cache', 6, .8);
  game.note('Midas gear paid +' + value + ' scrap.', 'upgrade');
}

export function criticalMultiplier(game) {
  return (game.powers.precision ? 1.6 : 2) + .1 * (game.levels?.lethality || 0)
    + .15 * (game.powers.deadeye || 0) + (game.synergyActive?.('executioner') ? .25 : 0);
}

export function cost(game, price) {
  return Math.max(1, Math.round(price * (1 - .08 * (game.powers.foundry || 0))));
}

export function bounty(game, enemy, base) {
  return base + (game.powers.poacher && inRadius(enemy, CORE, 18) ? 3 : 0)
    + ((enemy.elite || enemy.boss) && game.synergyActive?.('bountyhunter') ? 10 : 0);
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
  if (game.powers.prism) {
    const struck = new Set([target.id]);
    for (let i = 0; i < 2; i++) {
      const next = game.nearest(target, 20, struck);
      if (!next) break;
      struck.add(next.id);
      game.beam(next, 'chain', target);
      game.hurt(next, amount * .5);
    }
  }
}

export function onFire(game, target) {
  const line = game.powers.execute > 1 ? .2 : .15;
  if (game.powers.execute && !target.boss && target.hp > 0 && target.hp <= line * target.maxHp) {
    game.hurt(target, target.hp + target.shield);
    game.effect(target.x, target.y, 'crit', 7);
  }
}

export function onDeath(game, enemy) {
  const p = game.powers;
  if (p.bloom) burst(game, enemy, p.bloom > 1 ? 17 : 13, game.damage * (p.bloom > 1 ? 1.1 : .8));
  if (p.momentum && game.relicState) {
    const state = game.relicState;
    state.streak = game.time < state.streakUntil ? Math.min(10, state.streak + 1) : 1;
    state.streakUntil = game.time + 4;
  }
  if (p.lifeline && enemy.boss) game.hp = Math.min(game.maxHp, game.hp + game.maxHp * .3);
}

export function impact(game, enemy, base) {
  let damage = game.powers.glass ? Math.ceil(base * 1.25) : base;
  if (game.powers.bulkhead) damage = Math.min(damage, Math.ceil(game.maxHp * .12));
  if (game.powers.plating && game.relicState) game.relicState.plateUntil = game.time + 3;
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
  if (key === 'overshield') game.barrier = barrierCap(game);
  if (game.powers.royalty) game.scrap += 18;
}

function crossedPeriod(time, dt, period) {
  return Math.floor((time + 1e-9) / period) > Math.floor((time - dt + 1e-9) / period);
}

// Barrier: a recharging shield over the core from the Barrier upgrade and Overshield.
export function barrierCap(game) {
  return 6 * (game.levels?.barrier || 0) + (game.powers.overshield ? 15 : 0);
}

function tickBarrier(game, dt) {
  const cap = barrierCap(game);
  if (!cap) return;
  const quiet = game.synergyActive?.('fortress') ? 2 : 4;
  if (game.time - (game.relicState?.hitAt ?? -Infinity) < quiet) return;
  game.barrier = Math.min(cap, (game.barrier || 0) + dt * cap / (game.powers.overshield ? 2.5 : 5));
}

function strongest(game, count) {
  return game.enemies.filter(enemy => enemy.hp > 0 && inRadius(enemy, CORE, game.range))
    .sort((a, b) => b.hp - a.hp).slice(0, count);
}

export function onTick(game, dt) {
  const p = game.powers;
  tickBarrier(game, dt);
  if (p.stipend && crossedPeriod(game.time, dt, 20)) game.scrap += 5 * p.stipend;
  if (p.tithe && crossedPeriod(game.time, dt, 30)) {
    const rush = game.synergyActive?.('goldrush');
    game.scrap += Math.min(rush ? 40 : 20, Math.floor(game.scrap * (rush ? .03 : .02)));
  }
  if (p.static && crossedPeriod(game.time, dt, 8)) {
    const targets = game.enemies.filter(enemy => enemy.hp > 0 && inRadius(enemy, CORE, game.range));
    for (let i = 0; i < 4 && targets.length; i++) {
      const [target] = targets.splice(Math.floor(game.random() * targets.length), 1);
      game.beam(target, 'chain');
      game.hurt(target, game.damage);
    }
  }
  if (p.starfall && crossedPeriod(game.time, dt, 20)) {
    for (const target of strongest(game, 3)) {
      game.effect(target.x, target.y, 'crit', 6);
      game.hurt(target, 3 * game.damage);
    }
  }
  if (p.nova && crossedPeriod(game.time, dt, 15)) {
    const hold = game.synergyActive?.('permafrost') ? 3 : 1.5;
    game.effect(0, 0, 'chill', 25, .6);
    for (const enemy of game.enemies) if (enemy.hp > 0 && inRadius(enemy, CORE, 25)) enemy.frozenUntil = game.time + hold;
  }
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
  if (p.horizon && crossedPeriod(game.time, dt, p.horizon > 1 ? 20 : 30)) {
    for (const enemy of game.enemies) {
      if (enemy.hp <= 0) continue;
      game.effect(enemy.x, enemy.y, 'crit', 4);
      game.hurt(enemy, 2 * game.damage);
    }
  }
}
