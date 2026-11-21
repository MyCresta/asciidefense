import { WEAPONS, MOUNT_OUTPUT, equipWeapon, weaponCost, mountPrice } from './weapons.js?v=3.0.0';
import { workshopCosts, describeBlueprint, rerollCache, closeCache } from './workshop.js?v=3.0.0';
import { BLUEPRINTS, DOCTRINES, ENEMIES, RUN_PROFILES, POWERS, SYNERGIES, UPGRADES } from './content.js?v=3.0.0';
import { ENEMY_PORTRAITS } from './art.js?v=3.0.0';
import { formatTime } from './engine.js?v=3.0.0';
import { $, decorateFrame, drawStats, element, pad, setText, tierName } from './ui.js?v=3.0.0';

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
  const profile = RUN_PROFILES[game.profile];
  parent.append(element('h3', '', profile.name), element('p', 'profile-desc', profile.description), element('p', 'profile-tactic', profile.tactic));
  const hardware = section(parent, 'Weapons / core tuning ' + game.workshop.tunes);
  hardware.classList.add('level-grid');
  for (const [i, mount] of game.armory.mounts.entries()) {
    const row = element('li');
    row.append(element('span', '', WEAPONS[mount.key].name),element('b', '', i ? 'Aux ' + i : 'Primary'));
    hardware.append(row);
  }
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

function logView(parent, game) {
  const list = element('ol', 'history-lines');
  list.setAttribute('aria-label', 'Combat events, oldest first');
  for (const event of game.log.slice().reverse()) {
    const row = element('li', 'event-' + event.type);
    row.append(element('time','',formatTime(event.time)),element('span','history-event',event.text));
    list.append(row);
  }
  parent.append(element('p', 'log-caption', 'RUN ' + pad(game.run,3) + '  /  LAST ' + game.log.length + ' EVENTS'),list);
}
function armoryView(parent, game, slot, install) {
  const current = game.armory.mounts[slot]?.key;
  const price = mountPrice(game,slot);
  const info = (slot ? 'Auxiliary ' + slot : 'Primary') + ' / ' + Math.round(MOUNT_OUTPUT[slot] * 100) + '% output';
  parent.append(element('p', 'mount-intro', info + '  //  $' + game.scrap + ' available'));
  if (!price) parent.append(element('p','refit-hint','One free primary refit before 02:00.'));
  const grid = element('div', 'armory-grid');
  for (const [key, gun] of Object.entries(WEAPONS)) {
    const card = element('button','draft-card armory-card frame');
    const cost = weaponCost(game,key,slot);
    const occupied = game.armory.mounts.some(m => m.key === key);
    const sigil = element('pre','power-sigil',gun.icon);
    sigil.setAttribute('aria-hidden','true');
    const label = key === current ? '[ Installed ]' : occupied ? '[ In use ]' : cost ? '[ Fit $' + cost + ' ]' : '[ Fit free ]';
    card.append(element('span','power-family',gun.role),sigil,element('strong','power-name',gun.name),element('span','power-effect',gun.description),element('span','draft-select',label));
    card.disabled = occupied || !Number.isFinite(cost) || game.scrap < cost;
    card.setAttribute('aria-label', gun.name + '. ' + gun.description + ' ' + label);
    card.addEventListener('click',() => install(key,slot));
    decorateFrame(card); grid.append(card);
  }
  parent.append(grid);
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
  const weaponLabel = element('label','weapon-label','Starting weapon');
  const weapons = element('div','switches weapon-choices');
  weapons.setAttribute('role','group'); weapons.setAttribute('aria-label','Starting weapon');
  let primary = game.armory.mounts[0].key;
  const description = element('p','loadout-description',WEAPONS[primary].description);
  for (const [key,gun] of Object.entries(WEAPONS)) {
    const b = element('button','',gun.name);
    b.setAttribute('aria-pressed',String(key === primary));
    b.addEventListener('click',() => {
      primary = key;
      for (const opt of weapons.children) opt.setAttribute('aria-pressed',String(opt === b));
      setText(description,gun.description);
    });
    weapons.append(b);
  }
  launch.addEventListener('click', () => { if (chosen) start(chosen,primary); });
  parent.append(picker, weaponLabel, weapons, description, note, launch);
}

