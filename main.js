import { SPEEDS, SimulationClock } from './clock.js?v=3.5.0';
import { initAppearance } from './appearance.js?v=3.5.0';
import { workbench } from './workbench-ui.js?v=3.5.0';
import { pickBlueprint, fitChoices, workshopCosts } from './workshop.js?v=3.5.0';
import { maxWeaponRange, mountStats, mountTitle, WEAPON_COMBOS, weaponComboActive } from './weapons.js?v=3.5.0';
import { Game, formatTime } from './engine.js?v=3.5.0';
import { ELITE_TRAITS, ROUTES, chooseRoute, CURSES } from './hazards.js?v=3.5.0';
import { ENEMIES, POWERS, RUN_PROFILES, SYNERGIES, UPGRADES } from './content.js?v=3.5.0';
import { TITLE, PORTRAIT, ENEMY_PORTRAITS } from './art.js?v=3.5.0';
import { Field } from './field.js?v=3.5.0';
import { saveCheckpoint } from './checkpoint.js?v=3.5.0';
import { runPanels } from './run-panels.js?v=3.5.0';
import { $, pad, decorateFrame, drawStats, element, setText, tierName } from './ui.js?v=3.5.0';

const root = document.documentElement;
function preference(key, fallback) {
  try { return localStorage.getItem('last-spire.' + key) || fallback; } catch { return fallback; }
}
function savePreference(key, value) {
  try { localStorage.setItem('last-spire.' + key, value); } catch { /* The current session still works. */ }
}

const game = new Game({ resume: true });
const field = new Field($('field'), game, inspect);
const clock = new SimulationClock();
let speed = Number(preference('speed','1'));
if (!SPEEDS.includes(speed)) speed = 1;
const side = document.querySelector('.side');
const dialog = $('record-dialog');
const cursor = $('ascii-cursor');
const panels = runPanels(game, {pick: installRelic, start: restart, refresh: refreshUI, changed: commitAction});
let nextCheckpoint = 0;
let rackSignature = '';
let previousDraft = '';
let lastChoiceAt = -Infinity;
let sound = preference('sound', 'off') === 'on';
let audio;
let logHead;
let previousKills = 0;
let previousHp = game.hp;
let previousStatus;
let lastProfile = '';
let inspectedSnapshot = '';
let nextHud = 0;
let previousFrame;
let nextDraw = 0;

$('wordmark').textContent = TITLE.join('\n');
root.style.setProperty('--rule', '"' + '-'.repeat(512) + '"');
document.querySelectorAll('.frame').forEach(decorateFrame);

