import { Game, ENEMIES, UPGRADES, formatTime } from './engine.js';
import { TITLE, PORTRAIT, ENEMY_PORTRAITS } from './art.js?v=1.0.2';
import { Field } from './field.js?v=1.0.2';

const $ = id => document.getElementById(id);
const root = document.documentElement;
const pad = (n, digits = 2) => String(n).padStart(digits, '0');
const setText = (node, text) => {
  const value = String(text);
  if (node.textContent !== value) node.textContent = value;
};
function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function preference(key, fallback) {
  try { return localStorage.getItem('last-spire.' + key) || fallback; } catch { return fallback; }
}
function savePreference(key, value) {
  try { localStorage.setItem('last-spire.' + key, value); } catch { /* The current session still works. */ }
}

const game = new Game();
const field = new Field($('field'), game, inspect);
const themes = {terminal: 'Terminal', mono: 'Monochrome', amber: 'Amber', ice: 'Glacier'};
const upgradeKeys = ['range', 'rate', 'splash'];
const upgradeIcons = {
  range: '   .-.   \n--( + )--\n   \u0027-\u0027   ',
  rate: '  // // \n // //  \n// //   ',
  splash: '\\  |  /\n-- * --\n/  |  \\'
};
const side = document.querySelector('.side');
const dialog = $('record-dialog');
const cursor = $('ascii-cursor');
const themeMenu = $('theme-menu');
let resumeAfterRecords = false;
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
for (const frame of document.querySelectorAll('.frame')) {
  const border = element('div', 'frame-art');
  border.setAttribute('aria-hidden', 'true');
  for (const edge of ['h t','h b','v l','v r']) {
    const horizontal = edge.startsWith('h');
    const line = horizontal ? '-'.repeat(1024) : '|\n'.repeat(256);
    border.append(element('span', 'frame-line ' + edge, line));
  }
  for (const corner of ['tl','tr','bl','br']) {
    border.append(element('span', 'frame-corner ' + corner, '+'));
  }
  frame.prepend(border);
}

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
for (const [i, key] of upgradeKeys.entries()) {
  const row = element('button', 'upgrade-row');
  const icon = element('pre', 'upgrade-icon', upgradeIcons[key]);
  icon.setAttribute('aria-hidden','true');
  const copy = element('span','upgrade-copy');
  const name = element('span','upgrade-name',UPGRADES[key].name);
  const keyNumber = element('span','key-number',' [' + (i + 1) + ']');
  keyNumber.setAttribute('aria-hidden','true');
  name.append(keyNumber);
  const level = element('span','upgrade-level');
  copy.append(name, level);
  const price = element('span','cost');
  row.append(icon, copy, price);
  row.addEventListener('click', () => purchase(key));
  row.setAttribute('aria-keyshortcuts', String(i + 1));
  $('upgrade-list').append(row);
  upgradeControls.set(key, {row,level,price});
}
function purchase(key) {
  if (dialog.open || game.status === 'over') return;
  if (game.buy(key)) {
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
function drawStats(node, entries, dotted) {
  const rows = entries.map(([label,value]) => {
    const row = element('div');
    row.append(element('dt','',label));
    if (dotted) {
      const dots = element('span','leader','.'.repeat(90));
      dots.setAttribute('aria-hidden','true');
      row.append(dots);
    }
    row.append(element('dd','',value));
    return row;
  });
  node.replaceChildren(...rows);
}
function renderInspector() {
  const enemy = game.selected === 'tower' ? null : game.enemies.find(e => e.id === game.selected);
  const type = enemy && ENEMIES[enemy.type];
  const stats = enemy
    ? [['Integrity', enemy.hp + '/' + enemy.maxHp], ['Impact', enemy.damage + ' HP'], ['Speed', enemy.speed.toFixed(1) + ' u/s'], ['Bounty', '$' + enemy.reward]]
    : [['Damage', game.damage + ' HP'], ['Range', parseFloat(game.range.toFixed(1)) + ' u'], ['Fire rate', game.rate.toFixed(2) + '/s'], ['Splash', game.splash ? parseFloat(game.splash.toFixed(1)) + ' u' : 'Off']];
  const signature = (enemy?.type || 'tower') + JSON.stringify(stats);
  if (signature === inspectedSnapshot) return;
  inspectedSnapshot = signature;
  setText($('portrait'), (enemy ? ENEMY_PORTRAITS[enemy.type] : PORTRAIT).join('\n'));
  setText($('entity-class'), enemy ? '[-] HOSTILE' : '[+] FRIENDLY');
  setText($('entity-name'), enemy ? type.name : 'The Spire');
  setText($('entity-type'), enemy ? 'Incoming unit' : 'Defense tower');
  $('entity-type').title = type?.description || 'Automatically fires on the closest hostile in range.';
  drawStats($('entity-stats'),stats,true);
}
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
function updateStatus() {
  if (previousStatus === game.status) return;
  previousStatus = game.status;
  const over = game.status === 'over';
  const paused = game.status === 'paused';
  const active = game.status === 'running';
  setText($('pause-icon'), active ? 'II' : '>');
  setText($('pause-text'), over ? 'Retry' : paused ? 'Resume' : 'Pause');
  setText($('live'), active ? '[*] LIVE' : over ? '[x] OFFLINE' : '[=] PAUSED');
  $('live').classList.toggle('idle',!active);
  $('field-overlay').hidden = active;
  if (active) return;
  setText($('overlay-kicker'),'RUN ' + pad(game.run,3));
  setText($('overlay-title'),over ? 'The Spire fell.' : 'Paused');
  setText($('overlay-detail'),over ? 'Survived ' + formatTime(game.time) + '  /  ' + game.kills + ' kills\nPersonal best ' + formatTime(game.best) : 'Survival time ' + formatTime(game.time));
  setText($('overlay-action'),over ? '[ Rebuild spire ]' : '[ Resume ]');
  if (over) setText($('announcer'),'The Spire fell. Choose Rebuild spire to start a new run.');
}
function renderHud() {
  setText($('clock'), formatTime(game.time));
  setText($('health'), Math.ceil(100 * game.hp / game.maxHp));
  const segments = Math.ceil(8 * game.hp / game.maxHp);
  setText($('hull-meter'),'[' + '|'.repeat(segments) + '.'.repeat(8-segments) + ']');
  setText($('scrap'), game.scrap);
  setText($('available-scrap'), '$' + game.scrap);
  setText($('kills'), game.kills);
  setText($('threat'), pad(game.threat));
  setText($('threat-label'), game.threat < 2 ? 'LOW' : game.threat < 4 ? 'RISING' : game.threat < 7 ? 'HIGH' : 'SEVERE');
  setText($('run-number'), 'RUN ' + pad(game.run,3));
  for (const [key,control] of upgradeControls) {
    const cost = game.cost(key);
    const maximum = !Number.isFinite(cost);
    const level = game.levels[key];
    const inactive = game.scrap < cost || game.status === 'over';
    control.row.setAttribute('aria-disabled',String(inactive));
    control.row.setAttribute('aria-label', UPGRADES[key].name + ' level ' + level + (maximum ? ', maxed' : ', upgrade for ' + cost + ' scrap'));
    setText(control.level, 'LV.' + pad(level) + '  ' + '|'.repeat(Math.min(5,Math.ceil(level/2))) + '.'.repeat(5-Math.min(5,Math.ceil(level/2))));
    if (!(performance.now() < control.feedbackUntil)) {
      setText(control.price, maximum ? '[ MAX ]' : '[ $' + cost + ' ]');
      control.row.title = maximum ? 'Maximum level' : 'Upgrade ' + UPGRADES[key].name.toLowerCase() + ' for ' + cost + ' scrap';
    }
  }
  const coord = value => (value < 0 ? '-' : '+') + pad(Math.min(999,Math.abs(Math.round(value || 0))),3);
  setText($('coord-x'),coord(field.pointer?.x));
  setText($('coord-y'),coord(field.pointer?.y));
  if (game.hp < previousHp) playTone(100, 0.2, 'sawtooth');
  else if (game.kills > previousKills) playTone(230, 0.06, 'square');
  previousHp = game.hp; previousKills = game.kills;
  renderInspector(); renderLog(); updateStatus();
}
function togglePlay() {
  if (dialog.open) return;
  if (game.status === 'over') {
    game.restart();
    selectTab(false);
  } else game.togglePause();
  renderHud(); field.render(game.time);
}
$('pause').addEventListener('click', togglePlay);
$('overlay-action').addEventListener('click', togglePlay);
field.showRange = true;
$('range-toggle').addEventListener('click', () => {
  field.showRange = !field.showRange;
  $('range-toggle').setAttribute('aria-pressed',String(field.showRange));
  setText($('range-toggle'),(field.showRange ? '[x]' : '[ ]') + ' Range');
  field.render(game.time);
});

function showRecords() {
  closeThemes();
  resumeAfterRecords = game.status === 'running';
  if (resumeAfterRecords) game.togglePause();
  const data = game.progress;
  drawStats($('record-stats'),[['Longest survival',formatTime(Math.max(game.best,game.time))], ['Total kills',data.totalKills],['Runs',game.run]],false);
  const items = data.unlocks.map(u => {
    const li = element('li','', '[x] ' + u.name);
    li.append(element('small','', u.description));
    return li;
  });
  if (data.nextUnlock) {
    const u = data.nextUnlock;
    const li = element('li','', '[ ] ' + u.name + '  ' + data.totalKills + '/' + u.kills);
    li.append(element('small','', u.description));
    items.push(li);
  }
  $('unlocks').replaceChildren(...items);
  renderHud();
  dialog.showModal();
  dialog.append(cursor);
}
$('records').addEventListener('click', showRecords);
$('close-records').addEventListener('click', () => dialog.close());
dialog.addEventListener('close', () => {
  document.body.append(cursor);
  if (resumeAfterRecords && game.status === 'paused') game.togglePause();
  previousFrame = undefined; renderHud();
});
dialog.addEventListener('click', event => {
  if (event.target !== dialog) return;
  const r = dialog.getBoundingClientRect();
  if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close();
});
document.addEventListener('keydown', event => {
  if (event.altKey || event.ctrlKey || event.metaKey || event.repeat || dialog.open) return;
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
    if (now >= nextDraw) {
      field.render(game.time);
      nextDraw = now + 1000 / 32;
    }
    if (now >= nextHud) { renderHud(); nextHud = now + 100; }
  }
  previousFrame = now;
  requestAnimationFrame(frame);
}
document.addEventListener('visibilitychange', () => {
  previousFrame = undefined;
  if (document.hidden) game.saveRecords();
});
window.addEventListener('pagehide', () => game.saveRecords());
renderHud();
requestAnimationFrame(frame);
