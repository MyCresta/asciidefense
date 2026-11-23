import { WEAPONS, WEAPON_COMBOS, GRADE_NAMES, mountTitle, describeMount } from './weapons.js?v=3.12.0';
import { PERKS, buyPerk, perkBank, readPerks } from './perks.js?v=3.12.0';
import { workshopCosts, describeBlueprint, rerollCache, closeCache, fitChoices, cancelFit } from './workshop.js?v=3.12.0';
import { BLUEPRINTS, ENEMIES, RUN_PROFILES, POWERS, SYNERGIES, UPGRADES } from './content.js?v=3.12.0';
import { ENEMY_PORTRAITS } from './art.js?v=3.12.0';
import { paintPortrait } from './pixel-art.js?v=3.12.0';
import { vectorElement } from './vector-art.js?v=3.12.0';
import { formatTime } from './engine.js?v=3.12.0';
import { $, decorateFrame, drawStats, element, pad, rollsElement, setText, setTier, tierName } from './ui.js?v=3.12.0';

function entry(name, description, marker = '', downside = '') {
  const row = element('li');
  const detail = element('small', '', description);
  if (downside) detail.append(' ', element('span', 'downside', downside));
  row.append(element('strong', '', marker + name), detail);
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
    ['Run', pad(game.run, 3)],
    ['Survival', formatTime(game.time)], ['Sovereigns defeated', game.bossKills]
  ]);
  const profile = RUN_PROFILES[game.profile];
  parent.append(element('h3', '', profile.name), element('p', 'profile-desc', profile.description), element('p', 'profile-tactic', profile.tactic));
  const hardware = section(parent, 'Weapons / core tuning ' + game.workshop.tunes);
  hardware.classList.add('level-grid');
  hardware.classList.add('build-weapons');
  for (const [i, mount] of game.armory.mounts.entries()) {
    const row = element('li');
    row.append(element('span', '', mountTitle(mount)),element('b', '', i ? 'Aux ' + i : 'Primary'));
    row.title = describeMount(mount);
    setTier(row, GRADE_NAMES[mount.grade - 1]);
    hardware.append(row);
    if (row.title) {
      const rolls = element('li', 'weapon-rolls');
      rolls.append(rollsElement('', row.title));
      hardware.append(rolls);
    }
  }
  const relicList = section(parent, 'Installed relics');
  const powers = Object.entries(game.powers).filter(([, rank]) => rank > 0);
  if (!powers.length) {
    relicList.append(element('li', 'empty-entry', game.starterReady ? 'A starting relic is ready at the battlefield.' : 'The next draft offers three relics.'));
  }
  for (const [key, rank] of powers) {
    const relic = POWERS[key];
    relicList.append(entry(relic.name + (rank > 1 ? ' II' : ''), relic.description + (rank > 1 && relic.next ? ' ' + relic.next : ''), '', relic.downside));
  }
  const synergies = section(parent, 'Relic combinations');
  for (const [key, combo] of Object.entries(SYNERGIES)) {
    const active = game.synergyActive(key);
    const requirements = POWERS[combo.power].name + ' + ' + UPGRADES[combo.upgrade].label + ' Lv.' + combo.level;
    const row = entry(combo.name, requirements + '. ' + combo.description, active ? '[x] ' : '[ ] ');
    row.classList.toggle('active-combo', active);
    synergies.append(row);
  }
  for (const [key, combo] of Object.entries(WEAPON_COMBOS)) {
    const active = game.armory.mounts.some(mount => mount.trait === combo.trait) && Boolean(game.powers[combo.power]);
    const trait = combo.trait[0].toUpperCase() + combo.trait.slice(1);
    const row = entry(combo.name, trait + ' weapon + ' + POWERS[combo.power].name + '. ' + combo.description, active ? '[x] ' : '[ ] ');
    row.classList.toggle('active-combo', active);
    row.dataset.combo = key;
    synergies.append(row);
  }
  const levels = section(parent, 'Tower upgrades');
  levels.classList.add('level-grid');
  for (const [key, upgrade] of Object.entries(UPGRADES)) {
    const row = element('li');
    row.append(element('span', '', upgrade.label), element('b', '', 'Lv.' + pad(game.levels[key]) + '/' + upgrade.maxLevel));
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
function recordsView(parent, game) {
  const kills = game.progress.totalKills;
  stats(parent, [['Longest survival', formatTime(Math.max(game.records.best, game.time))], ['Lifetime kills', kills], ['Runs launched', game.records.runs]]);
  const items = section(parent, 'Permanent blueprints');
  for (const bp of BLUEPRINTS) {
    const unlocked = bp.kills <= kills;
    const note = unlocked ? bp.description : bp.kills + ' lifetime kills. ' + bp.description;
    items.append(entry(bp.name, note, unlocked ? '[x] ' : '[ ] '));
  }
  const arms = section(parent, 'Weapon finds');
  for (const gun of Object.values(WEAPONS).filter(item => item.unlock)) {
    const unlocked = gun.unlock <= kills;
    arms.append(entry(gun.name, (unlocked ? 'Can drop in caches. ' : gun.unlock + ' lifetime kills. ') + gun.description, unlocked ? '[x] ' : '[ ] '));
  }
  const daily = game.dailyRecord;
  stats(parent, [['Daily challenge', daily.date], ['Best today', daily.best ? formatTime(daily.best) : '--:--']]);
}

function bestiaryView(parent) {
  for (const [key, enemy] of Object.entries(ENEMIES)) {
    const details = element('details', 'species');
    const summary = element('summary');
    summary.append(element('b', '', enemy.name), element('span', '', 'TIER ' + tierName(enemy.tier)));
    const info = element('div', 'species-card');
    const portrait = element('div', 'species-art');
    portrait.setAttribute('aria-hidden', 'true');
    const pixels = element('canvas', 'pixel-portrait');
    paintPortrait(pixels, key);
    portrait.append(element('pre', '', ENEMY_PORTRAITS[key].join('\n')), pixels, vectorElement(key, 'vector-portrait'));
    const copy = element('div');
    copy.append(element('strong', '', enemy.trait), element('p', '', enemy.description), element('small', '', 'Base HP ' + enemy.hp + '  /  Impact ' + enemy.damage));
    info.append(portrait, copy);
    details.append(summary, info);
    parent.append(details);
  }
}

// New run: a plain start, the daily challenge and the perk shop. Every run uses the same rules.
function loadoutView(parent, game, start) {
  const live = game.status !== 'over';
  const note = element('p', 'loadout-note', live ? 'This ends run ' + pad(game.run, 3) + '.' : 'Lifetime unlocks carry over.');
  const launch = element('button', 'launch-button', '[ Start new run ]');
  launch.addEventListener('click', () => start('sentinel'));
  const record = game.dailyRecord;
  const daily = element('button', 'daily-button');
  daily.append(element('b', '', '[ Daily challenge ' + record.date + ' ]'),
    element('small', '', 'The same run for everyone today. Best: ' + (record.best ? formatTime(record.best) : '--:--')));
  daily.addEventListener('click', () => start('sentinel', { daily: true }));
  const shop = element('div', 'perk-shop');
  function drawShop() {
    const owned = readPerks(game.storage).owned;
    const bank = perkBank(game);
    const rows = Object.entries(PERKS).map(([key, perk]) => {
      const have = owned.includes(key);
      const button = element('button', 'perk');
      button.append(element('span', '', perk.name), element('small', '', perk.effect), element('b', '', have ? '[ Owned ]' : '[ ' + perk.cost + ' kills ]'));
      button.disabled = have || bank < perk.cost;
      button.addEventListener('click', () => { if (buyPerk(game, key)) drawShop(); });
      return button;
    });
    shop.replaceChildren(element('h3', '', 'Perks  /  ' + bank + ' kills to spend'), ...rows);
  }
  drawShop();
  parent.append(note, launch, daily, shop);
}

export function runPanels(game, { pick, start, refresh, changed }) {
  const dossier = $('record-dialog');
  const draft = $('draft-dialog');
  const cursor = $('ascii-cursor');
  let resumeOnClose = false;
  let draftSignature = '';
  function showView(view) {
    const body = $('dossier-content');
    body.replaceChildren();
    body.tabIndex = view === 'log' ? 0 : -1;
    body.classList.toggle('log-view', view === 'log');
    for (const b of $('dossier-tabs').children) b.setAttribute('aria-pressed', String(view === b.dataset.view));
    if (view === 'build') buildView(body, game);
    else if (view === 'bestiary') bestiaryView(body);
    else if (view === 'records') recordsView(body, game);
    else if (view === 'log') logView(body,game);
    else loadoutView(body, game, (key, options) => {
      resumeOnClose = false;
      dossier.close();
      start(key, options);
    });
    if (view === 'log') {
      body.focus({preventScroll:true});
      body.scrollTop = body.scrollHeight;
    } else body.scrollTop = 0;
  }
  function showDossier(view = 'build') {
    if (game.status === 'draft' || game.status === 'cache') return;
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
  function shelve() { cancelFit(game); if (closeCache(game)) changed(); }
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
    const pending = cache ? game.workshop.pending : null;
    if (pending) return syncFit(pending);
    const offer = cache ? game.workshop.offer : null;
    const keys = cache ? offer.map(it => it.key) : game.choices;
    const sig = [game.status, game.draftReason, game.time, keys.join(), cache ? game.workshop.rerolls : ''].join(':');
    if (draft.open && sig === draftSignature) return;
    draftSignature = sig;
    const boss = game.draftReason === 'boss';
    const starter = game.draftReason === 'starter';
    const bought = game.draftReason === 'bought';
    const reason = cache ? 'SALVAGE CACHE' : boss ? 'SOVEREIGN SALVAGE' : starter ? 'STARTING RELIC' : bought ? 'BOUGHT DRAFT' : 'TIMED DRAFT';
    setText($('draft-kicker'), reason + '  //  ' + formatTime(game.time));
    const arms = cache && offer.every(item => item.weapon);
    const opening = cache && game.workshop.starter;
    if (arms) setText($('draft-kicker'), (opening ? 'STARTING WEAPON' : 'ARMS CACHE') + '  //  ' + formatTime(game.time));
    setText($('draft-title'), opening ? 'Choose your weapon' : arms ? 'Choose a weapon' : cache && offer.some(item => item.weapon) ? 'Choose a blueprint or weapon' : cache ? 'Choose a blueprint' : starter ? 'Choose your first relic' : 'Choose a relic');
    setText($('draft-prompt'), opening ? 'Each one rolled its own stats and trait for this run.' : arms ? 'Fit one found weapon to your hardpoints.' : cache ? 'Pick one.' : boss ? 'The Sovereign fell. Recover one effect for this run.' : 'Install one effect for this run.');
    $('cache-actions').hidden = !cache;
    setText($('cache-shelve'), '[ Save for later ]');
    $('cache-shelve').hidden = opening;
    $('cache-reroll').hidden = opening;
    if (cache) {
      const cost = workshopCosts(game).reroll;
      setText($('cache-wallet'),'SCRAP $' + game.scrap);
      setText($('cache-reroll'), Number.isFinite(cost) ? '[ Reroll $' + cost + ' ]' : '[ No reroll ]');
      $('cache-reroll').disabled = !Number.isFinite(cost) || cost > game.scrap;
    }
    const cards = keys.map((key, i) => {
      const bp = cache ? describeBlueprint(game,offer[i]) : null;
      const rank = cache ? 1 : (game.powers[key] || 0) + 1;
      const relic = POWERS[key];
      const power = cache ? { ...bp, sigil: bp.icon || UPGRADES[key]?.icon || '  [*]  ', family: bp.rarity }
        : rank > 1 && relic.next ? { ...relic, name: relic.name + ' II', description: relic.next } : relic;
      const card = element('button', 'draft-card frame');
      if (!bp?.curse) setTier(card, cache ? bp.rarity : rank > 1 ? 'rare' : relic.rarity);
      const family = bp?.curse ? 'CURSED' : bp?.weapon ? bp.role + ' / ' + bp.rarity.toUpperCase() + ' G' + bp.grade : cache ? bp.rarity.toUpperCase() + ' / G' + bp.grade : (rank > 1 && relic.next ? 'RANK II / ' : power.rarity !== 'common' ? power.rarity.toUpperCase() + ' / ' : '') + power.family.toUpperCase();
      const sigil = element('pre', 'power-sigil', power.sigil);
      sigil.setAttribute('aria-hidden', 'true');
      const choose = element('span', 'draft-select', '[ ' + (i + 1) + ' ] Install');
      if (bp?.weapon) card.classList.add('weapon-card');
      if (bp?.curse) card.classList.add('curse-card');
      const effect = element('span','power-effect',power.description);
      // Downsides are always spelled out on their own line, in the warning colour.
      if (power.downside) effect.append(element('span','power-downside',power.downside));
      card.append(element('span','power-family',family),sigil,element('strong','power-name',power.name),effect,choose);
      if (cache) card.insertBefore(element('span','blueprint-gain',bp.effect),choose);
      if (bp?.rolls) card.insertBefore(rollsElement('weapon-rolls',bp.rolls),choose);
      // Blueprint cards name the combo they complete or advance; relic cards name the combo they open.
      const owned = item => game.powers[item.power] && game.levels[item.upgrade] < item.level;
      const combo = cache
        ? Object.values(SYNERGIES).find(item => item.upgrade === key && owned(item) && game.levels[key] + offer[i].levels >= item.level)
          || Object.values(SYNERGIES).find(item => item.upgrade === key && owned(item))
        : Object.values(SYNERGIES).find(item => item.power === key);
      if (combo) {
        const have = game.levels[combo.upgrade];
        const after = cache ? have + (offer[i].levels || 0) : have;
        const ready = after >= combo.level;
        const requirement = UPGRADES[combo.upgrade].label + ' Lv.' + combo.level + ' (now ' + have + ')';
        const text = ready ? 'Activates ' + combo.name : cache ? 'Toward ' + combo.name + ': Lv.' + after + ' of ' + combo.level : combo.name + ' with ' + requirement;
        const hint = element('span', 'combo-hint', text);
        card.insertBefore(hint, choose);
        hint.title = combo.description;
      }
      // Weapon traits combo with relics: name the combo a weapon or relic card would switch on.
      const traitCombo = bp?.weapon
        ? Object.values(WEAPON_COMBOS).find(item => item.trait === offer[i].trait && game.powers[item.power])
        : !cache && Object.values(WEAPON_COMBOS).find(item => item.power === key && game.armory.mounts.some(mount => mount.trait === item.trait));
      if (!combo && traitCombo) {
        const hint = element('span', 'combo-hint', 'Activates ' + traitCombo.name);
        hint.title = traitCombo.description;
        card.insertBefore(hint, choose);
      }
      if (rank > 1) choose.append(element('small','',' Upgrade to rank ' + rank));
      card.setAttribute('aria-label', power.name + '. ' + power.description + (power.downside ? ' Downside: ' + power.downside : '') + (cache ? ' ' + bp.effect : '') + ' Press ' + (i + 1) + ' to install.');
      card.addEventListener('click', () => pick(key));
      decorateFrame(card);
      return card;
    });
    $('draft-choices').replaceChildren(...cards);
    if (!draft.open) draft.showModal();
    draft.append(cursor);
    $('draft-title').focus();
  }
  // A found weapon with every hardpoint filled replaces one of them or is reclaimed.
  function syncFit(pending) {
    const choices = fitChoices(game);
    const sig = ['fit', pending.weapon, game.scrap, choices.length].join(':');
    if (draft.open && sig === draftSignature) return;
    draftSignature = sig;
    const found = mountTitle({ key: pending.weapon, grade: pending.grade, trait: pending.trait });
    setText($('draft-kicker'), 'HARDPOINTS FULL  //  ' + formatTime(game.time));
    setText($('draft-title'), 'Fit ' + found);
    const rolls = describeMount(pending);
    setText($('draft-prompt'), 'Choose the weapon it replaces, or reclaim it for scrap.' + (rolls ? ' New: ' + rolls + '.' : ''));
    $('cache-actions').hidden = false;
    setText($('cache-wallet'),'SCRAP $' + game.scrap);
    $('cache-reroll').hidden = true;
    setText($('cache-shelve'), '[ Back ]');
    $('cache-shelve').hidden = false;
    const cards = choices.map((choice, i) => {
      const card = element('button', 'draft-card frame fit-card');
      const choose = element('span', 'draft-select', '[ ' + (i + 1) + ' ] ' + (choice.mount ? 'Replace' : 'Reclaim'));
      if (choice.mount) {
        const sigil = element('pre', 'power-sigil', WEAPONS[choice.mount.key].icon);
        sigil.setAttribute('aria-hidden', 'true');
        setTier(card, GRADE_NAMES[choice.mount.grade - 1]);
        card.append(element('span','power-family',(choice.slot ? 'AUX ' + choice.slot : 'PRIMARY') + ' / FITTED'), sigil,
          element('strong','power-name',mountTitle(choice.mount)), element('span','power-effect','Swap it for ' + found + '. The reload carries over.'),
          rollsElement('weapon-rolls',describeMount(choice.mount)), choose);
      } else {
        const sigil = element('pre', 'power-sigil', '  ____ \n /___/|\n |___|/');
        sigil.setAttribute('aria-hidden', 'true');
        card.append(element('span','power-family','SALVAGE'), sigil, element('strong','power-name','Reclaim it'),
          element('span','power-effect','Keep your weapons and break ' + found + ' down for scrap.'), choose);
      }
      card.setAttribute('aria-label', (choice.mount ? 'Replace ' + mountTitle(choice.mount) : 'Reclaim ' + found + ' for scrap') + '. Press ' + (i + 1) + '.');
      card.addEventListener('click', () => pick(choice.key));
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
