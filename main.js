import { Game, formatTime } from './engine.js?v=2.0.0';
import { DOCTRINES, ENEMIES, POWERS, SYNERGIES, UPGRADES } from './content.js?v=2.0.0';
import { TITLE, PORTRAIT, ENEMY_PORTRAITS } from './art.js?v=2.0.0';
import { Field } from './field.js?v=2.0.0';
import { saveCheckpoint } from './checkpoint.js?v=2.0.0';
import { runPanels } from './run-panels.js?v=2.0.0';
import { $, pad, decorateFrame, drawStats, element, setText, tierName } from './ui.js?v=2.0.0';

const root = document.documentElement;
function preference(key, fallback) {
  try { return localStorage.getItem('last-spire.' + key) || fallback; } catch { return fallback; }
}
function savePreference(key, value) {
  try { localStorage.setItem('last-spire.' + key, value); } catch { /* The current session still works. */ }
}

const game = new Game({ resume: true });
const field = new Field($('field'), game, inspect);
const themes = {terminal: 'Terminal', mono: 'Monochrome', amber: 'Amber', ice: 'Glacier'};
const groups = ['arsenal', 'munitions', 'chassis'];
let shopGroup = 'arsenal';
let upgradeKeys = [];
const side = document.querySelector('.side');
const dialog = $('record-dialog');
const cursor = $('ascii-cursor');
const themeMenu = $('theme-menu');
const panels = runPanels(game, {pick: installRelic, start: restart, refresh: refreshUI});
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
let inspectedSnapshot = '';
let nextHud = 0;
let previousFrame;
let nextDraw = 0;

$('wordmark').textContent = TITLE.join('\n');
root.style.setProperty('--rule', '"' + '-'.repeat(512) + '"');
document.querySelectorAll('.frame').forEach(decorateFrame);

function applyTheme(theme) {
  const selected = Object.hasOwn(themes, theme) ? theme : 'terminal';
  root.dataset.theme = selected;
  setText($('theme-name'), themes[selected]);
  for (const button of themeMenu.querySelectorAll('button')) {
    const active = button.dataset.theme === selected;
    button.setAttribute('aria-pressed', String(active));
    setText(button, (active ? '[x] ' : '[ ] ') + themes[button.dataset.theme]);
  }
  savePreference('theme', selected);
}
function closeThemes(focus = false) {
  themeMenu.hidden = true;
  $('theme-button').setAttribute('aria-expanded', 'false');
  if (focus) $('theme-button').focus();
}
for (const key of Object.keys(themes)) {
  const button = element('button');
  button.dataset.theme = key;
  button.addEventListener('click', () => {
    applyTheme(key);
    closeThemes(true);
    field.render(game.time);
  });
  themeMenu.append(button);
}
applyTheme(preference('theme', 'terminal'));
$('theme-button').addEventListener('click', () => {
  if (!themeMenu.hidden) return closeThemes(true);
  themeMenu.hidden = false;
  $('theme-button').setAttribute('aria-expanded', 'true');
  themeMenu.querySelector('[aria-pressed=true]').focus();
});
document.addEventListener('pointerdown', event => {
  if (!event.target.closest('.theme-control')) closeThemes();
});
document.querySelector('.theme-control').addEventListener('focusout', event => {
  if (!event.currentTarget.contains(event.relatedTarget)) closeThemes();
});

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

