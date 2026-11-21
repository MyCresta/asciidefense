import { ENEMIES, UPGRADES, POWERS, DOCTRINES, BLUEPRINTS, SYNERGIES } from './content.js?v=2.0.0';
import { restoreCheckpoint, clearCheckpoint } from './checkpoint.js?v=2.0.0';

export { ENEMIES, UPGRADES, POWERS, DOCTRINES, BLUEPRINTS, SYNERGIES };
export const WORLD = Object.freeze({ x: 140, y: 84 });

const SAVE_KEY = 'last-spire.records.v1';
const HIT_RADIUS = 4;
const DRAFT_PERIOD = 120;
const BOSS_PERIOD = 180;
const BOSS_NOTICE = 12;
const BASE_LEVELS = { range: 1, rate: 1, damage: 1, splash: 0, crit: 0, chain: 0, armor: 0, regen: 0, bounty: 0 };
const CONTACTS = [
  ['crawler', -79, -39], ['wraith', 54, -49], ['moth', 109, -9], ['crawler', 68, 47],
  ['brute', -77, 44], ['moth', -98, 6], ['crawler', -19, 37]
];
const SPAWN_TABLE = [
  { type: 'crawler', at: 0, weight: 43 }, { type: 'moth', at: 0, weight: 24 },
  { type: 'wraith', at: 0, weight: 14 }, { type: 'brute', at: 0, weight: 8 },
  { type: 'splitter', at: 55, weight: 17 }, { type: 'aegis', at: 105, weight: 14 },
  { type: 'cantor', at: 150, weight: 9 }
];