const appearance = initAppearance({onChange: () => field.render(game.time)});
const shop = workbench(game, {changed: commitAction});
function updateSpeed() {
  for (const button of $('speed-controls').children) {
    if (button.dataset.speed) button.setAttribute('aria-pressed',String(Number(button.dataset.speed) === speed));
  }
}
for (const rate of SPEEDS) {
  const button = element('button','speed-button',rate + 'x');
  button.dataset.speed = String(rate);
  button.setAttribute('aria-label','Game speed ' + rate + 'x');
  button.addEventListener('click',() => {
    speed = rate;
    previousFrame = undefined;
    clock.reset();
    savePreference('speed',String(rate));
    updateSpeed();
  });
  $('speed-controls').append(button);
}
updateSpeed();
function playTone(pitch, duration = 0.06, type = 'triangle') {
  if (!sound || audio?.state !== 'running') return;
  const oscillator = audio.createOscillator();
  const volume = audio.createGain();
  const at = audio.currentTime;
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(pitch, at);
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(30, pitch * 0.65), at + duration);
  volume.gain.setValueAtTime(0.045, at);
  volume.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  oscillator.connect(volume).connect(audio.destination);
  oscillator.onended = () => { oscillator.disconnect(); volume.disconnect(); };
  oscillator.start();
  oscillator.stop(at + duration);
}
// Short tone sequences give each kind of event its own voice.
const CUES = {
  boss: [[110, .32, 'sawtooth'], [82, .4, 'sawtooth', .18]],
  upgrade: [[660, .07], [880, .1, 'triangle', .07]],
  unlock: [[523, .08], [659, .08, 'triangle', .08], [784, .14, 'triangle', .16]],
  event: [[392, .06, 'square'], [392, .06, 'square', .1], [587, .12, 'square', .2]],
  cache: [[740, .05], [988, .09, 'triangle', .06]],
  draft: [[440, .12], [554, .12, 'triangle', .04], [659, .18, 'triangle', .08]],
  system: [[300, .05]]
};
const cueTimes = {};
function cue(name) {
  const notes = CUES[name];
  const now = performance.now();
  if (!notes || now - (cueTimes[name] || 0) < 160) return;
  cueTimes[name] = now;
  for (const [pitch, duration, type = 'triangle', delay = 0] of notes) {
    if (delay) window.setTimeout(() => playTone(pitch, duration, type), delay * 1000);
    else playTone(pitch, duration, type);
  }
}
let heardLog;
function soundLog() {
  const fresh = [];
  for (const item of game.log) {
    if (item === heardLog) break;
    fresh.push(item);
    if (fresh.length > 6) break;
  }
  heardLog = game.log[0];
  for (const item of fresh) {
    if (/cache recovered/i.test(item.text)) cue('cache');
    else if (item.type === 'boss' || item.type === 'unlock' || item.type === 'event') cue(item.type);
    else if (item.type === 'upgrade') cue('upgrade');
  }
}
function activateAudio() {
  if (!sound || !window.AudioContext) return;
  try {
    audio ||= new AudioContext();
    if (audio.state === 'suspended') audio.resume().catch(() => {});
  } catch { /* Browsers without an audio output can still play. */ }
}
function soundLabel() {
  setText($('sound-state'), sound ? 'on' : 'off');
  $('sound').setAttribute('aria-pressed', String(sound));
  $('sound').setAttribute('aria-label', sound ? 'Mute sound' : 'Enable sound');
}
$('sound').addEventListener('click', () => {
  sound = !sound;
  savePreference('sound', sound ? 'on' : 'off');
  activateAudio(); soundLabel(); playTone(480);
});
document.addEventListener('pointerdown', activateAudio, {once:true});
document.addEventListener('keydown', activateAudio, {once:true});
soundLabel();

function selectTab(inspector) {
  side.classList.toggle('show-inspector', inspector);
  $('tab-inspector').setAttribute('aria-pressed', String(inspector));
  $('tab-upgrades').setAttribute('aria-pressed', String(!inspector));
}
$('tab-inspector').addEventListener('click', () => selectTab(true));
$('tab-upgrades').addEventListener('click', () => selectTab(false));
function inspect(id) {
  if (!game.inspect(id)) return;
  selectTab(true);
  renderInspector();
  setText($('announcer'), 'Inspecting ' + $('entity-name').textContent);
  playTone(360, 0.035);
}

