// Lifetime kills double as a currency for small permanent starting boosts.
const KEY = 'last-spire.perks.v1';

export const PERKS = {
  purse: { name: 'Deep pockets', cost: 100, effect: '+30 starting scrap' },
  stash: { name: 'Hidden stash', cost: 150, effect: 'Start with an extra cache' },
  veteran: { name: 'Veteran arms', cost: 250, effect: 'Start with a G2 weapon' },
  bastion: { name: 'Bastion', cost: 400, effect: '+15 max integrity' }
};

export function readPerks(storage) {
  let data;
  try { data = JSON.parse(storage?.getItem(KEY)); } catch { /* Storage is optional. */ }
  const spent = Number.isSafeInteger(data?.spent) && data.spent >= 0 ? data.spent : 0;
  const owned = Array.isArray(data?.owned) ? [...new Set(data.owned.filter(key => Object.hasOwn(PERKS, key)))] : [];
  return { spent, owned };
}

export function perkBank(game) {
  return Math.max(0, (game.progress?.totalKills || 0) - readPerks(game.storage).spent);
}

export function buyPerk(game, key) {
  const perks = readPerks(game.storage);
  if (!Object.hasOwn(PERKS, key) || perks.owned.includes(key) || perkBank(game) < PERKS[key].cost) return false;
  const next = { spent: perks.spent + PERKS[key].cost, owned: [...perks.owned, key] };
  try { game.storage?.setItem(KEY, JSON.stringify(next)); } catch { return false; }
  return true;
}

// Daily challenges skip perks so every player starts equal.
export function applyPerks(game) {
  if (game.daily) return;
  const { owned } = readPerks(game.storage);
  if (owned.includes('purse')) game.scrap += 30;
  if (owned.includes('stash')) game.workshop.caches++;
  if (owned.includes('veteran')) game.armory.mounts[0].grade = 2;
  if (owned.includes('bastion')) { game.maxHp += 15; game.hp += 15; }
}
