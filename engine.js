import { ENEMIES, UPGRADES, POWERS, DOCTRINES, BLUEPRINTS, SYNERGIES, RUN_PROFILES } from './content.js?v=3.10.0';
import { restoreCheckpoint, clearCheckpoint } from './checkpoint.js?v=3.10.0';

import { createWorkshop, awardSalvage, pickBlueprint } from './workshop.js?v=3.10.0';
import { earnHardpoint, initWeapons, WEAPONS, fireMounts, spreadFire } from './weapons.js?v=3.10.0';
import * as Relics from './relic-effects.js?v=3.10.0';
import { applyEliteTrait, rollEliteTrait, cursed, offerRoute, routeActive, routeWeight, tickRoutes } from './hazards.js?v=3.10.0';
import { applyPerks } from './perks.js?v=3.10.0';

export { ENEMIES, UPGRADES, POWERS, DOCTRINES, BLUEPRINTS, SYNERGIES, RUN_PROFILES };
export const WORLD = Object.freeze({ x: 140, y: 84 });

const SAVE_KEY = 'last-spire.records.v1';
const DAILY_KEY = 'last-spire.daily.v1';
const HIT_RADIUS = 4;
const DRAFT_PERIOD = 120;
const BOSS_PERIOD = 180;
const BOSS_NOTICE = 12;
const RATE_STEP = 1.17;
const DAMAGE_STEP = 2;
const TUNE_FULL = 12;
// Late hostiles harden more slowly than before, to match the gentler power curve.
const ENDURANCE_PACE = 100;
const BASE_LEVELS = { range: 1, rate: 1, damage: 1, splash: 0, crit: 0, chain: 0, armor: 0, regen: 0, bounty: 0,
  lethality: 0, incendiary: 0, chill: 0, hunter: 0, barrier: 0, salvage: 0 };