function renderInspector() {
  const enemy = game.enemies.find(e => e.id === game.selected);
  const type = enemy && ENEMIES[enemy.type];
  const flags = enemy && [ELITE_TRAITS[enemy.trait]?.name || '', enemy.shield > 0 ? 'Shield ' + Math.ceil(enemy.shield) : '', enemy.burnUntil > game.time ? 'Burning' : '', enemy.slowUntil > game.time ? 'Slowed' : ''].filter(Boolean);
  const stats = enemy
    ? [['Integrity', Math.ceil(enemy.hp) + '/' + Math.ceil(enemy.maxHp)], ['Impact', enemy.damage + ' HP'], [flags.length ? 'Status' : 'Speed', flags.length ? flags.join(' / ') : concise(enemy.speed) + ' u/s'], ['Bounty', '$' + enemy.reward]]
    : [['Damage', concise(game.damage) + ' HP'], ['Max reach', concise(maxWeaponRange(game)) + ' u'], ['Main rate', (game.rate * mountStats(game.armory.mounts[0], game).cadence).toFixed(2) + '/s'], ['Splash', game.splash ? concise(game.splash) + ' u' : 'Off']];
  const signature = [enemy?.id || 'tower', enemy?.tier, game.doctrine, mountTitle(game.armory.mounts[0]), game.focusId, JSON.stringify(stats)].join('/');
  if (signature === inspectedSnapshot) return;
  inspectedSnapshot = signature;
  setText($('portrait'), (enemy ? ENEMY_PORTRAITS[enemy.type] : PORTRAIT).join('\n'));
  setText($('entity-class'), enemy ? (enemy.boss ? '[!] BOSS' : enemy.elite ? '[!] ELITE' : '[-] HOSTILE') : '[+] FRIENDLY');
  setText($('entity-name'), enemy ? type.name + (enemy.rank > 1 ? ' ' + tierName(Math.min(4, enemy.rank)) : '') : 'The Spire');
  setText($('entity-type'), enemy ? 'Tier ' + tierName(enemy.tier) + ' / ' + type.trait : mountTitle(game.armory.mounts[0]));
  $('entity-type').title = (type?.description || 'Prioritizes the closest hostile in range.') + (enemy?.trait ? ' ' + ELITE_TRAITS[enemy.trait].description : '');
  setText($('inspect-action'), enemy ? game.focusId === enemy.id ? '[ Release ]' : '[ Focus fire ]' : '[ Build ]');
  $('inspect-action').setAttribute('aria-haspopup', enemy ? 'false' : 'dialog');
  $('inspect-action').setAttribute('aria-label', enemy ? game.focusId === enemy.id ? 'Release focus fire' : 'Focus fire on ' + type.name : 'Inspect tower build');
  drawStats($('entity-stats'),stats,true);
}
$('inspect-action').addEventListener('click', () => {
  if (game.selected === 'tower') return panels.showDossier('build');
  game.focus(game.selected); saveCheckpoint(game); refreshUI();
});
function renderLog() {
  if (logHead === game.log[0]) return;
  logHead = game.log[0];
  const messages = game.log.slice(0,3).map((item,i) => {
    const line = element('li');
    line.append(element('time','',formatTime(item.time)), element('span','log-pointer',i ? '.' : '>'), element('span','',item.text));
    return line;
  });
  $('messages').replaceChildren(...messages);
}
function concise(value) { return String(Number(value.toFixed(1))); }
function activeCombos() {
  return [...Object.keys(SYNERGIES).filter(key => game.synergyActive(key)).map(key => SYNERGIES[key].name),
    ...Object.keys(WEAPON_COMBOS).filter(key => weaponComboActive(game, key)).map(key => WEAPON_COMBOS[key].name)];
}
function updateRack() {
  const owned = Object.keys(game.powers).filter(k => game.powers[k] > 0);
  setText($('relic-timer'), 'DRAFT IN ' + formatTime(Math.ceil(Math.max(0, game.nextDraft - game.time))));
  const combos = activeCombos();
  const sig = [combos.join(), game.starterReady, game.status === 'over', ...owned.map(k => k + game.powers[k])].join('-');
  if (rackSignature === sig) return;
  rackSignature = sig;
  const ready = game.starterReady && game.status !== 'over';
  setText($('rack-action'), ready ? '[ Choose starting relic ]' : '[ View build / ' + owned.length + ' ]');
  $('rack-action').classList.toggle('ready',ready);
  const last = owned.at(-1);
  setText($('rack-summary'), ready ? '' : combos.length ? 'Active: ' + combos.join(', ') : last ? POWERS[last].name + (owned.length > 1 ? '  +' + (owned.length - 1) + ' more' : '') : 'No relics installed');
}
function updateSiege() {
  const boss = game.enemies.find(enemy => enemy.boss);
  const banner = $('siege-alert');
  banner.hidden = !boss && !game.warning;
  if (banner.hidden) return;
  if (boss) {
    const filled = Math.max(0, Math.min(12, Math.ceil(12 * boss.hp / boss.maxHp)));
    setText(banner, '[!] SOVEREIGN  [' + '#'.repeat(filled) + '.'.repeat(12-filled) + '] ' + Math.ceil(boss.hp) + ' HP');
  } else {
    const secs = Math.max(0, Math.ceil(game.warning.at - game.time));
    setText(banner, '[!] SIEGE FROM ' + String(game.warning.edge).toUpperCase() + '  /  ' + secs + 's');
  }
}
function updateRoute() {
  const box = $('route');
  box.hidden = !game.route || game.status === 'over';
  if (box.hidden) return;
  setText($('route-clock'), Math.max(0, Math.ceil(game.route.expires - game.time)) + 's');
  game.route.options.forEach((key, i) => {
    const button = $('route-' + i), route = ROUTES[key];
    if (button.dataset.key === key) return;
    button.dataset.key = key;
    button.replaceChildren(element('b', '', '[' + (i + 1) + ']'), element('span', '', route.name), element('small', '', route.foes + '. ' + route.reward + '.'));
  });
}
function pickRoute(i) {
  if (chooseRoute(game, i)) commitAction();
}
$('route-0').addEventListener('click', () => pickRoute(0));
$('route-1').addEventListener('click', () => pickRoute(1));

