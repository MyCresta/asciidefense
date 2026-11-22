import { ENEMIES, UPGRADES, POWERS, DOCTRINES, BLUEPRINTS, SYNERGIES, RUN_PROFILES } from './content.js?v=3.2.0';
import { restoreCheckpoint, clearCheckpoint } from './checkpoint.js?v=3.2.0';

import { createWorkshop, awardSalvage, pickBlueprint } from './workshop.js?v=3.2.0';
import { initWeapons, WEAPONS, fireMounts } from './weapons.js?v=3.2.0';
import * as Relics from './relic-effects.js?v=3.2.0';
import { applyEliteTrait, boonActive, rollEliteTrait, tickBargains, BARGAIN_FIRST } from './hazards.js?v=3.2.0';

export { ENEMIES, UPGRADES, POWERS, DOCTRINES, BLUEPRINTS, SYNERGIES, RUN_PROFILES };
export const WORLD = Object.freeze({ x: 140, y: 84 });

const SAVE_KEY = 'last-spire.records.v1';
const DAILY_KEY = 'last-spire.daily.v1';
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
  const openers = Array.isArray(data?.openers) ? data.openers.filter(key => Object.hasOwn(POWERS, key)).slice(-12) : [];
  const lastProfile = Object.hasOwn(RUN_PROFILES, data?.lastProfile) ? data.lastProfile : null;
  return { runs: integer(data?.runs), best: integer(data?.best), totalKills: integer(data?.totalKills), credits, openers, lastProfile };
}

function progressFor(totalKills) {
  const unlocks = BLUEPRINTS.filter(unlock => totalKills >= unlock.kills);
  return { totalKills, rank: unlocks.length, unlocks, nextUnlock: BLUEPRINTS[unlocks.length] || null };
}

// The daily challenge uses its own stream so every player meets the same run.
export function todayKey(date = new Date()) {
  return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
}

export function dailySeed(key) {
  let hash = 2166136261;
  for (const char of 'last-spire/' + key) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
  return hash || 1;
}

function distance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
const CORE = { x: 0, y: 0 };

export class Game {
  constructor({ random = Math.random, storage = browserStorage(), resume = false } = {}) {
    this.baseRandom = random;
    this.random = random;
    this.storage = storage;
    this.records = readRecords(storage);
    this.progress = progressFor(this.records.totalKills);
    if (resume && restoreCheckpoint(this)) {
      this.bindRandom();
      return;
    }
    this.restart();
  }

