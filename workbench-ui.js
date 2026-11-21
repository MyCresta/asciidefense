import { $, element, pad, setText } from './ui.js?v=3.0.0';
import { foundry, openCache, workshopCosts } from './workshop.js?v=3.0.0';
import { WEAPONS, MOUNT_OUTPUT, mountPrice } from './weapons.js?v=3.0.0';

const SERVICES = {
  caches: { name: 'Salvage cache', icon: '  ____ \n /___/|\n |___|/' },
  tune: { name: 'Core tuning', icon: '.--+--.\n| (o) |\n\u0027--+--\u0027' },
  repair: { name: 'Hull patch', icon: '   +   \n--[+]--\n   +   ' },
  commission: { name: 'Order cache', icon: ' .---. \n ==[$]=\n \u0027---\u0027 ' }
};

function row(onClick) {
  const button = element('button','upgrade-row workshop-button');
  const icon = element('pre','upgrade-icon');
  icon.setAttribute('aria-hidden','true');
  const copy = element('span','upgrade-copy');
  const name = element('span','upgrade-name'), detail = element('span','upgrade-level'), action = element('span','cost');
  copy.append(name,detail);
  button.append(icon,copy,action);
  button.addEventListener('click',onClick);
  return {button,icon,name,detail,action};
}

export function workbench(game, {changed, showMount}) {
  let group = 'salvage';
  let controls = [];
  function transact(key) {
    if (!['running','paused'].includes(game.status)) return;
    const ok = key === 'caches' ? openCache(game) : foundry(game,key);
    if (ok) changed();
  }
  function select(value) {
    group = value;
    for (const tab of $('shop-tabs').children) tab.setAttribute('aria-pressed',String(tab.dataset.group === group));
    controls = group === 'salvage'
      ? Object.keys(SERVICES).map(key => row(() => transact(key)))
      : MOUNT_OUTPUT.map((_, slot) => row(() => showMount(slot)));
    $('upgrade-list').replaceChildren(...controls.map(c => c.button));
    render();
  }
  function render() {
    const ws = game.workshop;
    const mounts = game.armory.mounts;
    const active = ['running','paused'].includes(game.status);
    setText($('mount-count'), mounts.length + '/3');
    const costs = workshopCosts(game);
    for (const [i, control] of controls.entries()) {
      let name, detail, action, icon, disabled, help;
      if (group === 'salvage') {
        const key = Object.keys(SERVICES)[i];
        ({name,icon} = SERVICES[key]);
        const cost = costs[key];
        if (key === 'caches') {
          detail = ws.caches ? ws.caches + (ws.caches === 1 ? ' cache in storage' : ' caches in storage') : 'Recovered from hostiles';
          action = ws.caches ? '[ Open ]' : '[ Empty ]';
          help = 'Open one cache and choose a free blueprint.';
          disabled = !ws.caches;
        } else {
          detail = key === 'repair' ? 'Restore 35% integrity' : key === 'tune' ? 'R' + pad(ws.tunes) + ' / +2 dmg +2% rate' : 'Buy a banked cache';
          action = Number.isFinite(cost) ? '[ $' + cost + ' ]' : key === 'repair' ? '[ Full ]' : '[ Max ]';
          help = key === 'tune' ? 'Permanently increase damage and fire rate for this run. No rank limit.' :
            key === 'commission' ? 'Order a cache. Open it to install one of its blueprints.' : 'Repair the core immediately.';
          disabled = !Number.isFinite(cost) || cost > game.scrap;
        }
      } else {
        const weapon = WEAPONS[mounts[i]?.key];
        name = weapon?.name || 'Empty hardpoint';
        icon = weapon?.icon || '  .-.  \n--(+)--\n  \u0027-\u0027  ';
        const cost = mountPrice(game,i);
        detail = (i ? 'Aux ' + i : 'Primary') + ' / ' + Math.round(MOUNT_OUTPUT[i]*100) + '% output';
        action = weapon ? '[ Refit ]' : Number.isFinite(cost) ? '[ $' + cost + ' ]' : '[ Locked ]';
        help = weapon ? weapon.description : Number.isFinite(cost) ? 'Fit an independently firing weapon.' : 'Fit the preceding hardpoint first.';
        disabled = !Number.isFinite(cost);
      }
      control.button.disabled = !active || disabled;
      control.button.setAttribute('aria-disabled',String(control.button.disabled));
      control.button.title = help;
      setText(control.icon,icon); setText(control.name,name); setText(control.detail,detail); setText(control.action,action);
    }
  }
  for (const tab of $('shop-tabs').children) tab.addEventListener('click',() => select(tab.dataset.group));
  select('salvage');
  return {render, select, open:() => transact('caches')};
}