// One-time tips for new players, each shown once and all switchable off.
const TIPS = [
  ['focus', () => game.time > 2, 'Click an enemy to focus fire on it.'],
  ['pause', () => game.time > 25, 'Space pauses and resumes.'],
  ['cache', () => game.workshop.caches > 0 && game.time > 8, 'Press C to open a big cache.'],
  ['forge', () => game.scrap >= workshopCosts(game).forge[0], 'Click a weapon to forge it a grade higher.'],
  ['route', () => Boolean(game.route), 'Press 1 or 2 to choose a route.']
];
let tipsSeen = new Set(preference('tips', '').split(',').filter(Boolean));
let tipShown = null, tipUntil = 0;
function updateTip() {
  const now = performance.now();
  if (tipShown && now < tipUntil && game.status !== 'over') return;
  tipShown = null;
  $('tip').hidden = true;
  if (tipsSeen.has('off') || game.status !== 'running') return;
  const next = TIPS.find(([key, ready]) => !tipsSeen.has(key) && ready());
  if (!next) return;
  tipShown = next[0];
  tipUntil = now + 7000;
  tipsSeen.add(next[0]);
  savePreference('tips', [...tipsSeen].join(','));
  setText($('tip-text'), next[2]);
  $('tip').hidden = false;
}
$('tip-close').addEventListener('click', () => {
  tipsSeen.add('off');
  savePreference('tips', [...tipsSeen].join(','));
  $('tip').hidden = true;
});


// On the daily challenge, compare kills with your best attempt at the same mark.
function raceMark() {
  if (!game.daily) return [];
  const trace = game.dailyRecord.trace;
  const mark = Math.floor(game.time / 30) - 1;
  if (!trace.length || mark < 0) return [];
  if (mark >= trace.length) return [element('b', 'race', 'PAST BEST')];
  const lead = game.kills - trace[mark];
  return [element('b', 'race', 'BEST ' + (lead >= 0 ? '+' : '') + lead)];
}

// The next three minutes as a character strip: D draft, B sovereign.
const TIMELINE_SPAN = 180, TIMELINE_CELLS = 30;
function updateTimeline() {
  const cells = Array(TIMELINE_CELLS).fill('-');
  const mark = (at, glyph) => {
    const offset = at - game.time;
    if (offset < 0 || offset > TIMELINE_SPAN) return;
    const i = Math.min(TIMELINE_CELLS - 1, Math.floor(offset / TIMELINE_SPAN * TIMELINE_CELLS));
    cells[i] = glyph;
  };
  mark(game.nextDraft, 'D');
  mark(game.warning ? game.warning.at : game.nextBoss, 'B');
  const line = cells.join('') + raceMark().map(item => item.textContent).join();
  const node = $('timeline');
  if (node.dataset.line === line) return;
  node.dataset.line = line;
  node.replaceChildren('NOW ', ...[...cells.join('')].map(glyph => glyph === '-' ? glyph : element('b', '', glyph)), ' +3:00', ...raceMark());
  node.setAttribute('aria-label', 'Next draft in ' + formatTime(game.nextDraft - game.time) + ', next sovereign in ' + formatTime((game.warning ? game.warning.at : game.nextBoss) - game.time));
}