  // Mulberry32 over a saved state, so a resumed daily run continues the same sequence.
  bindRandom() {
    if (!this.daily) {
      this.random = this.baseRandom;
      return;
    }
    this.random = () => {
      this.rngState = (this.rngState + 0x6D2B79F5) >>> 0;
      let t = this.rngState;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  get dailyRecord() {
    let data = null;
    try { data = JSON.parse(this.storage?.getItem(DAILY_KEY)); } catch { /* Storage is optional. */ }
    const today = todayKey();
    return data?.date === today && Number.isFinite(data.best) ? { date: today, best: data.best, tries: data.tries || 0 } : { date: today, best: 0, tries: 0 };
  }

  saveDaily(finished = false) {
    if (!this.daily || this.daily !== todayKey()) return;
    const record = this.dailyRecord;
    const next = { date: record.date, best: Math.max(record.best, Math.floor(this.time)), tries: record.tries + Number(finished) };
    try { this.storage?.setItem(DAILY_KEY, JSON.stringify(next)); } catch { /* Keep playing without a record. */ }
  }

  saveRecords(_newKills = 0, newRun = false, memory = {}) {
    const saved = readRecords(this.storage);
    const credits = { ...saved.credits };
    for (const [run, count] of Object.entries(this.records.credits)) credits[run] = Math.max(credits[run] || 0, count);
    const highest = credits[this.run] || 0;
    const delta = Math.max(0, (this.kills || 0) - highest);
    if (this.run) credits[this.run] = highest + delta;
    const runs = Math.max(this.records.runs, saved.runs) + Number(newRun);
    // A replay from a slightly older checkpoint must not credit the same kills twice.
    for (const run of Object.keys(credits)) if (Number(run) < runs - 32) delete credits[run];
    const recent = saved.runs > 0 && saved.runs >= this.records.runs ? saved : this.records;
    const openers = memory.openers && this.run === runs ? [...recent.openers, ...memory.openers].slice(-12) : recent.openers;
    this.records = { runs, openers, lastProfile: memory.profile || recent.lastProfile, best: Math.max(this.records.best, saved.best, Math.floor(this.time || 0)),
      totalKills: Math.max(this.records.totalKills, saved.totalKills) + delta, credits };
    try { this.storage?.setItem(SAVE_KEY, JSON.stringify(this.records)); } catch { /* Keep records in memory. */ }
    this.progress = progressFor(this.records.totalKills);
  }

  get availableDoctrines() {
    return Object.keys(DOCTRINES).filter(key => DOCTRINES[key].kills <= this.progress.totalKills);
  }

  restart(doctrineKey = this.doctrine || 'sentinel', primaryWeapon = null, { daily = false } = {}) {
    if (!this.availableDoctrines.includes(doctrineKey) || (primaryWeapon !== null && !Object.hasOwn(WEAPONS, primaryWeapon))) return false;
    if (this.daily && this.status !== 'over') this.saveDaily(true);
    clearCheckpoint(this);
    this.daily = daily ? todayKey() : null;
    this.rngState = daily ? dailySeed(this.daily) : 0;
    this.bindRandom();
    const profiles = Object.keys(RUN_PROFILES).filter(key => daily || key !== this.records.lastProfile);
    // Reservoir sampling gives every available profile equal odds without retaining a shuffled deck.
    this.profile = profiles.reduce((picked, key, index) => this.random() < 1 / (index + 1) ? key : picked, profiles[0]);
    this.saveRecords(0, true, { profile: this.profile });
    const rank = this.progress.rank;
    const doctrine = DOCTRINES[doctrineKey];
    this.doctrine = doctrineKey;
    this.run = this.records.runs;
    this.best = this.records.best;
    this.time = 0;
    this.hp = this.maxHp = 100;
    this.scrap = Math.max(0, (rank >= 1 ? 35 : 25) + doctrine.scrap + this.encounter.supply);
    this.kills = this.bossKills = 0;
    this.threat = 1;
    this.status = 'running';
    this.selected = 'tower';
    this.focusId = null;
    this.levels = { ...BASE_LEVELS, range: rank >= 3 ? 2 : 1, rate: rank >= 5 ? 2 : 1, splash: rank >= 4 ? 1 : 0 };
    for (const [key, value] of Object.entries(doctrine.levels)) this.levels[key] += value;
    this.bonus = { damage: rank >= 2 ? 2 : 0, range: 0, rate: 0 };
    this.workshop = createWorkshop();
    this.relics = [];
    this.fuseUsed = false;
    this.draftHistory = [];
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
    this.bargain = this.boon = this.lastBargain = null;
    this.nextBargain = BARGAIN_FIRST;
    this.stats = { dealt: 0, bestHit: 0, taken: {}, fatal: null, bargains: 0 };
    initWeapons(this, primaryWeapon);
    const mirrorX = this.random() < .5 ? -1 : 1;
    const mirrorY = this.random() < .5 ? -1 : 1;
    const signature = Object.entries(this.encounter.enemyWeights).sort((a, b) => b[1] - a[1])[0];
    for (const [index, [base, x, y]] of CONTACTS.entries()) {
      const type = index === 0 && signature?.[1] > 1 ? signature[0] : base;
      this.spawn(type, (x + (this.random() - .5) * 8) * mirrorX, (y + (this.random() - .5) * 6) * mirrorY);
    }
    this.note(`Spire online. ${this.encounter.name} detected.`, 'system');
    this.note('Hostile signatures detected.', 'contact');
    return true;
  }

  get encounter() { return RUN_PROFILES[this.profile]; }
  get range() { return Relics.stat(this, 'range', 37 + 4.5 * (this.levels.range - 1) + this.bonus.range + 12 * (this.powers.scope || 0)); }
  get rate() {
    const base = (.85 * 1.19 ** (this.levels.rate - 1) + this.bonus.rate) * (1 + .25 * (this.powers.overclock || 0));
    return Relics.stat(this, 'rate', base * (1 + .02 * this.workshop.tunes)) * (boonActive(this, 'overdrive') ? 1.35 : 1);
  }
  get damage() {
    const base = 8 + 2 * (this.levels.damage - 1) + this.bonus.damage + (this.powers.reactor || 0);
    return Relics.stat(this, 'damage', base + 2 * this.workshop.tunes);
  }
  get splash() { return Relics.stat(this, 'splash', (this.levels.splash ? 5 + 1.7 * this.levels.splash : 0) + 10 * (this.powers.fracture || 0)); }
  get critChance() { return Relics.stat(this, 'critChance', this.levels.crit * .075); }
  get chain() { return Relics.stat(this, 'chain', this.levels.chain + (this.powers.tesla || 0) + Number(this.synergyActive('rimewire'))); }
  get armor() { return Relics.stat(this, 'armor', this.levels.armor * 1.5); }
  get regen() { return Relics.stat(this, 'regen', this.levels.regen * .20); }
  get bounty() { return Relics.stat(this, 'bounty', this.levels.bounty * .18); }

  synergyActive(key) {
    if (!Object.hasOwn(SYNERGIES, key)) return false;
    const recipe = SYNERGIES[key];
    return Boolean(this.powers[recipe.power]) && this.levels[recipe.upgrade] >= recipe.level;
  }

  noteSynergies(changed, before = this.levels[changed] - 1) {
    for (const [key, recipe] of Object.entries(SYNERGIES)) {
      const justInstalled = (changed === recipe.power && this.powers[changed] === 1)
        || (changed === recipe.upgrade && before < recipe.level && this.levels[changed] >= recipe.level);
      if (justInstalled && this.synergyActive(key)) this.note(`Synergy online: ${recipe.name}.`, 'upgrade');
    }
  }

  cost(key) {
    return this.status === 'cache' && this.workshop.offer.some(item => item.key === key) ? 0 : Infinity;
  }

  buy(key) { return pickBlueprint(this, key); }

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
    if (this.log.length > 100) this.log.length = 100;
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
    const regular = eligible.filter(key => !POWERS[key].rare && !POWERS[key].reserve);
    const uncommon = regular.filter(key => POWERS[key].rarity === 'uncommon');
    const common = regular.filter(key => POWERS[key].rarity !== 'uncommon');
    const reserve = eligible.filter(key => POWERS[key].reserve);
    const opening = this.draftHistory.length === 0 && reason !== 'boss';
    const recent = opening ? this.records.openers : this.draftHistory;
    const featured = reason === 'time' || this.random() < .35;
    const choices = [];
    for (let slot = 0; slot < 3; slot++) {
      const firstPool = reason === 'boss' ? rare : slot === 0 && featured ? uncommon : common;
      for (const pool of [firstPool, regular, reserve]) {
        let options = pool.filter(key => !choices.includes(key));
        if (!options.length) continue;
        const fresh = options.filter(key => !recent.includes(key));
        if (fresh.length) options = fresh;
        const distinct = options.filter(key => !choices.some(other => POWERS[other].family === POWERS[key].family));
        if (distinct.length) options = distinct;
        choices.push(options[Math.floor(this.random() * options.length)]);
        break;
      }
    }
    // Shuffle presentation so the uncommon or featured slot can appear on any card.
    for (let index = choices.length - 1; index > 0; index--) {
      const other = Math.floor(this.random() * (index + 1));
      [choices[index], choices[other]] = [choices[other], choices[index]];
    }
    this.draftHistory = [...this.draftHistory, ...choices].slice(-18);
    if (opening) this.saveRecords(0, false, { openers: choices });
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
    Relics.onPick(this, key);
    this.note(`Relic installed: ${POWERS[key].name}.`, 'upgrade');
    this.noteSynergies(key);
    this.choices = [];
    this.draftReason = null;
    this.status = 'running';
    if (this.queue.length) this.openDraft(this.queue.shift());
    return true;
  }

  spawn(type, x, y, { mini = false, elite = false } = {}) {
    const trait = elite ? rollEliteTrait(this) : null;
    const profile = ENEMIES[type];
    // Smooth growth keeps later minutes responsive to loadout strength and salvage luck.
    const reinforcement = this.time / (this.time + 600);
    const endurance = 1 + this.time / 420 + (this.time / 420) ** 2 + (this.time / 75) ** 3 * reinforcement ** 4;
    const scale = this.encounter.hp * endurance;
    const maxHp = Math.max(1, Math.round(profile.hp * scale * (mini ? .47 : elite ? 2.25 : 1)));
    const speed = profile.speed * this.encounter.speed * 1.36 * (1 + Math.min(.75, this.time / 750)) * (mini ? 1.22 : elite ? 1.08 : 1);
    const maxShield = type === 'aegis' ? Math.round(maxHp * .48) : 0;
    const enemy = {
      id: `e${this.nextId++}`, type, x, y, hp: maxHp, maxHp, speed,
      damage: Math.max(1, Math.round(profile.damage * this.encounter.damage * (mini ? .45 : elite ? 1.6 : 1) * (1 + this.time / 1200))),
      reward: mini ? 1 : profile.reward * (elite ? 2 : 1), tier: Math.min(4, profile.tier + Number(elite)),
      boss: type === 'sovereign', elite, mini, shield: maxShield, maxShield,
      lastHit: -1000, slowUntil: 0, burnUntil: 0, burnDps: 0, pulseAt: this.time + 5, phaseOffset: this.random() * 7,
      trait: null
    };
    if (trait) applyEliteTrait(enemy, trait);
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
    const weight = row => row.weight * (this.encounter.enemyWeights[row.type] ?? 1);
    let roll = this.random() * rows.reduce((sum, row) => sum + weight(row), 0);
    const { type } = rows.find(row => (roll -= weight(row)) < 0) || rows[rows.length - 1];
    const point = this.entryPoint();
    const elite = boonActive(this, 'bloodprice')
      ? this.random() < .35
      : this.time >= 300 && this.random() < Math.min(.30, .07 + (this.time - 300) / 1800);
    this.spawn(type, point.x, point.y, { elite });
    this.spawnClock += (boonActive(this, 'lull') ? 1 / .6 : 1) * this.encounter.interval * Math.max(.39, 2.7 / (1 + this.time / 95)) * (.70 + .60 * this.random());
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
      const step = Math.min(1 / 60, seconds, Math.max(0, this.nextDraft - this.time));
      this.tick(step);
      seconds -= step;
    }
  }

