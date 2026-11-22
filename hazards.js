// Elite traits, cursed cards and routes: the run's random pressure and tradeoffs.

// Elites roll one trait. The names mirror weapon traits so each reads as a counter.
export const ELITE_TRAITS = {
  swift: { name: 'Swift', mark: '>', description: 'Moves 30% faster.' },
  plated: { name: 'Plated', mark: '#', description: 'Takes 30% less damage.' },
  warded: { name: 'Warded', mark: ')', description: 'Carries a recharging shield.' },
  mending: { name: 'Mending', mark: '+', description: 'Regenerates 3% integrity each second.' },
  volatile: { name: 'Volatile', mark: '*', description: 'Bursts into two crawlers when destroyed.' }
};

export function rollEliteTrait(game) {
  const keys = Object.keys(ELITE_TRAITS);
  return keys[Math.min(keys.length - 1, Math.floor(game.random() * keys.length))];
}

export function applyEliteTrait(enemy, trait) {
  enemy.trait = trait;
  if (trait === 'swift') enemy.speed *= 1.3;
  if (trait === 'warded' && !enemy.maxShield) enemy.shield = enemy.maxShield = Math.round(enemy.maxHp * .4);
}

// Cursed cards: rare cache cards with a lasting upside and downside.
export const CURSES = {
  glass: { name: 'Glass core', upside: '+40% damage', downside: '-30% max integrity' },
  hunger: { name: 'Hungry guns', upside: '+25% fire rate', downside: 'Repairs cost double' },
  greed: { name: 'Greed', upside: '+50% scrap from kills', downside: 'Hostiles have +15% integrity' }
};

export const cursed = (game, key) => Boolean(game.curses?.includes(key));

export function applyCurse(game, key) {
  if (!Object.hasOwn(CURSES, key) || cursed(game, key)) return false;
  game.curses = [...(game.curses || []), key];
  if (key === 'glass') {
    game.maxHp = Math.max(1, Math.round(game.maxHp * .7));
    game.hp = Math.min(game.hp, game.maxHp);
  }
  game.note('Curse taken: ' + CURSES[key].name + '.', 'event');
  return true;
}

// Routes: after each sovereign, pick what the next stretch of the run brings.
export const ROUTES = {
  convoy: { name: 'Iron convoy', foes: 'Armored column', reward: '+25% scrap', weights: { brute: 3, aegis: 3 } },
  swarm: { name: 'Moth swarm', foes: 'Fast swarm', reward: 'Free cache after', weights: { moth: 3, crawler: 2 } },
  haunt: { name: 'Wraith host', foes: 'Wraiths and healers', reward: 'Repair 30% after', weights: { wraith: 3, cantor: 2.5 } }
};
export const ROUTE_LENGTH = 150;
export const ROUTE_WINDOW = 20;

export function offerRoute(game) {
  const keys = Object.keys(ROUTES);
  const first = keys[Math.min(keys.length - 1, Math.floor(game.random() * keys.length))];
  const rest = keys.filter(key => key !== first);
  const second = rest[Math.min(rest.length - 1, Math.floor(game.random() * rest.length))];
  game.route = { options: [first, second], expires: game.time + ROUTE_WINDOW };
}

export function chooseRoute(game, index) {
  const key = game.route?.options[index];
  if (!key || !['running', 'paused'].includes(game.status)) return false;
  game.route = null;
  game.path = { key, until: game.time + ROUTE_LENGTH };
  game.note('Route: ' + ROUTES[key].name + '.', 'event');
  return true;
}

export function routeActive(game, key) {
  return game.path?.key === key && game.time < game.path.until;
}

export function routeWeight(game, type) {
  return game.path && game.time < game.path.until ? ROUTES[game.path.key].weights[type] ?? 1 : 1;
}

export function tickRoutes(game) {
  if (game.route && game.time >= game.route.expires) chooseRoute(game, 0);
  if (!game.path || game.time < game.path.until) return;
  const { key } = game.path;
  game.path = null;
  if (key === 'swarm') game.workshop.caches++;
  if (key === 'haunt') game.hp = Math.min(game.maxHp, game.hp + Math.ceil(game.maxHp * .3));
  game.note(ROUTES[key].name + ' cleared. ' + ROUTES[key].reward.replace(' after', '') + '.', 'upgrade');
}