// The combo closest to completion, for a run that ended without one.
function nearestCombo() {
  const near = Object.values(SYNERGIES).filter(combo => game.powers[combo.power])
    .sort((a, b) => (a.level - game.levels[a.upgrade]) - (b.level - game.levels[b.upgrade]))[0];
  return near ? 'None (' + near.name + ' needed ' + UPGRADES[near.upgrade].label + ' Lv.' + near.level + ')' : '';
}

function summaryRows() {
  const stats = game.stats || {};
  const sourceName = key => key === 'siege' ? 'Sovereign siege bolts' : ENEMIES[key]?.name || 'Unknown';
  const taken = Object.entries(stats.taken || {}).sort((a, b) => b[1] - a[1]);
  const relics = Object.entries(game.powers).filter(([, rank]) => rank > 0).map(([key, rank]) => POWERS[key].name + (rank > 1 ? ' x' + rank : ''));
  const combos = activeCombos();
  const rows = [
    ['Fell to', stats.fatal ? sourceName(stats.fatal) : 'Unknown'],
    ['Most damage from', taken.length ? sourceName(taken[0][0]) + ' (' + Math.round(taken[0][1]) + ')' : 'Nothing'],
    ['Damage dealt', Math.round(stats.dealt || 0).toLocaleString()],
    ['Biggest hit', Math.round(stats.bestHit || 0)],
    ['Weapons', game.armory.mounts.map(mountTitle).join(', ')],
    ['Relics', relics.length ? relics.slice(0, 4).join(', ') + (relics.length > 4 ? ' +' + (relics.length - 4) : '') : 'None'],
    ['Best combo', combos.length ? combos.join(', ') : nearestCombo() || 'None active'],
    ['Curses', game.curses?.length ? game.curses.map(key => CURSES[key].name).join(', ') : 'None']
  ];
  if (game.daily) rows.unshift(['Daily ' + game.daily, 'Best ' + formatTime(game.dailyRecord.best)]);
  return rows;
}

