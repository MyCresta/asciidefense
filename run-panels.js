import { BLUEPRINTS, DOCTRINES, ENEMIES, POWERS, SYNERGIES, UPGRADES } from './content.js?v=2.0.0';
import { ENEMY_PORTRAITS } from './art.js?v=2.0.0';
import { formatTime } from './engine.js?v=2.0.0';
import { $, decorateFrame, drawStats, element, pad, setText, tierName } from './ui.js?v=2.0.0';

function entry(name, description, marker = '') {
  const row = element('li');
  row.append(element('strong', '', marker + name), element('small', '', description));
  return row;
}

function section(parent, title) {
  parent.append(element('h3', '', title));
  const list = element('ul', 'dossier-list');
  parent.append(list);
  return list;
}

function stats(parent, values) {
  const block = element('dl', 'record-stats');
  drawStats(block, values);
  parent.append(block);
}

function buildView(parent, game) {
  stats(parent, [
    ['Doctrine', DOCTRINES[game.doctrine].name], ['Run', pad(game.run, 3)],
    ['Survival', formatTime(game.time)], ['Sovereigns defeated', game.bossKills]
  ]);
  const relicList = section(parent, 'Installed relics');
  const powers = Object.entries(game.powers).filter(([, rank]) => rank > 0);
  if (!powers.length) {
    relicList.append(element('li', 'empty-entry', game.starterReady ? 'A starting relic is ready at the battlefield.' : 'The next draft offers three relics.'));
  }
  for (const [key, rank] of powers) {
    relicList.append(entry(POWERS[key].name + (rank > 1 ? ' x' + rank : ''), POWERS[key].description));
  }
  const synergies = section(parent, 'Relic combinations');
  for (const [key, combo] of Object.entries(SYNERGIES)) {
    const active = game.synergyActive(key);
    const requirements = POWERS[combo.power].name + ' + ' + UPGRADES[combo.upgrade].label + ' Lv.' + combo.level;
    const row = entry(combo.name, requirements + '. ' + combo.description, active ? '[x] ' : '[ ] ');
    row.classList.toggle('active-combo', active);
    synergies.append(row);
  }
  const levels = section(parent, 'Tower upgrades');
  levels.classList.add('level-grid');
  for (const [key, upgrade] of Object.entries(UPGRADES)) {
    const row = element('li');
    row.append(element('span', '', upgrade.label), element('b', '', 'Lv.' + pad(game.levels[key])));
    levels.append(row);
  }
}

function recordsView(parent, game) {
  const kills = game.progress.totalKills;
  stats(parent, [['Longest survival', formatTime(Math.max(game.records.best, game.time))], ['Lifetime kills', kills], ['Runs launched', game.records.runs]]);
  const items = section(parent, 'Permanent blueprints');
  for (const bp of BLUEPRINTS) {
    const unlocked = bp.kills <= kills;
    const note = unlocked ? bp.description : bp.kills + ' lifetime kills. ' + bp.description;
    items.append(entry(bp.name, note, unlocked ? '[x] ' : '[ ] '));
  }
}

function bestiaryView(parent) {
  for (const [key, enemy] of Object.entries(ENEMIES)) {
    const details = element('details', 'species');
    const summary = element('summary');
    summary.append(element('b', '', enemy.name), element('span', '', 'TIER ' + tierName(enemy.tier)));
    const info = element('div', 'species-card');
    const portrait = element('pre', '', ENEMY_PORTRAITS[key].join('\n'));
    portrait.setAttribute('aria-hidden', 'true');
    const copy = element('div');
    copy.append(element('strong', '', enemy.trait), element('p', '', enemy.description), element('small', '', 'Base HP ' + enemy.hp + '  /  Impact ' + enemy.damage));
    info.append(portrait, copy);
    details.append(summary, info);
    parent.append(details);
  }
}

function loadoutView(parent, game, start) {
  const picker = element('div', 'loadout-picker');
  const note = element('p', 'loadout-note', 'Select a doctrine for your next run.');
  const launch = element('button', 'launch-button', '[ Start new run ]');
  launch.disabled = true;
  let chosen;
  for (const [key, doctrine] of Object.entries(DOCTRINES)) {
    const available = game.progress.totalKills >= doctrine.kills;
    const button = element('button', 'loadout');
    button.disabled = !available;
    button.setAttribute('aria-pressed', 'false');
    const header = element('span', 'loadout-name');
    header.append(element('b', '', doctrine.name), element('small', '', available ? (key === game.doctrine ? 'EQUIPPED' : 'UNLOCKED') : doctrine.kills + ' KILLS'));
    button.append(header, element('span', 'loadout-description', doctrine.description));
    button.addEventListener('click', () => {
      chosen = key;
      for (const option of picker.children) option.setAttribute('aria-pressed', String(option === button));
      const live = game.status !== 'over';
      setText(note, live ? 'Starting a new run will end run ' + pad(game.run, 3) + '. Lifetime unlocks are kept.' : 'Lifetime unlocks carry over to your next run.');
      setText(launch, '[ Launch ' + doctrine.name + ' ]');
      launch.disabled = false;
    });
    picker.append(button);
  }
  launch.addEventListener('click', () => { if (chosen) start(chosen); });
  parent.append(picker, note, launch);
}

