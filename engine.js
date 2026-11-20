export const ENEMIES = {
  crawler: { name: 'Crawler', description: 'A low-slung scavenger with a serrated shell.', hp: 7, speed: 1.65, damage: 8, reward: 3 },
  wraith: { name: 'Wraith', description: 'A drifting specter drawn to the spire signal.', hp: 12, speed: 1.85, damage: 10, reward: 4 },
  brute: { name: 'Brute', description: 'Heavy armor shields a close-range battering ram.', hp: 23, speed: 1.05, damage: 18, reward: 6 },
  moth: { name: 'Moth', description: 'A fragile flier with a dangerously fast approach.', hp: 5, speed: 2.75, damage: 5, reward: 2 }
};

export const UPGRADES = {
  range: { name: 'Range', label: 'Range', maxLevel: 10 },
  rate: { name: 'Attack speed', label: 'Attack speed', maxLevel: 10 },
  splash: { name: 'Splash', label: 'Splash', maxLevel: 10 }
};

const BLUEPRINTS = [
  { name: 'Salvage cache', kills: 20, description: 'Start each run with 10 extra scrap.' },
  { name: 'Tempered core', kills: 65, description: 'Deal 2 extra damage per shot.' },
  { name: 'Wideband optics', kills: 160, description: 'Start with a free range upgrade.' },
  { name: 'Fragment lens', kills: 340, description: 'Start with splash enabled.' },
  { name: 'Rapid relay', kills: 650, description: 'Start with a free attack speed upgrade.' }
];

const RECOVERIES = [
  { name: 'Prism shard', stat: 'damage', amount: 2 },
  { name: 'Far lens', stat: 'range', amount: 3 },
  { name: 'Relay coil', stat: 'rate', amount: 0.14 }
];

const SAVE_KEY = 'last-spire.records.v1';
const HIT_RADIUS = 4;

