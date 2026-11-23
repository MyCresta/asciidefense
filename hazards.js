import { setGrade } from './weapons.js?v=3.11.0';
// Elite traits and cursed cards: the run's random pressure and tradeoffs.

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
  greed: { name: 'Greed', upside: '+50% scrap from kills', downside: 'Hostiles have +15% integrity' },
  frenzy: { name: 'Frenzy', upside: '+30% fire rate', downside: 'Hostiles move 10% faster' },
  debt: { name: 'Blood debt', upside: 'Install two random relics now', downside: 'Sovereigns have +30% integrity' },
  rust: { name: 'Rust', upside: 'Every fitted weapon gains 2 grades', downside: 'Armor upgrades do nothing' }
};

export const cursed = (game, key) => Boolean(game.curses?.includes(key));

export function applyCurse(game, key) {
  if (!Object.hasOwn(CURSES, key) || cursed(game, key)) return false;
  game.curses = [...(game.curses || []), key];
  if (key === 'glass') {
    game.maxHp = Math.max(1, Math.round(game.maxHp * .7));
    game.hp = Math.min(game.hp, game.maxHp);
  }
  if (key === 'debt') for (let i = 0; i < 2; i++) game.wildRelic?.();
  if (key === 'rust') for (const mount of game.armory.mounts) setGrade(game, mount, mount.grade + 2);
  game.note('Curse taken: ' + CURSES[key].name + '.', 'event');
  return true;
}