// Share of the relic pool a run can draw from, so no two runs offer the same relics.
const DECK_SHARE = .55;
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
    const trace = Array.isArray(data?.trace) ? data.trace.filter(Number.isSafeInteger).slice(0, 2000) : [];
    return data?.date === today && Number.isFinite(data.best) ? { date: today, best: data.best, tries: data.tries || 0, trace } : { date: today, best: 0, tries: 0, trace: [] };
  }

  saveDaily(finished = false) {
    if (!this.daily || this.daily !== todayKey()) return;
    const record = this.dailyRecord;
    const better = Math.floor(this.time) > record.best;
    const next = { date: record.date, best: Math.max(record.best, Math.floor(this.time)), tries: record.tries + Number(finished),
      trace: better ? [...(this.stats?.trace || [])] : record.trace };
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
    this.draftReturn = 'running';
    this.stats = { dealt: 0, bestHit: 0, taken: {}, fatal: null, trace: [] };
    this.curses = [];
    this.route = this.path = null;
    this.barrier = 0;
    this.relicState = { streak: 0, streakUntil: 0, plateUntil: 0, hitAt: -1000, echo: 0 };
    this.deck = this.dealDeck();
    initWeapons(this, primaryWeapon);
    applyPerks(this);
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

  // Levels past an upgrade's original cap count for half.
  level(key) {
    const level = this.levels[key] || 0, soft = UPGRADES[key]?.soft ?? Infinity;
    return level <= soft ? level : soft + (level - soft) / 2;
  }

  get range() { return Relics.stat(this, 'range', 37 + 4.5 * (this.level('range') - 1) + this.bonus.range + 12 * (this.powers.scope || 0)); }
  get rate() {
    const base = .85 * RATE_STEP ** (this.level('rate') - 1) + this.bonus.rate;
    const curses = (cursed(this, 'hunger') ? 1.25 : 1) * (cursed(this, 'frenzy') ? 1.3 : 1);
    return Relics.stat(this, 'rate', base * (1 + .01 * this.tuneRanks)) * curses;
  }
  get damage() {
    const base = 8 + DAMAGE_STEP * (this.level('damage') - 1) + this.bonus.damage + (this.powers.reactor || 0);
    return Relics.stat(this, 'damage', base + this.tuneRanks) * (cursed(this, 'glass') ? 1.4 : 1);
  }
  // Core tuning gives double value for its first ranks, then a steady single step.
  get tuneRanks() {
    const tunes = this.workshop.tunes;
    return tunes + Math.min(tunes, TUNE_FULL);
  }
  get splash() { return Relics.stat(this, 'splash', (this.levels.splash ? 5 + 1.7 * this.level('splash') : 0) + 8 * (this.powers.fracture || 0)); }
  get critChance() { return Relics.stat(this, 'critChance', this.level('crit') * .075); }
  get chain() { return Relics.stat(this, 'chain', Math.floor(this.level('chain')) + (this.powers.tesla || 0) + Number(this.synergyActive('rimewire'))); }
  get armor() { return cursed(this, 'rust') ? Relics.stat(this, 'armor', 0) : Relics.stat(this, 'armor', this.level('armor') * 1.5); }
  get regen() { return Relics.stat(this, 'regen', this.level('regen') * .20); }
  get bounty() { return Relics.stat(this, 'bounty', this.level('bounty') * .18); }

  // Deal this run's relic deck: every reserve relic plus a random share of the rest.
  dealDeck() {
    const deck = [];
    for (const tier of ['common', 'uncommon', 'rare']) {
      const pool = Object.keys(POWERS).filter(key => !POWERS[key].reserve && POWERS[key].rarity === tier);
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(this.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      deck.push(...pool.slice(0, Math.max(3, Math.round(pool.length * DECK_SHARE))));
    }
    return [...deck, ...Object.keys(POWERS).filter(key => POWERS[key].reserve)];
  }

  inDeck(key) { return !this.deck || this.deck.includes(key) || Boolean(this.powers[key]); }

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
    const eligible = Object.keys(POWERS).filter(key => this.inDeck(key)
      && (!POWERS[key].maxStacks || (this.powers[key] || 0) < POWERS[key].maxStacks));
    const rare = eligible.filter(key => POWERS[key].rare);
    const regular = eligible.filter(key => !POWERS[key].rare && !POWERS[key].reserve);
    const uncommon = regular.filter(key => POWERS[key].rarity === 'uncommon');
    const common = regular.filter(key => POWERS[key].rarity !== 'uncommon');
    const reserve = eligible.filter(key => POWERS[key].reserve);
    const opening = this.draftHistory.length === 0 && reason !== 'boss';
    const recent = opening ? this.records.openers : this.draftHistory;
    const featured = reason === 'time' || reason === 'bought' || this.random() < .35;
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
    this.draftHistory = [...this.draftHistory, ...choices].slice(-24);
    if (opening) this.saveRecords(0, false, { openers: choices });
    this.choices = choices;
    this.draftReason = reason;
    // A draft opened while paused returns to the pause once a relic is chosen.
    if (this.status === 'running' || this.status === 'paused') this.draftReturn = this.status;
    this.status = 'draft';
  }

  pickPower(key) {
    if (this.status !== 'draft' || !this.choices.includes(key)) return false;
    this.powers[key] = (this.powers[key] || 0) + 1;
    if (key === 'reservoir') { this.maxHp += 12; this.hp += 12; }
    if (key === 'interest') this.scrap += 25 + this.threat * 5;
    if (key === 'repulse') this.pulseAt = this.time + (this.powers.repulse > 1 ? 7 : 10);
    if (key === 'ward') this.wardAt = this.time;
    Relics.onPick(this, key);
    this.note(`Relic installed: ${POWERS[key].name}.`, 'upgrade');
    if (key === 'wildcard') for (let i = 0; i < 2; i++) this.wildRelic();
    this.noteSynergies(key);
    this.choices = [];
    this.draftReason = null;
    this.status = this.draftReturn === 'paused' ? 'paused' : 'running';
    if (this.queue.length) this.openDraft(this.queue.shift());
    return true;
  }

  // Wild card: install a random ordinary relic that still has room to stack.
  wildRelic() {
    const pool = Object.keys(POWERS).filter(key => !POWERS[key].rare && !POWERS[key].reserve && this.inDeck(key)
      && (!POWERS[key].maxStacks || (this.powers[key] || 0) < POWERS[key].maxStacks));
    if (!pool.length) return;
    const key = pool[Math.min(pool.length - 1, Math.floor(this.random() * pool.length))];
    this.powers[key] = (this.powers[key] || 0) + 1;
    Relics.onPick(this, key);
    this.note(`Wild card: ${POWERS[key].name}.`, 'upgrade');
    this.noteSynergies(key);
  }

  spawn(type, x, y, { mini = false, elite = false } = {}) {
    const trait = elite ? rollEliteTrait(this) : null;
    const profile = ENEMIES[type];
    // Smooth growth keeps later minutes responsive to loadout strength and salvage luck.
    const reinforcement = this.time / (this.time + 600);
    const endurance = 1 + this.time / 420 + (this.time / 420) ** 2 + (this.time / ENDURANCE_PACE) ** 3 * reinforcement ** 4;
    const scale = this.encounter.hp * endurance;
    const debt = type === 'sovereign' && cursed(this, 'debt') ? 1.3 : 1;
    const maxHp = Math.max(1, Math.round(profile.hp * scale * (mini ? .47 : elite ? 2.25 : 1) * (cursed(this, 'greed') ? 1.15 : 1) * debt));
    const speed = profile.speed * this.encounter.speed * 1.36 * (1 + Math.min(.75, this.time / 750)) * (mini ? 1.22 : elite ? 1.08 : 1)
      * (cursed(this, 'frenzy') ? 1.1 : 1);
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
    const weight = row => row.weight * (this.encounter.enemyWeights[row.type] ?? 1) * routeWeight(this, row.type);
    let roll = this.random() * rows.reduce((sum, row) => sum + weight(row), 0);
    const { type } = rows.find(row => (roll -= weight(row)) < 0) || rows[rows.length - 1];
    const point = this.entryPoint();
    const elite = this.time >= 300 && this.random() < Math.min(.30, .07 + (this.time - 300) / 1800);
    this.spawn(type, point.x, point.y, { elite });
    this.spawnClock += this.encounter.interval * Math.max(.39, 2.7 / (1 + this.time / 95)) * (.70 + .60 * this.random());
  }

  scheduleBoss() {
    if (!this.warning && this.time >= this.nextBoss - BOSS_NOTICE) {
      this.warning = { type: 'sovereign', at: this.nextBoss, ...this.entryPoint() };
      this.note(`Sovereign approaching from ${this.warning.edge}.`, 'boss');
    }
    if (this.warning && this.time >= this.nextBoss) {
      const { x, y } = this.warning;
      // Each later sovereign adds an attack: escorts, then long-range siege, then splitting.
      const rank = Math.max(1, Math.round((this.nextBoss - 160) / BOSS_PERIOD) + 1);
      const boss = this.spawn('sovereign', x, y);
      boss.rank = rank;
      if (rank >= 2) for (const sign of [-1, 1]) this.spawn('aegis', x * .95 + sign * 4, y * .95 - sign * 3);
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
    tickRoutes(this);
    if (this.daily && this.time >= 30 * (this.stats.trace.length + 1)) this.stats.trace.push(this.kills);
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
      this.hurt(enemy, enemy.burnDps * burningTime * Relics.burnFactor(this));
    }
    if (enemy.hp <= 0) return;
    if (enemy.trait === 'mending' && enemy.hp < enemy.maxHp) enemy.hp = Math.min(enemy.maxHp, enemy.hp + enemy.maxHp * .03 * dt);
    if (enemy.maxShield && this.time - enemy.lastHit >= 7) {
      enemy.shield = Math.min(enemy.maxShield, enemy.shield + dt * enemy.maxShield / 3);
    }
    if (enemy.type === 'cantor' && this.time >= enemy.pulseAt) this.healNearby(enemy);
    if (enemy.boss && this.time >= enemy.pulseAt) {
      enemy.pulseAt = this.time + ((enemy.rank || 1) >= 3 ? 11 : 17);
      const escort = this.random() < .5 ? 'crawler' : 'moth';
      this.spawn(escort, enemy.x * .97, enemy.y * .97);
      this.effect(enemy.x, enemy.y, 'boss', 5);
      if (distance(enemy, CORE) <= ((enemy.rank || 1) >= 3 ? 105 : 70)) {
        this.beam(CORE, 'siege', enemy);
        this.impact(enemy, 5 + this.threat);
      }
    }
    const gap = distance(enemy, CORE);
    let speed = enemy.speed * (this.time < enemy.slowUntil ? .65 : 1);
    if (enemy.type === 'wraith' && (this.time + enemy.phaseOffset) % 6.5 < 1.2) speed *= 2.1;
    if (enemy.type === 'moth' && gap < 32) speed *= 1.4;
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
    this.pulseAt = this.time + (this.powers.repulse > 1 ? 7 : 10);
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
    amount *= Relics.hitFactor(this, enemy, direct);
    this.hurt(enemy, amount);
    if (this.powers.frost) enemy.slowUntil = Math.max(enemy.slowUntil, this.time + (this.powers.frost > 1 ? 5 : 3));
    if (direct && this.levels.chill && enemy.hp > 0 && this.random() < .07 * this.levels.chill) enemy.slowUntil = Math.max(enemy.slowUntil, this.time + 2.5);
    const burn = (this.powers.ember ? (this.powers.ember > 1 ? 1 : .6) : 0) + .08 * (this.levels.incendiary || 0);
    if (ignite && burn && enemy.hp > 0) {
      const remaining = Math.max(0, enemy.burnUntil - this.time) * enemy.burnDps;
      enemy.burnDps = (remaining + amount * burn) / 3;
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
    const role = shot.role || {};
    const critChance = this.critChance + (role.crit || 0) + Relics.critBonus(this, target);
    const crit = critChance > 0 && this.random() < critChance;
    let amount = this.damage * (shot.scale ?? 1) * (crit ? Relics.criticalMultiplier(this) * (role.critPower || 1) : 1);
    if (this.powers.coinflip) amount *= this.random() < .5 ? .5 : 1.7;
    const before = target.hp + target.shield;
    this.beam(target, shot.kind && shot.kind !== 'shot' ? shot.kind : crit ? 'crit' : 'shot');
    this.shots[this.shots.length - 1].crit = crit;
    this.strike(target, amount, true);
    if (this.powers.reaper && !target.boss && target.hp > 0 && this.random() < .02 * this.powers.reaper) {
      this.hurt(target, target.hp + target.shield);
      this.effect(target.x, target.y, 'crit', 7);
    }
    if (target.hp <= 0) Relics.onKillShot(this, target, amount - before);
    if (this.stats && amount > this.stats.bestHit) this.stats.bestHit = amount;
    if (crit || amount >= target.maxHp * .2 || target.boss) this.effect(target.x, target.y, crit ? 'number-crit' : 'number', 1, .65, Math.round(amount));
    if (crit) {
      this.effect(target.x, target.y, 'crit', 5);
      Relics.onCritical(this, target, amount);
    }
    const splash = this.splash * (role.splash ?? 1);
    if (splash > 0) {
      this.effect(target.x, target.y, 'splash', splash);
      const wildfire = this.synergyActive('wildfire');
      const blast = .65 * (1 + .3 * (this.powers.shrapnel || 0));
      for (const enemy of this.enemies) {
        if (enemy === target || enemy.hp <= 0 || distance(enemy, target) > splash) continue;
        this.strike(enemy, amount * blast, false, wildfire);
        if (this.powers.flashbang) enemy.slowUntil = Math.max(enemy.slowUntil, this.time + 1.5);
      }
    }
    const struck = new Set([target.id]);
    for (let bolt = 0; bolt < Math.min(2, this.powers.twinshot || 0); bolt++) {
      const other = this.nearest(CORE, shot.reach ?? this.range, struck);
      if (!other) break;
      struck.add(other.id);
      this.beam(other, 'twin');
      this.strike(other, amount * .65, true);
    }
    let from = target;
    const hops = role.chain === 0 ? 0 : this.chain * (role.chain ?? 1) + (shot.extraChains || 0);
    for (let hop = 0; hop < hops; hop++) {
      const next = this.nearest(from, 23, struck);
      if (!next) break;
      this.beam(next, 'chain', from);
      this.strike(next, amount * .70 * .88 ** hop * (this.powers.conductor ? 1.3 : 1));
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
    const jackpot = this.powers.jackpot && this.random() < (this.powers.jackpot > 1 ? 1 / 6 : .1);
    const payout = (cursed(this, 'greed') ? 1.5 : 1) * (routeActive(this, 'convoy') ? 1.25 : 1) * (jackpot ? 3 : 1)
      * (this.powers.warrant && (enemy.elite || enemy.boss) ? 2 : 1);
    const bounty = Math.round(Relics.bounty(this, enemy, base) * payout);
    this.scrap += bounty;
    this.effect(enemy.x, enemy.y, 'kill', 2.5);
    this.note(`${ENEMIES[enemy.type].name} destroyed. +${bounty} scrap.`, 'kill');
    awardSalvage(this, enemy);
    Relics.onDeath(this, enemy);
    if (enemy.boss) {
      this.bossKills++;
      earnHardpoint(this);
      this.queue.push('boss');
      if (!this.route) offerRoute(this);
      this.effect(enemy.x, enemy.y, 'bossfall', 22, 1);
      this.note('Sovereign defeated. Rare relic recovered.', 'boss');
    }
  }

  resolveContacts() {
    const atCore = enemy => enemy.x ** 2 + enemy.y ** 2 <= HIT_RADIUS ** 2;
    if (!this.enemies.some(enemy => enemy.hp <= 0 || atCore(enemy))) return;
    const removed = new Set();
    const brood = [];
    const halves = [];
    let killed = 0;
    // Explosions and return fire can change another contact's fate during the same tick.
    for (;;) {
      const fallen = this.enemies.find(enemy => enemy.hp <= 0 && !removed.has(enemy.id));
      if (fallen) {
        removed.add(fallen.id);
        this.rewardKill(fallen);
        killed++;
        if (fallen.type === 'splitter' || fallen.trait === 'volatile') brood.push(fallen);
        if (fallen.boss && fallen.rank >= 4) halves.push(fallen);
        spreadFire(this, fallen);
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
    for (const boss of halves) {
      for (const sign of [-1, 1]) {
        const half = this.spawn('sovereign', boss.x * .97 + sign * 5, boss.y * .97 - sign * 3);
        half.boss = false;
        half.elite = true;
        half.hp = half.maxHp = Math.max(1, Math.round(boss.maxHp * .35));
        half.reward = Math.round(boss.reward / 2);
      }
      this.effect(boss.x, boss.y, 'split', 9);
    }
    if (killed) this.salvage(killed);
  }

  impact(enemy, siegeDamage = 0) {
    if (this.powers.ward && this.time >= this.wardAt) {
      this.wardAt = this.time + (this.powers.ward > 1 ? 14 : 24);
      this.effect(0, 0, 'ward', 8, .65);
      this.note('Phase ward absorbed an impact.', 'system');
      return;
    }
    const damage = Math.max(1, Math.round((siegeDamage || enemy.damage) - this.armor));
    let applied = Relics.impact(this, enemy, damage);
    if (this.relicState) this.relicState.hitAt = this.time;
    if (applied > 0 && this.barrier > 0) {
      const absorbed = Math.min(this.barrier, applied);
      this.barrier -= absorbed;
      applied -= absorbed;
      this.effect(0, 0, 'ward', 6, .4);
    }
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
    if (this.powers.midas && this.hp > 0) Relics.midas(this, previous, this.kills);
    const oldRank = this.progress.rank;
    this.saveRecords(count);
    for (const unlock of this.progress.unlocks.slice(oldRank)) this.note(`Blueprint unlocked: ${unlock.name}.`, 'unlock');
  }
}