export function formatTime(seconds) {
  const total = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function browserStorage() {
  try { return globalThis.localStorage; } catch { return null; }
}

function readRecords(storage) {
  let data;
  try { data = JSON.parse(storage?.getItem(SAVE_KEY)); } catch { /* Storage is optional. */ }
  const integer = value => Number.isSafeInteger(value) && value >= 0 ? value : 0;
  const credits = {};
  for (const [run, count] of Object.entries(data?.credits || {})) {
    if (/^\d{1,12}$/.test(run)) credits[run] = integer(count);
  }
  return { runs: integer(data?.runs), best: integer(data?.best), totalKills: integer(data?.totalKills), credits };
}

function progressFor(totalKills) {
  const unlocks = BLUEPRINTS.filter(unlock => totalKills >= unlock.kills);
  return { totalKills, rank: unlocks.length, unlocks, nextUnlock: BLUEPRINTS[unlocks.length] || null };
}

function distance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
const CORE = { x: 0, y: 0 };

export class Game {
  constructor({ random = Math.random, storage = browserStorage(), resume = false } = {}) {
    this.random = random;
    this.storage = storage;
    this.records = readRecords(storage);
    this.progress = progressFor(this.records.totalKills);
    if (resume && restoreCheckpoint(this)) return;
    this.restart();
  }

  saveRecords(_newKills = 0, newRun = false) {
    const saved = readRecords(this.storage);
    const credits = { ...saved.credits };
    for (const [run, count] of Object.entries(this.records.credits)) credits[run] = Math.max(credits[run] || 0, count);
    const highest = credits[this.run] || 0;
    const delta = Math.max(0, (this.kills || 0) - highest);
    if (this.run) credits[this.run] = highest + delta;
    const runs = Math.max(this.records.runs, saved.runs) + Number(newRun);
    // A replay from a slightly older checkpoint must not credit the same kills twice.
    for (const run of Object.keys(credits)) if (Number(run) < runs - 32) delete credits[run];
    this.records = { runs, best: Math.max(this.records.best, saved.best, Math.floor(this.time || 0)),
      totalKills: Math.max(this.records.totalKills, saved.totalKills) + delta, credits };
    try { this.storage?.setItem(SAVE_KEY, JSON.stringify(this.records)); } catch { /* Keep records in memory. */ }
    this.progress = progressFor(this.records.totalKills);
  }

  get availableDoctrines() {
    return Object.keys(DOCTRINES).filter(key => DOCTRINES[key].kills <= this.progress.totalKills);
  }

  restart(doctrineKey = this.doctrine || 'sentinel') {
    if (!this.availableDoctrines.includes(doctrineKey)) return false;
    clearCheckpoint(this);
    this.saveRecords(0, true);
    const rank = this.progress.rank;
    const doctrine = DOCTRINES[doctrineKey];
    this.doctrine = doctrineKey;
    this.run = this.records.runs;
    this.best = this.records.best;
    this.time = 0;
    this.hp = this.maxHp = 100;
    this.scrap = (rank >= 1 ? 35 : 25) + doctrine.scrap;
    this.kills = this.bossKills = 0;
    this.threat = 1;
    this.status = 'running';
    this.selected = 'tower';
    this.focusId = null;
    this.levels = { ...BASE_LEVELS, range: rank >= 3 ? 2 : 1, rate: rank >= 5 ? 2 : 1, splash: rank >= 4 ? 1 : 0 };
    for (const [key, value] of Object.entries(doctrine.levels)) this.levels[key] += value;
    this.bonus = { damage: rank >= 2 ? 2 : 0, range: 0, rate: 0 };
    this.relics = [];
    this.powers = {};
    this.choices = [];
    this.queue = [];
    this.draftReason = null;
    this.starterReady = true;
    this.nextDraft = DRAFT_PERIOD;
    this.nextBoss = 160;
    this.warning = null;
    this.enemies = [];
    this.shots = [];
    this.effects = [];
    this.log = [];
    this.nextId = 1;
    this.gunClock = 0;
    this.spawnClock = 1.9;
    this.pulseAt = this.wardAt = 0;
    for (const [type, x, y] of CONTACTS) {
      this.spawn(type, x + (this.random() - 0.5) * 4, y + (this.random() - 0.5) * 4);
    }
    this.note('Spire core online.', 'system');
    this.note('Hostile signatures detected.', 'contact');
    return true;
  }

  get range() { return 37 + 4.5 * (this.levels.range - 1) + this.bonus.range + 12 * (this.powers.scope || 0); }
  get rate() { return (0.85 * 1.19 ** (this.levels.rate - 1) + this.bonus.rate) * (1 + .25 * (this.powers.overclock || 0)); }
  get damage() { return 8 + 2 * (this.levels.damage - 1) + this.bonus.damage + (this.powers.reactor || 0); }
  get splash() { return (this.levels.splash ? 5 + 1.7 * this.levels.splash : 0) + 10 * (this.powers.fracture || 0); }
  get critChance() { return this.levels.crit * .075; }
  get chain() { return this.levels.chain + (this.powers.tesla || 0) + Number(this.synergyActive('rimewire')); }
  get armor() { return this.levels.armor * 1.5; }
  get regen() { return this.levels.regen * .20; }
  get bounty() { return this.levels.bounty * .18; }

  synergyActive(key) {
    if (!Object.hasOwn(SYNERGIES, key)) return false;
    const recipe = SYNERGIES[key];
    return Boolean(this.powers[recipe.power]) && this.levels[recipe.upgrade] >= recipe.level;
  }

  noteSynergies(changed) {
    for (const [key, recipe] of Object.entries(SYNERGIES)) {
      const justInstalled = (changed === recipe.power && this.powers[changed] === 1)
        || (changed === recipe.upgrade && this.levels[changed] === recipe.level);
      if (justInstalled && this.synergyActive(key)) this.note(`Synergy online: ${recipe.name}.`, 'upgrade');
    }
  }

  cost(key) {
    if (!Object.hasOwn(UPGRADES, key)) return Infinity;
    const { baseCost, growth, maxLevel } = UPGRADES[key];
    const level = this.levels[key];
    return level < maxLevel ? Math.round(baseCost * growth ** (level - BASE_LEVELS[key])) : Infinity;
  }

  buy(key) {
    const price = this.cost(key);
    if (this.status === 'draft' || this.status === 'over' || this.scrap < price) return false;
    this.scrap -= price;
    this.levels[key]++;
    this.note(`${UPGRADES[key].name} upgraded to ${this.levels[key]}.`, 'upgrade');
    this.noteSynergies(key);
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

  focus(id) {
    if (id !== null && !this.enemies.some(enemy => enemy.id === id)) return false;
    this.focusId = this.focusId === id ? null : id;
    return true;
  }

  note(text, type) {
    this.log.unshift({ time: this.time, text, type });
    if (this.log.length > 35) this.log.pop();
  }

  openStarter() {
    if (!this.starterReady || (this.status !== 'running' && this.status !== 'paused')) return false;
    this.starterReady = false;
    this.openDraft('starter');
    return true;
  }

  openDraft(reason) {
    const eligible = Object.keys(POWERS).filter(key => !POWERS[key].maxStacks || (this.powers[key] || 0) < POWERS[key].maxStacks);
    const rare = eligible.filter(key => POWERS[key].rare);
    const common = eligible.filter(key => !POWERS[key].rare && !POWERS[key].reserve);
    const reserve = eligible.filter(key => POWERS[key].reserve);
    const choices = [];
    // Rare boss prizes take priority; late-game reserves keep even a fully stacked build playable.
    for (const deck of reason === 'boss' ? [rare, common, reserve] : [common, reserve]) {
      while (choices.length < 3 && deck.length) choices.push(deck.splice(Math.floor(this.random() * deck.length), 1)[0]);
    }
    this.choices = choices;
    this.draftReason = reason;
    this.status = 'draft';
  }

  pickPower(key) {
    if (this.status !== 'draft' || !this.choices.includes(key)) return false;
    this.powers[key] = (this.powers[key] || 0) + 1;
    if (key === 'reservoir') { this.maxHp += 12; this.hp += 12; }
    if (key === 'interest') this.scrap += 25 + this.threat * 5;
    if (key === 'repulse') this.pulseAt = this.time + 10;
    if (key === 'ward') this.wardAt = this.time;
    this.note(`Relic installed: ${POWERS[key].name}.`, 'upgrade');
    this.noteSynergies(key);
    this.choices = [];
    this.draftReason = null;
    this.status = 'running';
    if (this.queue.length) this.openDraft(this.queue.shift());
    return true;
  }

  spawn(type, x, y, { mini = false, elite = false } = {}) {
    const profile = ENEMIES[type];
    const lateGrowth = Math.max(0, this.time - 240) / 165;
    const scale = 1 + this.time / 290 + (this.time / 305) ** 2 + (this.time / 340) ** 3 + lateGrowth ** 3.4;
    const maxHp = Math.max(1, Math.round(profile.hp * scale * (mini ? .47 : elite ? 2.25 : 1)));
    const speed = profile.speed * 1.36 * (1 + Math.min(.75, this.time / 750)) * (mini ? 1.22 : elite ? 1.08 : 1);
    const maxShield = type === 'aegis' ? Math.round(maxHp * .48) : 0;
    const enemy = {
      id: `e${this.nextId++}`, type, x, y, hp: maxHp, maxHp, speed,
      damage: Math.max(1, Math.round(profile.damage * (mini ? .45 : elite ? 1.6 : 1) * (1 + this.time / 1200))),
      reward: mini ? 1 : profile.reward * (elite ? 2 : 1), tier: Math.min(4, profile.tier + Number(elite)),
      boss: type === 'sovereign', elite, mini, shield: maxShield, maxShield,
      lastHit: -1000, slowUntil: 0, burnUntil: 0, burnDps: 0, pulseAt: this.time + 5, phaseOffset: this.random() * 7
    };
    this.enemies.push(enemy);
    return enemy;
  }

  entryPoint() {
    const angle = this.random() * Math.PI * 2;
    const dx = Math.cos(angle), dy = Math.sin(angle);
    const horizontal = (WORLD.x - 1) / Math.abs(dx), vertical = (WORLD.y - 1) / Math.abs(dy);
    const edge = horizontal < vertical ? (dx > 0 ? 'E' : 'W') : (dy > 0 ? 'S' : 'N');
    const radius = Math.min(horizontal, vertical);
    return { x: dx * radius, y: dy * radius, edge };
  }

  spawnContact() {
    const rows = SPAWN_TABLE.filter(row => this.time >= row.at);
    let roll = this.random() * rows.reduce((sum, row) => sum + row.weight, 0);
    const { type } = rows.find(row => (roll -= row.weight) < 0) || rows[rows.length - 1];
    const point = this.entryPoint();
    const elite = this.time >= 300 && this.random() < Math.min(.30, .07 + (this.time - 300) / 1800);
    this.spawn(type, point.x, point.y, { elite });
    this.spawnClock += Math.max(.36, 2.7 / (1 + this.time / 95)) * (.70 + .60 * this.random());
  }

  scheduleBoss() {
    if (!this.warning && this.time >= this.nextBoss - BOSS_NOTICE) {
      this.warning = { type: 'sovereign', at: this.nextBoss, ...this.entryPoint() };
      this.note(`Sovereign approaching from ${this.warning.edge}.`, 'boss');
    }
    if (this.warning && this.time >= this.nextBoss) {
      const { x, y } = this.warning;
      this.spawn('sovereign', x, y);
      this.effect(x, y, 'boss', 17, 1);
      this.note('Sovereign entered the field.', 'boss');
      this.warning = null;
      this.nextBoss += BOSS_PERIOD;
    }
  }

  update(seconds) {
    if (!Number.isFinite(seconds) || seconds <= 0 || this.status !== 'running') return;
    while (seconds > 0 && this.status === 'running') {
      const step = Math.min(.08, seconds, Math.max(0, this.nextDraft - this.time));
      this.tick(step);
      seconds -= step;
    }
  }

  tick(dt) {
    this.time += dt;
    this.hp = Math.min(this.maxHp, this.hp + this.regen * dt);
    this.spawnClock -= dt;
    this.gunClock = Math.max(0, this.gunClock - dt);
    if (this.spawnClock <= 0) this.spawnContact();
    this.scheduleBoss();
    const threat = 1 + Math.floor(this.time / 45);
    if (threat !== this.threat) {
      this.threat = threat;
      this.note(`Threat level ${String(threat).padStart(2, '0')}.`, 'contact');
    }
    for (const effect of this.effects) effect.life -= dt;
    for (const shot of this.shots) shot.life -= dt;
    this.effects = this.effects.filter(effect => effect.life > 0);
    this.shots = this.shots.filter(shot => shot.life > 0);
    if (this.powers.repulse && this.time >= this.pulseAt) this.repulse();
    for (const enemy of this.enemies) this.advance(enemy, dt);
    if (this.gunClock <= 0) {
      const focused = this.focusId && this.enemies.find(enemy => enemy.id === this.focusId && enemy.hp > 0 && distance(enemy, CORE) <= this.range);
      const target = focused || this.nearest(CORE, this.range);
      if (target) this.fire(target);
    }
    this.resolveContacts();
    if (this.hp <= 0) {
      this.status = 'over';
      this.saveRecords();
      this.best = this.records.best;
      this.queue = [];
      clearCheckpoint(this);
      this.note('Spire signal lost.', 'damage');
      return;
    }
    if (this.time >= this.nextDraft - 1e-8) {
      this.time = this.nextDraft;
      this.nextDraft += DRAFT_PERIOD;
      this.starterReady = false;
      this.queue.unshift('time');
    }
    if (this.queue.length) this.openDraft(this.queue.shift());
  }

  advance(enemy, dt) {
    if (enemy.burnUntil > this.time - dt) {
      const burningTime = Math.min(dt, enemy.burnUntil - (this.time - dt));
      this.hurt(enemy, enemy.burnDps * burningTime);
    }
    if (enemy.hp <= 0) return;
    if (enemy.maxShield && this.time - enemy.lastHit >= 7) {
      enemy.shield = Math.min(enemy.maxShield, enemy.shield + dt * enemy.maxShield / 3);
    }
    if (enemy.type === 'cantor' && this.time >= enemy.pulseAt) this.healNearby(enemy);
    if (enemy.boss && this.time >= enemy.pulseAt) {
      enemy.pulseAt = this.time + 17;
      const escort = this.random() < .5 ? 'crawler' : 'moth';
      this.spawn(escort, enemy.x * .97, enemy.y * .97);
      this.effect(enemy.x, enemy.y, 'boss', 5);
      if (distance(enemy, CORE) <= 70) {
        this.beam(CORE, 'siege', enemy);
        this.impact(enemy, 5 + this.threat);
      }
    }
    const gap = distance(enemy, CORE);
    let speed = enemy.speed * (this.time < enemy.slowUntil ? .65 : 1);
    if (enemy.type === 'wraith' && (this.time + enemy.phaseOffset) % 6.5 < 1.2) speed *= 2.1;
    if (enemy.type === 'moth' && gap < 32) speed *= 1.4;
    const factor = gap > 0 ? Math.max(0, gap - speed * dt) / gap : 0;
    enemy.x *= factor;
    enemy.y *= factor;
  }

  healNearby(cantor) {
    cantor.pulseAt = this.time + 4.5;
    let restored = false;
    for (const enemy of this.enemies) {
      if (enemy === cantor || enemy.hp <= 0 || enemy.hp >= enemy.maxHp || distance(cantor, enemy) > 18) continue;
      enemy.hp = Math.min(enemy.maxHp, enemy.hp + Math.max(2, enemy.maxHp * .12));
      restored = true;
    }
    if (restored) this.effect(cantor.x, cantor.y, 'heal', 18, .65);
  }

  repulse() {
    this.pulseAt = this.time + 10;
    this.effect(0, 0, 'pulse', this.range, .8);
    for (const enemy of this.enemies) {
      const gap = distance(enemy, CORE);
      if (gap <= 0 || gap > this.range) continue;
      const factor = (gap + 10) / gap;
      enemy.x = Math.max(-WORLD.x, Math.min(WORLD.x, enemy.x * factor));
      enemy.y = Math.max(-WORLD.y, Math.min(WORLD.y, enemy.y * factor));
    }
  }

  nearest(origin, radius, exclude) {
    let nearest = null;
    let best = radius * radius;
    for (const enemy of this.enemies) {
      if (enemy.hp <= 0 || exclude?.has(enemy.id)) continue;
      const squared = (origin.x - enemy.x) ** 2 + (origin.y - enemy.y) ** 2;
      if (squared > best) continue;
      best = squared;
      nearest = enemy;
    }
    return nearest;
  }

  hurt(enemy, amount) {
    if (enemy.hp <= 0 || amount <= 0) return;
    const shielded = Math.min(enemy.shield, amount);
    enemy.shield -= shielded;
    if (shielded && enemy.shield === 0) this.effect(enemy.x, enemy.y, 'shield', 6);
    enemy.hp = Math.max(0, enemy.hp - (amount - shielded));
    enemy.lastHit = this.time;
  }

  strike(enemy, amount, direct = false) {
    if (enemy.type === 'brute') amount *= .85;
    if (this.powers.headhunter && enemy.tier >= 3) amount *= 1.6;
    this.hurt(enemy, amount);
    if (this.powers.frost) enemy.slowUntil = this.time + 3;
    if (direct && this.powers.ember && enemy.hp > 0) {
      const remaining = Math.max(0, enemy.burnUntil - this.time) * enemy.burnDps;
      enemy.burnDps = (remaining + amount * .60) / 3;
      enemy.burnUntil = this.time + 3;
      this.effect(enemy.x, enemy.y, 'burn', 3);
    }
  }

  beam(target, kind, from = null) {
    const shot = { x: target.x, y: target.y, life: .24, maxLife: .24, splash: this.splash, kind };
    if (from) { shot.fromX = from.x; shot.fromY = from.y; }
    this.shots.push(shot);
  }

  fire(target) {
    this.gunClock = 1 / this.rate;
    const crit = this.critChance > 0 && this.random() < this.critChance;
    const amount = this.damage * (crit ? 2 : 1);
    this.beam(target, crit ? 'crit' : 'shot');
    this.strike(target, amount, true);
    if (crit) this.effect(target.x, target.y, 'crit', 5);
    if (this.splash > 0) {
      this.effect(target.x, target.y, 'splash', this.splash);
      const wildfire = this.synergyActive('wildfire');
      for (const enemy of this.enemies) {
        if (enemy !== target && enemy.hp > 0 && distance(enemy, target) <= this.splash) this.strike(enemy, amount * .65, wildfire);
      }
    }
    const struck = new Set([target.id]);
    if (this.powers.twinshot) {
      const other = this.nearest(CORE, this.range, struck);
      if (other) { this.beam(other, 'twin'); this.strike(other, amount * .65, true); }
    }
    let from = target;
    for (let hop = 0; hop < this.chain; hop++) {
      const next = this.nearest(from, 23, struck);
      if (!next) break;
      this.beam(next, 'chain', from);
      this.strike(next, amount * .70 * .88 ** hop);
      struck.add(next.id);
      from = next;
    }
  }

  effect(x, y, type, radius, life = .38) {
    this.effects.push({ x, y, type, radius, life, maxLife: life });
  }

  resolveContacts() {
    const brood = [];
    let destroyed = 0;
    this.enemies = this.enemies.filter(enemy => {
      if (enemy.hp <= 0) {
        destroyed++;
        const bounty = Math.round(enemy.reward * (1 + this.bounty)) + (this.powers.harvest || 0);
        this.scrap += bounty;
        this.effect(enemy.x, enemy.y, 'kill', 2.5);
        this.note(`${ENEMIES[enemy.type].name} destroyed. +${bounty} scrap.`, 'kill');
        if (enemy.type === 'splitter') brood.push(enemy);
        if (enemy.boss) {
          this.bossKills++;
          this.queue.push('boss');
          this.effect(enemy.x, enemy.y, 'bossfall', 22, 1);
          this.note('Sovereign defeated. Rare relic recovered.', 'boss');
        }
      } else if (distance(enemy, CORE) <= HIT_RADIUS) {
        this.impact(enemy);
      } else return true;
      if (this.selected === enemy.id) this.selected = 'tower';
      if (this.focusId === enemy.id) this.focusId = null;
      return false;
    });
    for (const enemy of brood) {
      for (const sign of [-1, 1]) this.spawn('crawler', enemy.x * .98 + sign * 1.6, enemy.y * .98 - sign, { mini: true });
      this.effect(enemy.x, enemy.y, 'split', 5);
    }
    if (destroyed) this.salvage(destroyed);
  }

  impact(enemy, siegeDamage = 0) {
    if (this.powers.ward && this.time >= this.wardAt) {
      this.wardAt = this.time + 24;
      this.effect(0, 0, 'ward', 8, .65);
      this.note('Phase ward absorbed an impact.', 'system');
      return;
    }
    const damage = Math.max(1, Math.round((siegeDamage || enemy.damage) - this.armor));
    this.hp = Math.max(0, this.hp - damage);
    this.effect(0, 0, 'hit', 3);
    this.note(`${siegeDamage ? 'Siege bolt' : 'Core hit'}. -${damage} integrity.`, 'damage');
  }

  salvage(count) {
    const previous = this.kills;
    this.kills += count;
    if (this.powers.repair && this.hp > 0) {
      const interval = this.synergyActive('fieldmedic') ? 3 : 5;
      const healing = Math.floor(this.kills / interval) - Math.floor(previous / interval);
      this.hp = Math.min(this.maxHp, this.hp + healing);
    }
    const oldRank = this.progress.rank;
    this.saveRecords(count);
    for (const unlock of this.progress.unlocks.slice(oldRank)) this.note(`Blueprint unlocked: ${unlock.name}.`, 'unlock');
  }
}