function updateStatus() {
  if (game.status === 'draft' || game.status === 'cache') appearance.close();
  if ((game.status === 'draft' || game.status === 'cache') && previousStatus !== game.status) cue('draft');
  panels.syncDraft();
  if (previousStatus === game.status) return;
  previousStatus = game.status;
  const over = game.status === 'over';
  const active = game.status === 'running';
  const draft = game.status === 'draft' || game.status === 'cache';
  setText($('pause-icon'), active ? 'II' : '>');
  setText($('pause-text'), over ? 'Retry' : active ? 'Pause' : draft ? 'Choose' : 'Resume');
  $('pause').disabled = draft;
  setText($('live'), active ? '[*] LIVE' : over ? '[x] OFFLINE' : draft ? (game.status === 'cache' ? '[+] CACHE' : '[*] DRAFT') : '[=] PAUSED');
  $('live').classList.toggle('idle',!active);
  $('field-overlay').hidden = active || draft;
  if (active || draft) return;
  setText($('overlay-kicker'), 'RUN ' + pad(game.run,3));
  setText($('overlay-title'),over ? 'The Spire fell.' : 'Paused');
  setText($('overlay-detail'), over ? 'Survived ' + formatTime(game.time) + '  /  ' + game.kills + ' kills\nSovereigns defeated: ' + game.bossKills + '  /  Best: ' + formatTime(game.best) : 'Survival time ' + formatTime(game.time));
  setText($('overlay-action'),over ? '[ Rebuild spire ]' : '[ Resume ]');
  $('overlay-summary').hidden = !over;
  $('overlay-daily').hidden = !over;
  if (over) {
    drawStats($('overlay-summary'), summaryRows());
    setText($('overlay-daily'), game.daily ? '[ Retry daily challenge ]' : '[ Daily challenge ' + game.dailyRecord.date + ' ]');
  }
  if (over) setText($('announcer'),'The Spire fell. Rebuild or choose a new loadout.');
}
function renderHud() {
  setText($('clock'), formatTime(game.time));
  setText($('health'), Math.ceil(100 * game.hp / game.maxHp));
  const segments = Math.max(0, Math.min(8, Math.ceil(8 * game.hp / game.maxHp)));
  setText($('hull-meter'),'[' + '|'.repeat(segments) + '.'.repeat(8-segments) + ']');
  setText($('scrap'), game.scrap);
  setText($('available-scrap'), '$' + game.scrap);
  setText($('kills'), game.kills);
  setText($('threat'), pad(game.threat));
  setText($('threat-label'), game.threat < 2 ? 'LOW' : game.threat < 4 ? 'RISING' : game.threat < 7 ? 'HIGH' : 'SEVERE');
  setText($('run-number'), 'RUN ' + pad(game.run,3));
  if (lastProfile !== game.profile) {
    lastProfile = game.profile;
    const profile = RUN_PROFILES[game.profile];
    setText($('field-profile'),'/ ' + profile.name);
    $('field-profile').title = profile.description + ' ' + profile.tactic;
  }
  shop.render(); updateRack(); updateSiege(); updateRoute(); updateTimeline(); updateTip(); soundLog();
  const coord = value => (value < 0 ? '-' : '+') + pad(Math.min(999,Math.abs(Math.round(value || 0))),3);
  setText($('coord-x'),coord(field.pointer?.x));
  setText($('coord-y'),coord(field.pointer?.y));
  if (game.hp < previousHp) playTone(100, 0.2, 'sawtooth');
  else if (game.kills > previousKills) playTone(230, 0.06, 'square');
  previousHp = game.hp; previousKills = game.kills;
  renderInspector(); renderLog(); updateStatus();
}
function refreshUI() {
  previousFrame = undefined;
  clock.reset();
  renderHud(); field.render(game.time);
}
function commitAction() {
  saveCheckpoint(game);
  playTone(580, 0.08);
  setText($('announcer'), game.log[0]?.text || '');
  refreshUI();
}
// Every run opens with the starting relic pick.
function openStartingRelic() {
  if (game.starterReady && game.time < 1 && game.status === 'running') game.openStarter();
}
function restart(key, options = {}) {
  game.restart(key, null, options);
  openStartingRelic();
  selectTab(false);
  saveCheckpoint(game);
  refreshUI();
}
function installRelic(key) {
  if (game.status === 'cache') {
    if (pickBlueprint(game,key)) { lastChoiceAt = performance.now(); commitAction(); }
    return;
  }
  if (!key || !game.pickPower(key)) return;
  lastChoiceAt = performance.now();
  saveCheckpoint(game);
  playTone(720, 0.15);
  setText($('announcer'), POWERS[key].name + ' installed.');
  refreshUI();
}
function togglePlay() {
  if (dialog.open || game.status === 'draft' || game.status === 'cache') return;
  if (game.status === 'over') return restart('sentinel', { daily: Boolean(game.daily) });
  game.togglePause();
  saveCheckpoint(game); refreshUI();
}
$('pause').addEventListener('click', togglePlay);
$('overlay-action').addEventListener('click', togglePlay);
$('overlay-loadout').addEventListener('click', () => panels.showDossier('loadouts'));
$('overlay-daily').addEventListener('click', () => restart('sentinel', { daily: true }));
$('rack-action').addEventListener('click', () => {
  if (game.starterReady && game.status !== 'over' && game.openStarter()) {
    saveCheckpoint(game); refreshUI();
  } else panels.showDossier('build');
});
field.showNumbers = preference('numbers', 'on') === 'on';
function numbersLabel() {
  $('numbers-toggle').setAttribute('aria-pressed',String(field.showNumbers));
  setText($('numbers-toggle'),(field.showNumbers ? '[x]' : '[ ]') + ' Numbers');
}
numbersLabel();
$('numbers-toggle').addEventListener('click', () => {
  field.showNumbers = !field.showNumbers;
  savePreference('numbers', field.showNumbers ? 'on' : 'off');
  numbersLabel();
  field.render(game.time);
});
field.showRange = true;
$('range-toggle').addEventListener('click', () => {
  field.showRange = !field.showRange;
  $('range-toggle').setAttribute('aria-pressed',String(field.showRange));
  setText($('range-toggle'),(field.showRange ? '[x]' : '[ ]') + ' Range');
  field.render(game.time);
});

