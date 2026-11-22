import { $, element, pad, setText } from './ui.js?v=3.3.0';
import { foundry, openCache, workshopCosts } from './workshop.js?v=3.3.0';
import { WEAPONS, MOUNT_OUTPUT, mountStats, mountTitle } from './weapons.js?v=3.3.0';

const SERVICES = {
  caches: { name: 'Salvage cache', icon: '  ____ \n /___/|\n |___|/' },
  tune: { name: 'Core tuning', icon: '.--+--.\n| (o) |\n\u0027--+--\u0027' },
  repair: { name: 'Hull patch', icon: '   +   \n--[+]--\n   +   ' },
  commission: { name: 'Order cache', icon: ' .---. \n ==[$]=\n \u0027---\u0027 ' }
};
const EMPTY_ICON = '  .-.  \n--(+)--\n  \u0027-\u0027  ';
const METER = 8;

// Filled hardpoints are read-only status rows. Only the next locked hardpoint can be bought.
function row(onClick, className) {
  const button = element(onClick ? 'button' : 'div', 'upgrade-row workshop-button ' + className);
  const icon = element('pre','upgrade-icon');
  icon.setAttribute('aria-hidden','true');
  const copy = element('span','upgrade-copy');
  const name = element('span','upgrade-name'), detail = element('span','upgrade-level'), action = element('span','cost');
  copy.append(name,detail);
  button.append(icon,copy,action);
  if (onClick) button.addEventListener('click',onClick);
  return {button,icon,name,detail,action};
}

function meter(mount, stats, game) {
  const reload = 1 / (game.rate * stats.cadence);
  const ready = Math.round(METER * (1 - Math.min(1, mount.cooldown / reload)));
  return '[' + '#'.repeat(ready) + '-'.repeat(METER - ready) + ']';
}

export function workbench(game, {changed}) {
  function transact(key) {
    if (!['running','paused'].includes(game.status)) return;
    const ok = key === 'caches' ? openCache(game) : foundry(game,key);
    if (ok) changed();
  }
  const hardpoints = MOUNT_OUTPUT.map((_, slot) => {
    const locked = row(() => transact('hardpoint'), 'hardpoint-row');
    const fitted = row(null, 'hardpoint-row');
    return { slot, locked, fitted };
  });
  const services = Object.keys(SERVICES).map(key => ({ key, control: row(() => transact(key), 'service-row') }));
  const divider = element('div', 'workshop-divider', 'SALVAGE');
  divider.setAttribute('aria-hidden', 'true');
  let layout = 0;

  function render() {
    const ws = game.workshop;
    const { mounts, slots } = game.armory;
    const active = ['running','paused'].includes(game.status);
    setText($('mount-count'), 'ARMS ' + mounts.length + '/3');
    const costs = workshopCosts(game);
    // Show fitted hardpoints plus the next one to buy; later sealed slots stay hidden.
    const shown = hardpoints.filter(({slot}) => slot <= slots).map(({slot, locked, fitted}) => slot === slots ? locked : fitted);
    if (slots !== layout) {
      layout = slots;
      $('upgrade-list').replaceChildren(...shown.map(control => control.button), divider, ...services.map(s => s.control.button));
    }
    for (const {slot, locked, fitted} of hardpoints) {
      const mount = mounts[slot];
      const share = Math.round(MOUNT_OUTPUT[slot] * 100) + '%';
      const place = slot ? 'Aux ' + slot : 'Primary';
      if (slot === slots) {
        const cost = costs.hardpoint;
        setText(locked.icon, EMPTY_ICON); setText(locked.name, 'Locked hardpoint');
        setText(locked.detail, place + ' / ' + share + ' / + arms cache');
        setText(locked.action, '[ $' + cost + ' ]');
        locked.button.disabled = !active || !Number.isFinite(cost) || cost > game.scrap;
        locked.button.setAttribute('aria-disabled', String(locked.button.disabled));
        locked.button.title = 'Open hardpoint ' + (slot + 1) + ' and get a cache of three weapons to choose from.';
        continue;
      }
      if (mount) {
        const stats = mountStats(mount, game);
        setText(fitted.icon, WEAPONS[mount.key].icon); setText(fitted.name, mountTitle(mount));
        setText(fitted.detail, place + ' / ' + share + ' / ' + (game.rate * stats.cadence).toFixed(2) + '/s');
        setText(fitted.action, meter(mount, stats, game));
        fitted.button.title = WEAPONS[mount.key].description;
        fitted.button.classList.remove('vacant');
      } else {
        setText(fitted.icon, EMPTY_ICON);
        setText(fitted.name, 'Empty hardpoint');
        setText(fitted.detail, place + ' / ' + share + ' / next find fits here');
        setText(fitted.action, '[ Empty ]');
        fitted.button.title = '';
        fitted.button.classList.add('vacant');
      }
    }
    for (const {key, control} of services) {
      const {name, icon} = SERVICES[key];
      const cost = costs[key];
      let detail, action, help, disabled;
      if (key === 'caches') {
        const arms = ws.armsCaches ? ' (' + ws.armsCaches + ' arms)' : '';
        detail = ws.caches ? ws.caches + (ws.caches === 1 ? ' cache in storage' : ' caches in storage') + arms : 'Recovered from hostiles';
        action = ws.caches ? '[ Open ]' : '[ Empty ]';
        help = 'Open one cache and choose a free blueprint or weapon.';
        disabled = !ws.caches;
      } else {
        detail = key === 'repair' ? 'Restore 35% integrity' : key === 'tune' ? 'R' + pad(ws.tunes) + ' / +2 dmg +2% rate' : 'Buy a banked cache';
        action = Number.isFinite(cost) ? '[ $' + cost + ' ]' : key === 'repair' ? '[ Full ]' : '[ Max ]';
        help = key === 'tune' ? 'Permanently increase damage and fire rate for this run. No rank limit.' :
          key === 'commission' ? 'Order a cache. Open it to install one of its blueprints.' : 'Repair the core immediately.';
        disabled = !Number.isFinite(cost) || cost > game.scrap;
      }
      control.button.disabled = !active || disabled;
      control.button.setAttribute('aria-disabled',String(control.button.disabled));
      control.button.title = help;
      setText(control.icon,icon); setText(control.name,name); setText(control.detail,detail); setText(control.action,action);
    }
  }
  return {render, open:() => transact('caches')};
}