  tick(dt) {
    this.time += dt;
    this.hp = Math.min(this.maxHp, this.hp + this.regen * dt);
    this.spawnClock -= dt;
    if (this.spawnClock <= 0) this.spawnContact();
    this.scheduleBoss();
    tickBargains(this);
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
    fireMounts(this, dt);
    Relics.onTick(this, dt);
    this.resolveContacts();
    if (this.hp <= 0) {
      this.status = 'over';
      this.saveRecords();
      this.saveDaily(true);
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
    if (enemy.trait === 'mending' && enemy.hp < enemy.maxHp) enemy.hp = Math.min(enemy.maxHp, enemy.hp + enemy.maxHp * .03 * dt);
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
    if (boonActive(this, 'goldrush')) speed *= 1.25;
    speed = Relics.speed(this, enemy, speed);
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
    if (enemy.trait === 'plated') amount *= .7;
    if (this.stats) this.stats.dealt += Math.min(amount, enemy.hp + enemy.shield);
    const shielded = Math.min(enemy.shield, amount);
    enemy.shield -= shielded;
    if (shielded && enemy.shield === 0) this.effect(enemy.x, enemy.y, 'shield', 6);
    enemy.hp = Math.max(0, enemy.hp - (amount - shielded));
    enemy.lastHit = this.time;
  }

  strike(enemy, amount, direct = false, ignite = direct) {
    if (enemy.type === 'brute') amount *= .85;
    if (this.powers.headhunter && enemy.tier >= 3) amount *= 1.6;
    amount *= Relics.hitFactor(this, enemy, direct);
    this.hurt(enemy, amount);
    if (this.powers.frost) enemy.slowUntil = this.time + 3;
    if (ignite && this.powers.ember && enemy.hp > 0) {
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

  fire(target, shot = {}) {
    this.gunClock = 1 / this.rate;
    const crit = this.critChance > 0 && this.random() < this.critChance;
    const amount = this.damage * (shot.scale ?? 1) * (crit ? Relics.criticalMultiplier(this) : 1);
    this.beam(target, shot.kind && shot.kind !== 'shot' ? shot.kind : crit ? 'crit' : 'shot');
    this.shots[this.shots.length - 1].crit = crit;
    this.strike(target, amount, true);
    if (this.stats && amount > this.stats.bestHit) this.stats.bestHit = amount;
    if (crit || amount >= target.maxHp * .2 || target.boss) this.effect(target.x, target.y, crit ? 'number-crit' : 'number', 1, .65, Math.round(amount));
    if (crit) {
      this.effect(target.x, target.y, 'crit', 5);
      Relics.onCritical(this, target, amount);
    }
    if (this.splash > 0) {
      this.effect(target.x, target.y, 'splash', this.splash);
      const wildfire = this.synergyActive('wildfire');
      for (const enemy of this.enemies) {
        if (enemy !== target && enemy.hp > 0 && distance(enemy, target) <= this.splash) this.strike(enemy, amount * .65, false, wildfire);
      }
    }
    const struck = new Set([target.id]);
    if (this.powers.twinshot) {
      const other = this.nearest(CORE, shot.reach ?? this.range, struck);
      if (other) { this.beam(other, 'twin'); this.strike(other, amount * .65, true); }
    }
    let from = target;
    for (let hop = 0; hop < this.chain + (shot.extraChains || 0); hop++) {
      const next = this.nearest(from, 23, struck);
      if (!next) break;
      this.beam(next, 'chain', from);
      this.strike(next, amount * .70 * .88 ** hop);
      struck.add(next.id);
      from = next;
    }
    Relics.onFire(this, target, amount);
    return amount;
  }

  effect(x, y, type, radius, life = .38, value) {
    const effect = { x, y, type, radius, life, maxLife: life };
    if (value !== undefined) effect.value = value;
    this.effects.push(effect);
  }

  rewardKill(enemy) {
    const base = Math.round(enemy.reward * this.encounter.salvage * (1 + this.bounty)) + (this.powers.harvest || 0);
    const boon = boonActive(this, 'lull') ? 0 : boonActive(this, 'goldrush') ? 1.6 : 1;
    const bounty = Math.round(Relics.bounty(this, enemy, base) * boon);
    this.scrap += bounty;
    this.effect(enemy.x, enemy.y, 'kill', 2.5);
    this.note(`${ENEMIES[enemy.type].name} destroyed. +${bounty} scrap.`, 'kill');
    awardSalvage(this, enemy);
    Relics.onDeath(this, enemy);
    if (enemy.boss) {
      this.bossKills++;
      this.queue.push('boss');
      this.effect(enemy.x, enemy.y, 'bossfall', 22, 1);
      this.note('Sovereign defeated. Rare relic recovered.', 'boss');
    }
  }

  resolveContacts() {
    const atCore = enemy => enemy.x ** 2 + enemy.y ** 2 <= HIT_RADIUS ** 2;
    if (!this.enemies.some(enemy => enemy.hp <= 0 || atCore(enemy))) return;
    const removed = new Set();
    const brood = [];
    let killed = 0;
    // Explosions and return fire can change another contact's fate during the same tick.
    for (;;) {
      const fallen = this.enemies.find(enemy => enemy.hp <= 0 && !removed.has(enemy.id));
      if (fallen) {
        removed.add(fallen.id);
        this.rewardKill(fallen);
        killed++;
        if (fallen.type === 'splitter' || fallen.trait === 'volatile') brood.push(fallen);
        continue;
      }
      const breach = this.enemies.find(enemy => atCore(enemy) && !removed.has(enemy.id));
      if (!breach) break;
      removed.add(breach.id);
      this.impact(breach);
    }
    this.enemies = this.enemies.filter(enemy => !removed.has(enemy.id));
    if (removed.has(this.selected)) this.selected = 'tower';
    if (removed.has(this.focusId)) this.focusId = null;
    for (const enemy of brood) {
      for (const sign of [-1, 1]) this.spawn('crawler', enemy.x * .98 + sign * 1.6, enemy.y * .98 - sign, { mini: true });
      this.effect(enemy.x, enemy.y, 'split', 5);
    }
    if (killed) this.salvage(killed);
  }

  impact(enemy, siegeDamage = 0) {
    if (this.powers.ward && this.time >= this.wardAt) {
      this.wardAt = this.time + 24;
      this.effect(0, 0, 'ward', 8, .65);
      this.note('Phase ward absorbed an impact.', 'system');
      return;
    }
    const overdrive = boonActive(this, 'overdrive') ? 1.5 : 1;
    const damage = Math.max(1, Math.round(((siegeDamage || enemy.damage) - this.armor) * overdrive));
    const applied = Relics.impact(this, enemy, damage);
    this.hp = Math.min(this.maxHp, Math.max(0, this.hp - applied));
    if (this.stats && applied > 0) {
      const source = siegeDamage ? 'siege' : enemy.type;
      this.stats.taken[source] = (this.stats.taken[source] || 0) + applied;
      if (this.hp <= 0) this.stats.fatal = source;
    }
    this.effect(0, 0, 'hit', 3);
    if (applied > 0) this.note(`${siegeDamage ? 'Siege bolt' : 'Core hit'}. -${Math.round(applied)} integrity.`, 'damage');
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
