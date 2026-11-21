import { SPEEDS, SimulationClock } from './clock.js?v=3.0.0';
import { initAppearance } from './appearance.js?v=3.0.0';
import { workbench } from './workbench-ui.js?v=3.0.0';
import { pickBlueprint } from './workshop.js?v=3.0.0';
import { WEAPONS, maxWeaponRange } from './weapons.js?v=3.0.0';
import { Game, formatTime } from './engine.js?v=3.0.0';
import { DOCTRINES, ENEMIES, POWERS, RUN_PROFILES, SYNERGIES } from './content.js?v=3.0.0';
import { TITLE, PORTRAIT, ENEMY_PORTRAITS } from './art.js?v=3.0.0';
import { Field } from './field.js?v=3.0.0';
import { saveCheckpoint } from './checkpoint.js?v=3.0.0';
import { runPanels } from './run-panels.js?v=3.0.0';
import { $, pad, decorateFrame, drawStats, element, setText, tierName } from './ui.js?v=3.0.0';

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
const shop = workbench(game, {changed: commitAction, showMount: slot => panels.showDossier('armory', slot)});
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
  const flags = enemy && [enemy.shield > 0 ? 'Shield ' + Math.ceil(enemy.shield) : '', enemy.burnUntil > game.time ? 'Burning' : '', enemy.slowUntil > game.time ? 'Slowed' : ''].filter(Boolean);
  const stats = enemy
    ? [['Integrity', Math.ceil(enemy.hp) + '/' + Math.ceil(enemy.maxHp)], ['Impact', enemy.damage + ' HP'], [flags.length ? 'Status' : 'Speed', flags.length ? flags.join(' / ') : concise(enemy.speed) + ' u/s'], ['Bounty', '$' + enemy.reward]]
    : [['Damage', concise(game.damage) + ' HP'], ['Max reach', concise(maxWeaponRange(game)) + ' u'], ['Main rate', (game.rate * WEAPONS[game.armory.mounts[0].key].cadence).toFixed(2) + '/s'], ['Splash', game.splash ? concise(game.splash) + ' u' : 'Off']];
  const signature = [enemy?.id || 'tower', enemy?.tier, game.doctrine, game.armory.mounts[0].key, game.focusId, JSON.stringify(stats)].join('/');
  if (signature === inspectedSnapshot) return;
  inspectedSnapshot = signature;
  setText($('portrait'), (enemy ? ENEMY_PORTRAITS[enemy.type] : PORTRAIT).join('\n'));
  setText($('entity-class'), enemy ? (enemy.boss ? '[!] BOSS' : enemy.elite ? '[!] ELITE' : '[-] HOSTILE') : '[+] FRIENDLY');
  setText($('entity-name'), enemy ? type.name : 'The Spire');
  setText($('entity-type'), enemy ? 'Tier ' + tierName(enemy.tier) + ' / ' + type.trait : WEAPONS[game.armory.mounts[0].key].name);
  $('entity-type').title = type?.description || 'Prioritizes the closest hostile in range.';
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
function updateRack() {
  const owned = Object.keys(game.powers).filter(k => game.powers[k] > 0);
  setText($('relic-timer'), 'DRAFT IN ' + formatTime(Math.ceil(Math.max(0, game.nextDraft - game.time))));
  const combos = Object.keys(SYNERGIES).filter(key => game.synergyActive(key));
  const sig = [combos.join(), game.starterReady, game.status === 'over', ...owned.map(k => k + game.powers[k])].join('-');
  if (rackSignature === sig) return;
  rackSignature = sig;
  const ready = game.starterReady && game.status !== 'over';
  setText($('rack-action'), ready ? '[ Choose starting relic ]' : '[ View build / ' + owned.length + ' ]');
  $('rack-action').classList.toggle('ready',ready);
  const last = owned.at(-1);
  setText($('rack-summary'), ready ? '' : combos.length ? 'Active: ' + combos.map(k => SYNERGIES[k].name).join(', ') : last ? POWERS[last].name + (owned.length > 1 ? '  +' + (owned.length - 1) + ' more' : '') : 'No relics installed');
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
function updateStatus() {
  if (game.status === 'draft' || game.status === 'cache') appearance.close();
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
  setText($('overlay-kicker'), 'RUN ' + pad(game.run,3) + '  //  ' + DOCTRINES[game.doctrine].name.toUpperCase());
  setText($('overlay-title'),over ? 'The Spire fell.' : 'Paused');
  setText($('overlay-detail'), over ? 'Survived ' + formatTime(game.time) + '  /  ' + game.kills + ' kills\nSovereigns defeated: ' + game.bossKills + '  /  Best: ' + formatTime(game.best) : 'Survival time ' + formatTime(game.time));
  setText($('overlay-action'),over ? '[ Rebuild spire ]' : '[ Resume ]');
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
  shop.render(); updateRack(); updateSiege();
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
function restart(key, primary = game.armory.mounts[0].key) {
  game.restart(key,primary);
  selectTab(false);
  shop.select('salvage');
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
  if (game.status === 'over') return restart(game.doctrine);
  game.togglePause();
  saveCheckpoint(game); refreshUI();
}
$('pause').addEventListener('click', togglePlay);
$('overlay-action').addEventListener('click', togglePlay);
$('overlay-loadout').addEventListener('click', () => panels.showDossier('loadouts'));
$('rack-action').addEventListener('click', () => {
  if (game.starterReady && game.status !== 'over' && game.openStarter()) {
    saveCheckpoint(game); refreshUI();
  } else panels.showDossier('build');
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
    if (/^[1-3]$/.test(event.key)) {
      event.preventDefault();
      const i = Number(event.key) - 1;
      if (performance.now() - lastChoiceAt > 240) installRelic(game.status === 'cache' ? game.workshop.offer[i]?.key : game.choices[i]);
    }
    return;
  }
  if (event.code === 'Space' && !event.target.closest('button')) {
    event.preventDefault(); togglePlay();
  }
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
renderHud();
requestAnimationFrame(frame);