$('records').addEventListener('click', () => { appearance.close(); panels.showDossier('build'); });
$('field-profile').addEventListener('click',() => panels.showDossier('build'));
document.querySelector('.feed').addEventListener('click',() => panels.showDossier('log'));
document.addEventListener('keydown', event => {
  if (event.altKey || event.ctrlKey || event.metaKey || event.repeat || dialog.open || appearance.isOpen || event.defaultPrevented) return;
  if (game.status === 'draft' || game.status === 'cache') {
    if (/^[1-4]$/.test(event.key)) {
      event.preventDefault();
      const i = Number(event.key) - 1;
      const cache = game.status === 'cache';
      const keys = cache ? (game.workshop.pending ? fitChoices(game) : game.workshop.offer).map(item => item.key) : game.choices;
      if (performance.now() - lastChoiceAt > 240) installRelic(keys[i]);
    }
    return;
  }
  // Space pauses from anywhere, including after a button was clicked and kept focus.
  if (event.code === 'Space' && !event.target.closest('input, textarea, select, [contenteditable]')) {
    event.preventDefault();
    if (event.target.closest('button')) event.target.blur();
    togglePlay();
    return;
  }
  if (game.route && (event.key === '1' || event.key === '2')) { event.preventDefault(); pickRoute(Number(event.key) - 1); return; }
  if (event.key.toLowerCase() === 'c') { event.preventDefault(); shop.open(); }
  if (event.key === 'Escape' && game.status !== 'over') { event.preventDefault(); togglePlay(); }
});
const fullscreen = $('fullscreen');
fullscreen.hidden = !document.fullscreenEnabled;
fullscreen.addEventListener('click', async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await root.requestFullscreen();
  } catch {
    setText($('announcer'), 'Use your browser controls to enter fullscreen.');
    setText(fullscreen, '[ Use browser fullscreen ]');
    window.setTimeout(() => {
      if (!document.fullscreenElement) setText(fullscreen, '[ Fullscreen ]');
    }, 3000);
  }
});
document.addEventListener('fullscreenchange', () => {
  const active = Boolean(document.fullscreenElement);
  setText(fullscreen, active ? '[ Exit fullscreen ]' : '[ Fullscreen ]');
  fullscreen.setAttribute('aria-pressed', String(active));
});
const pointerMedia = matchMedia('(pointer:fine)');
root.classList.add('cursor-ready');
document.addEventListener('pointermove', event => {
  if (!pointerMedia.matches || event.pointerType === 'touch') return;
  root.classList.add('custom-pointer');
  cursor.style.left = (event.clientX - 5) + 'px';
  cursor.style.top = (event.clientY - 9) + 'px';
}, {passive:true});
document.addEventListener('pointerout', event => {
  if (!event.relatedTarget) root.classList.remove('custom-pointer');
});

function frame(now) {
  if (!document.hidden) {
    const dt = previousFrame === undefined ? 0 : Math.min((now - previousFrame) / 1000,0.15);
    clock.advance(game,dt,speed);
    const draftID = game.status === 'draft' ? game.draftReason + game.choices.join() : '';
    if (draftID !== previousDraft || (game.status === 'running' && now >= nextCheckpoint)) {
      saveCheckpoint(game);
      nextCheckpoint = now + 4000;
    }
    previousDraft = draftID;
    if (now >= nextDraw) {
      field.render(game.time);
      nextDraw = now + 1000 / 32;
    }
    if (now >= nextHud) { renderHud(); nextHud = now + 100; }
  }
  previousFrame = now;
  requestAnimationFrame(frame);
}
function storeSession() {
  game.saveRecords();
  saveCheckpoint(game);
}
document.addEventListener('visibilitychange', () => {
  previousFrame = undefined;
  clock.reset();
  if (document.hidden) storeSession();
});
window.addEventListener('pagehide', storeSession);
openStartingRelic();
renderHud();
requestAnimationFrame(frame);