export function runPanels(game, { pick, start, refresh }) {
  const dossier = $('record-dialog');
  const draft = $('draft-dialog');
  const cursor = $('ascii-cursor');
  let resumeOnClose = false;
  let draftSignature = '';
  function showView(view) {
    const body = $('dossier-content');
    body.replaceChildren();
    for (const b of $('dossier-tabs').children) b.setAttribute('aria-pressed', String(view === b.dataset.view));
    if (view === 'build') buildView(body, game);
    else if (view === 'bestiary') bestiaryView(body);
    else if (view === 'records') recordsView(body, game);
    else loadoutView(body, game, key => {
      resumeOnClose = false;
      dossier.close();
      start(key);
    });
    body.scrollTop = 0;
  }
  function showDossier(view = 'build') {
    if (game.status === 'draft') return;
    if (!dossier.open) {
      resumeOnClose = game.status === 'running';
      if (resumeOnClose) game.togglePause();
      dossier.showModal();
      dossier.append(cursor);
    }
    showView(view);
    refresh();
  }
  for (const b of $('dossier-tabs').children) b.addEventListener('click', () => showView(b.dataset.view));
  $('close-records').addEventListener('click', () => dossier.close());
  dossier.addEventListener('close', () => {
    document.body.append(cursor);
    if (resumeOnClose && game.status === 'paused') game.togglePause();
    resumeOnClose = false;
    refresh();
  });
  dossier.addEventListener('click', e => {
    if (e.target !== dossier) return;
    const r = dossier.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dossier.close();
  });
  draft.addEventListener('cancel', e => e.preventDefault());

  function syncDraft() {
    if (game.status !== 'draft') {
      if (draft.open) {
        document.body.append(cursor);
        draft.close();
      }
      draftSignature = '';
      return;
    }
    const sig = game.draftReason + ':' + game.time + ':' + game.choices.join(',');
    if (draft.open && sig === draftSignature) return;
    draftSignature = sig;
    const boss = game.draftReason === 'boss';
    const starter = game.draftReason === 'starter';
    const reason = boss ? 'SOVEREIGN SALVAGE' : starter ? 'STARTING CACHE' : 'TIMED DRAFT';
    setText($('draft-kicker'), reason + '  //  ' + formatTime(game.time));
    setText($('draft-title'), starter ? 'Choose your first relic' : 'Choose a relic');
    setText($('draft-prompt'), boss ? 'The Sovereign fell. Recover one effect for this run.' : 'Install one effect for this run.');
    const cards = game.choices.map((key, i) => {
      const power = POWERS[key];
      const rank = (game.powers[key] || 0) + 1;
      const card = element('button', 'draft-card frame');
      const family = (power.rare ? 'RARE / ' : '') + power.family.toUpperCase();
      const sigil = element('pre', 'power-sigil', power.sigil);
      sigil.setAttribute('aria-hidden', 'true');
      const choose = element('span', 'draft-select', '[ ' + (i + 1) + ' ] Install');
      card.append(element('span','power-family',family),sigil,element('strong','power-name',power.name),element('span','power-effect',power.description),choose);
      const combo = Object.values(SYNERGIES).find(item => item.power === key);
      if (combo) {
        const ready = game.levels[combo.upgrade] >= combo.level;
        const requirement = UPGRADES[combo.upgrade].label + ' Lv.' + combo.level;
        const hint = element('span', 'combo-hint', ready ? 'Activates ' + combo.name : combo.name + ' with ' + requirement);
        card.insertBefore(hint, choose);
        hint.title = combo.description;
      }
      if (rank > 1) choose.append(element('small','',' Rank ' + rank));
      card.setAttribute('aria-label', power.name + '. ' + power.description + ' Press ' + (i + 1) + ' to install.');
      card.addEventListener('click', () => pick(key));
      decorateFrame(card);
      return card;
    });
    $('draft-choices').replaceChildren(...cards);
    if (!draft.open) draft.showModal();
    draft.append(cursor);
    $('draft-title').focus();
  }
  return { showDossier, syncDraft };
}
