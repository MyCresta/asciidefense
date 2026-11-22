// Elite traits and timed bargains: the run's random pressure and risky offers.

// Elites roll one trait. The names mirror weapon traits so each reads as a counter.
export const ELITE_TRAITS = {
  swift: { name: 'Swift', mark: '>', description: 'Moves 30% faster.' },
  plated: { name: 'Plated', mark: '#', description: 'Takes 30% less damage.' },
  warded: { name: 'Warded', mark: ')', description: 'Carries a recharging shield.' },
  mending: { name: 'Mending', mark: '+', description: 'Regenerates 3% integrity each second.' },
  volatile: { name: 'Volatile', mark: '*', description: 'Bursts into two crawlers when destroyed.' }
};

// A bargain is offered on the battlefield and lasts for a short window once accepted.
export const BARGAINS = {
  goldrush: {
    name: 'Gold rush', duration: 60,
    upside: 'Kills pay 60% more scrap.', downside: 'Hostiles move 25% faster.'
  },
  overdrive: {
    name: 'Overdrive', duration: 45,
    upside: 'Weapons fire 35% faster.', downside: 'Core hits deal 50% more damage.'
  },
  bloodprice: {
    name: 'Blood price', duration: 60,
    upside: 'Take a scrap payment now.', downside: 'Elite hostiles become far more common.'
  },
  lull: {
    name: 'Ceasefire', duration: 40,
    upside: 'Hostiles arrive 40% less often.', downside: 'Kills pay no scrap.'
  },
  blackmarket: {
    name: 'Black market', duration: 0,
    upside: 'Two salvage caches now.', downside: 'Costs 40% of your scrap.'
  }
};

export const BARGAIN_FIRST = 95;
export const BARGAIN_PERIOD = 150;
export const BARGAIN_WINDOW = 18;

export function rollEliteTrait(game) {
  const keys = Object.keys(ELITE_TRAITS);
  return keys[Math.min(keys.length - 1, Math.floor(game.random() * keys.length))];
}

export function applyEliteTrait(enemy, trait) {
  enemy.trait = trait;
  if (trait === 'swift') enemy.speed *= 1.3;
  if (trait === 'warded' && !enemy.maxShield) enemy.shield = enemy.maxShield = Math.round(enemy.maxHp * .4);
}

export function boonActive(game, key) {
  return game.boon?.key === key && game.time < game.boon.until;
}

export function bloodPrice(game) {
  return 60 + 15 * game.threat;
}

export function describeBargain(game, key) {
  const bargain = BARGAINS[key];
  const upside = key === 'bloodprice' ? 'Take $' + bloodPrice(game) + ' now.' : bargain.upside;
  const downside = key === 'blackmarket' ? 'Costs $' + Math.floor(game.scrap * .4) + ' (40% of your scrap).' : bargain.downside;
  return { name: bargain.name, upside, downside, duration: bargain.duration };
}

// Offer a new bargain on schedule; withdraw an unanswered one when its window closes.
export function tickBargains(game) {
  if (game.bargain && game.time >= game.bargain.expires) {
    game.note(BARGAINS[game.bargain.key].name + ' offer withdrawn.', 'system');
    game.bargain = null;
  }
  if (game.boon && game.time >= game.boon.until) {
    game.note(BARGAINS[game.boon.key].name + ' has ended.', 'system');
    game.boon = null;
  }
  if (game.time < game.nextBargain) return;
  game.nextBargain += BARGAIN_PERIOD;
  if (game.bargain || game.boon) return;
  const keys = Object.keys(BARGAINS).filter(key => key !== game.lastBargain);
  const key = keys[Math.min(keys.length - 1, Math.floor(game.random() * keys.length))];
  game.bargain = { key, expires: game.time + BARGAIN_WINDOW };
  game.lastBargain = key;
  game.note('Bargain offered: ' + BARGAINS[key].name + '.', 'event');
}

export function answerBargain(game, accept) {
  if (!game.bargain || !['running', 'paused'].includes(game.status)) return false;
  const { key } = game.bargain;
  game.bargain = null;
  if (!accept) {
    game.note(BARGAINS[key].name + ' declined.', 'system');
    return true;
  }
  const bargain = BARGAINS[key];
  if (key === 'bloodprice') game.scrap += bloodPrice(game);
  if (key === 'blackmarket') {
    game.scrap -= Math.floor(game.scrap * .4);
    game.workshop.caches += 2;
  }
  if (game.stats) game.stats.bargains++;
  if (bargain.duration) game.boon = { key, until: game.time + bargain.duration };
  game.note('Bargain struck: ' + bargain.name + '.', 'event');
  return true;
}