export function formatTime(seconds) {
  const total = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function browserStorage() {
  try { return globalThis.localStorage; } catch { return null; }
}

function readRecords(storage) {
  let records;
  try { records = JSON.parse(storage?.getItem(SAVE_KEY)); } catch { /* Storage is optional. */ }
  const integer = (key) => Number.isSafeInteger(records?.[key]) && records[key] >= 0 ? records[key] : 0;
  return { runs: integer('runs'), best: integer('best'), totalKills: integer('totalKills') };
}

function progressFor(totalKills) {
  const unlocks = BLUEPRINTS.filter(unlock => totalKills >= unlock.kills);
  return { totalKills, rank: unlocks.length, unlocks, nextUnlock: BLUEPRINTS[unlocks.length] || null };
}

export class Game {
  constructor({ random = Math.random, storage = browserStorage() } = {}) {
    this.random = random;
    this.storage = storage;
    this.records = readRecords(storage);
    this.progress = progressFor(this.records.totalKills);
    this.restart();
  }

  saveRecords(newKills = 0, newRun = false) {
    const saved = readRecords(this.storage);
    this.records = {
      runs: Math.max(this.records.runs, saved.runs) + Number(newRun),
      best: Math.max(this.records.best, saved.best, Math.floor(this.time || 0)),
      totalKills: Math.max(this.records.totalKills, saved.totalKills) + newKills
    };
    try { this.storage?.setItem(SAVE_KEY, JSON.stringify(this.records)); } catch { /* Keep records in memory. */ }
    this.progress = progressFor(this.records.totalKills);
  }

  restart() {
    this.saveRecords(0, true);
    const rank = this.progress.rank;
    this.run = this.records.runs;
    this.best = this.records.best;
    this.time = 0;
    this.hp = this.maxHp = 100;
    this.scrap = rank >= 1 ? 35 : 25;
    this.kills = 0;
    this.threat = 1;
    this.status = 'running';
    this.selected = 'tower';
    this.levels = { range: rank >= 3 ? 2 : 1, rate: rank >= 5 ? 2 : 1, splash: rank >= 4 ? 1 : 0 };
    this.bonus = { damage: rank >= 2 ? 2 : 0, range: 0, rate: 0 };
    this.relics = [];
    this.enemies = [];
    this.shots = [];
    this.effects = [];
    this.log = [];
    this.nextId = 1;
    this.gunClock = 0;
    this.spawnClock = 2.8;
    // Opening contacts place targets in every quadrant before edge spawns arrive.
    const contacts = [
      ['crawler', -58, -28], ['wraith', 40, -35], ['moth', 77, -7], ['crawler', 47, 33],
      ['brute', -55, 32], ['moth', -70, 4], ['crawler', -19, 33]
    ];
    for (const [type, x, y] of contacts) {
      this.spawn(type, x + (this.random() - 0.5) * 4, y + (this.random() - 0.5) * 4);
    }
    this.note('Spire core online.', 'system');
    this.note('Hostile signatures detected.', 'contact');
  }

  get range() { return 33 + 3.5 * (this.levels.range - 1) + this.bonus.range; }
  get rate() { return 0.85 * Math.pow(1.2, this.levels.rate - 1) + this.bonus.rate; }
  get damage() { return 8 + this.bonus.damage; }
  get splash() { return this.levels.splash ? 5 + 1.6 * this.levels.splash : 0; }

  cost(key) {
    const level = this.levels[key];
    if (!Object.hasOwn(UPGRADES, key) || level >= UPGRADES[key].maxLevel) return Infinity;
    if (key === 'splash') return Math.round(18 * Math.pow(1.44, level));
    const base = key === 'rate' ? 14 : 10;
    return Math.round(base * Math.pow(1.48, level - 1));
  }

  buy(key) {
    const price = this.cost(key);
    if (this.status === 'over' || this.scrap < price) return false;
    this.scrap -= price;
    this.levels[key]++;
    this.note(`${UPGRADES[key].name} upgraded to ${this.levels[key]}.`, 'upgrade');
    return true;
  }

  togglePause() {
    if (this.status === 'running') this.status = 'paused';
    else if (this.status === 'paused') this.status = 'running';
    return this.status;
  }

  inspect(id) {
    if (id !== 'tower' && !this.enemies.some(enemy => enemy.id === id)) return false;
    this.selected = id;
    return true;
  }

  note(text, type) {
    this.log.unshift({ time: this.time, text, type });
    if (this.log.length > 35) this.log.pop();
  }

  spawn(type, x, y) {
    const profile = ENEMIES[type];
    const scale = 1 + this.time / 260 + (this.time / 245) ** 2 + (this.time / 355) ** 3;
    const maxHp = Math.round(profile.hp * scale);
    const speed = profile.speed * (1 + Math.min(0.65, this.time / 720));
    this.enemies.push({ id: `e${this.nextId++}`, type, x, y, hp: maxHp, maxHp, speed,
      damage: profile.damage, reward: profile.reward });
  }

  spawnContact() {
    const roll = this.random();
    const heavyChance = Math.min(0.24, 0.07 + this.time / 1800);
    const type = roll < heavyChance ? 'brute' : roll < 0.39 ? 'moth' : roll < 0.58 ? 'wraith' : 'crawler';
    const angle = this.random() * Math.PI * 2;
    const dx = Math.cos(angle), dy = Math.sin(angle);
    const edge = Math.min(99 / Math.abs(dx), 59 / Math.abs(dy));
    this.spawn(type, dx * edge, dy * edge);
    // Variance breaks up the cadence while density rises continuously over time.
    this.spawnClock += Math.max(0.37, 2.65 / (1 + this.time / 80)) * (0.67 + 0.66 * this.random());
  }

  update(seconds) {
    if (!Number.isFinite(seconds) || seconds <= 0 || this.status !== 'running') return;
    while (seconds > 0 && this.status === 'running') {
      const step = Math.min(0.08, seconds);
      this.tick(step);
      seconds -= step;
    }
  }

  tick(dt) {
    this.time += dt;
    this.spawnClock -= dt;
    this.gunClock = Math.max(0, this.gunClock - dt);
    if (this.spawnClock <= 0) this.spawnContact();
    const threat = 1 + Math.floor(this.time / 45);
    if (threat !== this.threat) {
      this.threat = threat;
      this.note(`Threat level ${String(threat).padStart(2, '0')}.`, 'contact');
    }
    for (const effect of this.effects) effect.life -= dt;
    for (const shot of this.shots) shot.life -= dt;
    this.effects = this.effects.filter(effect => effect.life > 0);
    this.shots = this.shots.filter(shot => shot.life > 0);

    let closest = null;
    let targetDistance = this.range;
    for (const enemy of this.enemies) {
      const distance = Math.hypot(enemy.x, enemy.y);
      const afterMove = Math.max(0, distance - enemy.speed * dt);
      const factor = distance ? afterMove / distance : 0;
      enemy.x *= factor;
      enemy.y *= factor;
      if (afterMove < targetDistance) {
        targetDistance = afterMove;
        closest = enemy;
      }
    }
    if (closest && this.gunClock <= 0) this.fire(closest);
    let destroyed = 0;
    this.enemies = this.enemies.filter(enemy => {
      if (enemy.hp <= 0) {
        destroyed++;
        this.scrap += enemy.reward;
        this.effect(enemy.x, enemy.y, 'kill', 2.5);
        this.note(`${ENEMIES[enemy.type].name} destroyed. +${enemy.reward} scrap.`, 'kill');
      } else if (Math.hypot(enemy.x, enemy.y) <= HIT_RADIUS) {
        this.hp = Math.max(0, this.hp - enemy.damage);
        this.effect(enemy.x, enemy.y, 'hit', 3);
        this.note(`Core hit. -${enemy.damage} integrity.`, 'damage');
      } else return true;
      if (this.selected === enemy.id) this.selected = 'tower';
      return false;
    });
    if (destroyed) this.salvage(destroyed);
    if (this.hp === 0) {
      this.status = 'over';
      this.saveRecords();
      this.best = this.records.best;
      this.note('Spire signal lost.', 'damage');
    }
  }

  fire(target) {
    this.gunClock = 1 / this.rate;
    this.shots.push({ x: target.x, y: target.y, life: 0.24, maxLife: 0.24, splash: this.splash });
    target.hp -= this.damage;
    if (!this.splash) return;
    this.effect(target.x, target.y, 'splash', this.splash);
    for (const enemy of this.enemies) {
      if (enemy !== target && Math.hypot(enemy.x - target.x, enemy.y - target.y) <= this.splash) {
        enemy.hp -= Math.max(1, Math.round(this.damage * 0.75));
      }
    }
  }

  effect(x, y, type, radius) {
    this.effects.push({ x, y, type, radius, life: 0.38, maxLife: 0.38 });
  }

  salvage(count) {
    const previous = this.kills;
    this.kills += count;
    const oldRank = this.progress.rank;
    this.saveRecords(count);
    for (const unlock of this.progress.unlocks.slice(oldRank)) {
      this.note(`Blueprint unlocked: ${unlock.name}.`, 'unlock');
    }
    for (const threshold of [18, 55, 110]) {
      if (previous >= threshold || this.kills < threshold) continue;
      const remaining = RECOVERIES.filter(item => !this.relics.includes(item.name));
      const item = remaining[Math.floor(this.random() * remaining.length)];
      this.bonus[item.stat] += item.amount;
      this.relics.push(item.name);
      this.note(`Recovered ${item.name}. +${item.amount} ${item.stat}.`, 'upgrade');
    }
  }
}