export function runPanels(game, { pick, start, refresh, changed }) {
  const dossier = $('record-dialog');
  const draft = $('draft-dialog');
  const cursor = $('ascii-cursor');
  let resumeOnClose = false;
  let fitted = false;
  let draftSignature = '';
  function showView(view, slot) {
    const body = $('dossier-content');
    body.replaceChildren();
    const armory = view === 'armory';
    $('dossier-tabs').hidden = armory;
    setText($('dossier-title'),armory ? '// Weapon fitting' : '// Run dossier');
    body.tabIndex = view === 'log' ? 0 : -1;
    body.classList.toggle('log-view', view === 'log');
    for (const b of $('dossier-tabs').children) b.setAttribute('aria-pressed', String(view === b.dataset.view));
    if (view === 'build') buildView(body, game);
    else if (view === 'bestiary') bestiaryView(body);
    else if (view === 'records') recordsView(body, game);
    else if (view === 'log') logView(body,game);
    else if (armory) armoryView(body,game,slot,(key,index) => {
      if (!equipWeapon(game,key,index)) return;
      fitted = true;
      dossier.close();
    });
    else loadoutView(body, game, (key, primary) => {
      resumeOnClose = false;
      dossier.close();
      start(key,primary);
    });
    if (view === 'log') {
      body.focus({preventScroll:true});
      body.scrollTop = body.scrollHeight;
    } else body.scrollTop = 0;
  }
  function showDossier(view = 'build', slot = 0) {
    if (game.status === 'draft' || game.status === 'cache') return;
    if (!dossier.open) {
      resumeOnClose = game.status === 'running';
      if (resumeOnClose) game.togglePause();
      dossier.showModal();
      dossier.append(cursor);
    }
    showView(view,slot);
    refresh();
  }
  for (const b of $('dossier-tabs').children) b.addEventListener('click', () => showView(b.dataset.view));
  $('close-records').addEventListener('click', () => dossier.close());
  dossier.addEventListener('close', () => {
    document.body.append(cursor);
    if (resumeOnClose && game.status === 'paused') game.togglePause();
    resumeOnClose = false;
    if (fitted) {
      fitted = false;
      changed();
    } else refresh();
  });
  dossier.addEventListener('click', e => {
    if (e.target !== dossier) return;
    const r = dossier.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dossier.close();
  });
  function shelve() { if (closeCache(game)) changed(); }
  $('cache-shelve').addEventListener('click',shelve);
  $('cache-reroll').addEventListener('click',() => { if (rerollCache(game)) changed(); });
  draft.addEventListener('cancel', e => { e.preventDefault(); if (game.status === 'cache') shelve(); });

  function syncDraft() {
    const cache = game.status === 'cache';
    if (game.status !== 'draft' && !cache) {
      if (draft.open) {
        document.body.append(cursor);
        draft.close();
      }
      draftSignature = '';
      return;
    }
    const offer = cache ? game.workshop.offer : null;
    const keys = cache ? offer.map(it => it.key) : game.choices;
    const sig = [game.status, game.draftReason, game.time, keys.join(), cache ? game.workshop.rerolls : ''].join(':');
    if (draft.open && sig === draftSignature) return;
    draftSignature = sig;
    const boss = game.draftReason === 'boss';
    const starter = game.draftReason === 'starter';
    const reason = cache ? 'SALVAGE CACHE' : boss ? 'SOVEREIGN SALVAGE' : starter ? 'STARTING RELIC' : 'TIMED DRAFT';
    setText($('draft-kicker'), reason + '  //  ' + formatTime(game.time));
    setText($('draft-title'), cache ? 'Choose a blueprint' : starter ? 'Choose your first relic' : 'Choose a relic');
    setText($('draft-prompt'), cache ? 'Install one blueprint from this cache.' : boss ? 'The Sovereign fell. Recover one effect for this run.' : 'Install one effect for this run.');
    $('cache-actions').hidden = !cache;
    if (cache) {
      const cost = workshopCosts(game).reroll;
      setText($('cache-wallet'),'SCRAP $' + game.scrap);
      setText($('cache-reroll'), Number.isFinite(cost) ? '[ Reroll $' + cost + ' ]' : '[ No reroll ]');
      $('cache-reroll').disabled = !Number.isFinite(cost) || cost > game.scrap;
    }
    const cards = keys.map((key, i) => {
      const bp = cache ? describeBlueprint(game,offer[i]) : null;
      const power = cache ? { ...bp, sigil: UPGRADES[key]?.icon || '  [*]  ', family: bp.rarity } : POWERS[key];
      const rank = cache ? 1 : (game.powers[key] || 0) + 1;
      const card = element('button', 'draft-card frame');
      const family = cache ? bp.rarity.toUpperCase() + ' / G' + bp.grade : (power.rarity !== 'common' ? power.rarity.toUpperCase() + ' / ' : '') + power.family.toUpperCase();
      const sigil = element('pre', 'power-sigil', power.sigil);
      sigil.setAttribute('aria-hidden', 'true');
      const choose = element('span', 'draft-select', '[ ' + (i + 1) + ' ] Install');
      card.append(element('span','power-family',family),sigil,element('strong','power-name',power.name),element('span','power-effect',power.description),choose);
      if (cache) card.insertBefore(element('span','blueprint-gain',bp.effect),choose);
      const combo = cache ? Object.values(SYNERGIES).find(item => item.upgrade === key && game.powers[item.power] && game.levels[key] < item.level && game.levels[key] + offer[i].levels >= item.level) : Object.values(SYNERGIES).find(item => item.power === key);
      if (combo) {
        const ready = cache || game.levels[combo.upgrade] >= combo.level;
        const requirement = UPGRADES[combo.upgrade].label + ' Lv.' + combo.level;
        const hint = element('span', 'combo-hint', ready ? 'Activates ' + combo.name : combo.name + ' with ' + requirement);
        card.insertBefore(hint, choose);
        hint.title = combo.description;
      }
      if (rank > 1) choose.append(element('small','',' Rank ' + rank));
      card.setAttribute('aria-label', power.name + '. ' + power.description + (cache ? ' ' + bp.effect : '') + ' Press ' + (i + 1) + ' to install.');
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