const upgradeControls = new Map();
function selectGroup(group) {
  if (!groups.includes(group)) return;
  shopGroup = group;
  upgradeKeys = Object.keys(UPGRADES).filter(key => UPGRADES[key].group === group);
  for (const button of $('shop-tabs').children) button.setAttribute('aria-pressed', String(button.dataset.group === group));
  upgradeControls.clear();
  const rows = upgradeKeys.map((key, i) => {
    const upgrade = UPGRADES[key];
    const row = element('button', 'upgrade-row');
    const icon = element('pre', 'upgrade-icon', upgrade.icon);
    icon.setAttribute('aria-hidden','true');
    const copy = element('span','upgrade-copy');
    const name = element('span','upgrade-name',upgrade.label);
    const keyNumber = element('span','key-number',' [' + (i + 1) + ']');
    keyNumber.setAttribute('aria-hidden','true');
    name.append(keyNumber);
    const level = element('span','upgrade-level');
    copy.append(name, level);
    const price = element('span','cost');
    row.append(icon, copy, price);
    row.addEventListener('click', () => purchase(key));
    row.setAttribute('aria-keyshortcuts', String(i + 1));
    upgradeControls.set(key, {row,level,price});
    return row;
  });
  $('upgrade-list').replaceChildren(...rows);
  renderShop();
}
for (const button of $('shop-tabs').children) button.addEventListener('click', () => selectGroup(button.dataset.group));
function purchase(key) {
  if (dialog.open || !['running', 'paused'].includes(game.status)) return;
  if (game.buy(key)) {
    saveCheckpoint(game);
    playTone(650, 0.12);
    setText($('announcer'), game.log[0].text);
  } else {
    const cost = game.cost(key);
    const msg = Number.isFinite(cost) ? 'Need $' + (cost - game.scrap) + ' more scrap.' : 'Already at maximum level.';
    setText($('announcer'), msg);
    const control = upgradeControls.get(key);
    control.row.title = msg;
    setText(control.price, Number.isFinite(cost) ? '-$' + (cost - game.scrap) : 'MAX');
    control.feedbackUntil = performance.now() + 850;
    playTone(110, 0.06);
  }
  renderHud();
}
function renderInspector() {
  const enemy = game.enemies.find(e => e.id === game.selected);
  const type = enemy && ENEMIES[enemy.type];
  const flags = enemy && [enemy.shield > 0 ? 'Shield ' + Math.ceil(enemy.shield) : '', enemy.burnUntil > game.time ? 'Burning' : '', enemy.slowUntil > game.time ? 'Slowed' : ''].filter(Boolean);
  const stats = enemy
    ? [['Integrity', Math.ceil(enemy.hp) + '/' + Math.ceil(enemy.maxHp)], ['Impact', enemy.damage + ' HP'], [flags.length ? 'Status' : 'Speed', flags.length ? flags.join(' / ') : concise(enemy.speed) + ' u/s'], ['Bounty', '$' + enemy.reward]]
    : [['Damage', concise(game.damage) + ' HP'], ['Range', concise(game.range) + ' u'], ['Fire rate', game.rate.toFixed(2) + '/s'], ['Splash', game.splash ? concise(game.splash) + ' u' : 'Off']];
  const signature = [enemy?.id || 'tower', enemy?.tier, game.doctrine, game.focusId, JSON.stringify(stats)].join('/');
  if (signature === inspectedSnapshot) return;
  inspectedSnapshot = signature;
  setText($('portrait'), (enemy ? ENEMY_PORTRAITS[enemy.type] : PORTRAIT).join('\n'));
  setText($('entity-class'), enemy ? (enemy.boss ? '[!] BOSS' : enemy.elite ? '[!] ELITE' : '[-] HOSTILE') : '[+] FRIENDLY');
  setText($('entity-name'), enemy ? type.name : 'The Spire');
  setText($('entity-type'), enemy ? 'Tier ' + tierName(enemy.tier) + ' / ' + type.trait : DOCTRINES[game.doctrine].name + ' tower');
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
function upgradeValue(key) {
  const values = {
    range: concise(game.range) + ' u', rate: game.rate.toFixed(2) + '/s',
    splash: concise(game.splash) + ' u', damage: concise(game.damage) + ' HP',
    crit: Math.round(game.critChance * 100) + '%', chain: game.chain + ' jumps',
    armor: concise(game.armor) + ' HP', regen: concise(game.regen) + ' HP/s',
    bounty: '+' + Math.round(game.bounty * 100) + '%'
  };
  return values[key];
}
function renderShop() {
  for (const [key,control] of upgradeControls) {
    const cost = game.cost(key);
    const maximum = !Number.isFinite(cost);
    const lv = game.levels[key];
    const data = UPGRADES[key];
    control.row.setAttribute('aria-disabled',String(game.scrap < cost || !['running', 'paused'].includes(game.status)));
    control.row.setAttribute('aria-label', data.name + ' level ' + lv + (maximum ? ', maxed' : ', upgrade for ' + cost + ' scrap'));
    const combo = Object.values(SYNERGIES).find(item => item.upgrade === key && game.powers[item.power] && item.level === lv + 1);
    setText(control.level, 'LV.' + pad(lv) + ' / ' + (combo ? combo.name : upgradeValue(key)));
    control.level.classList.toggle('combo-ready', Boolean(combo));
    if (!(performance.now() < control.feedbackUntil)) {
      setText(control.price, maximum ? '[ MAX ]' : '[ $' + cost + ' ]');
      control.row.title = data.description + (combo ? ' Activates ' + combo.name + '. ' + combo.description : '') + (maximum ? ' Maximum level.' : ' Cost: $' + cost + '.');
    }
  }
}
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
  panels.syncDraft();
  if (previousStatus === game.status) return;
  previousStatus = game.status;
  const over = game.status === 'over';
  const active = game.status === 'running';
  const draft = game.status === 'draft';
  setText($('pause-icon'), active ? 'II' : '>');
  setText($('pause-text'), over ? 'Retry' : active ? 'Pause' : draft ? 'Draft' : 'Resume');
  $('pause').disabled = draft;
  setText($('live'), active ? '[*] LIVE' : over ? '[x] OFFLINE' : draft ? '[*] DRAFT' : '[=] PAUSED');
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
  renderShop(); updateRack(); updateSiege();
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
  renderHud(); field.render(game.time);
}
function restart(key) {
  game.restart(key);
  selectTab(false);
  selectGroup('arsenal');
  saveCheckpoint(game);
  refreshUI();
}
function installRelic(key) {
  if (!key || !game.pickPower(key)) return;
  lastChoiceAt = performance.now();
  saveCheckpoint(game);
  playTone(720, 0.15);
  setText($('announcer'), POWERS[key].name + ' installed.');
  refreshUI();
}
function togglePlay() {
  if (dialog.open || game.status === 'draft') return;
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

$('records').addEventListener('click', () => { closeThemes(); panels.showDossier('build'); });
document.addEventListener('keydown', event => {
  if (event.altKey || event.ctrlKey || event.metaKey || event.repeat || dialog.open) return;
  if (game.status === 'draft') {
    if (/^[1-3]$/.test(event.key)) {
      event.preventDefault();
      if (performance.now() - lastChoiceAt > 240) installRelic(game.choices[Number(event.key) - 1]);
    }
    return;
  }
  if (!themeMenu.hidden) {
    if (event.key === 'Escape') { event.preventDefault(); closeThemes(true); }
    return;
  }
  if (event.code === 'Space' && !event.target.closest('button')) {
    event.preventDefault(); togglePlay();
  }
  if (/^[1-3]$/.test(event.key)) { event.preventDefault(); purchase(upgradeKeys[Number(event.key)-1]); }
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
    game.update(dt);
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
  if (document.hidden) storeSession();
});
window.addEventListener('pagehide', storeSession);
selectGroup(shopGroup);
renderHud();
requestAnimationFrame(frame);
