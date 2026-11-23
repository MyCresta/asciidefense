import { $, element, pad, setText, setTier } from './ui.js?v=3.12.1';
import { forgeWeapon, foundry, openCache, workshopCosts } from './workshop.js?v=3.12.1';
import { WEAPONS, TRAITS, MOUNT_OUTPUT, HARDPOINT_BOSSES, GRADE_NAMES, MAX_GRADE, MOD_GRADES, mountStats, mountTitle, describeMount, weaponReport } from './weapons.js?v=3.12.1';

export const SERVICES = {
  caches: { name: 'Big cache', icon: '  ____ \n /___/|\n |___|/' },
  tune: { name: 'Core tuning', icon: '.--+--.\n| (o) |\n\u0027--+--\u0027' },
  repair: { name: 'Hull patch', icon: '   +   \n--[+]--\n   +   ' },
  relic: { name: 'Relic draft', icon: ' .---. \n | ? | \n \u0027---\u0027 ' }
};
export const EMPTY_ICON = '  .-.  \n--(+)--\n  \u0027-\u0027  ';
const METER = 8;

// Fitted hardpoints forge their weapon up a grade. The next sealed hardpoint shows which sovereign opens it.
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

export function workbench(game, {changed, inspect}) {
  function transact(key) {
    if (!['running','paused'].includes(game.status)) return;
    const ok = key === 'caches' ? (game.workshop.caches ? openCache(game) : foundry(game, 'commission')) : key.startsWith('forge:') ? forgeWeapon(game, Number(key.slice(6))) : foundry(game,key);
    if (ok) changed();
  }
  const hardpoints = MOUNT_OUTPUT.map((_, slot) => {
    const locked = row(null, 'hardpoint-row vacant');
    // Clicking a weapon opens its stats in the Inspector; clicking its price forges it.
    const fitted = row(event => event.target.closest('.cost') ? transact('forge:' + slot) : inspect?.(slot), 'hardpoint-row');
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
        const boss = HARDPOINT_BOSSES[slot];
        setText(locked.icon, EMPTY_ICON); setText(locked.name, 'Sealed hardpoint');
        setText(locked.detail, place + ' / ' + share);
        setText(locked.action, '[ Boss ' + boss + ' ]');
        locked.button.title = 'Opens when sovereign ' + boss + ' falls.';
        continue;
      }
      if (mount) {
        const stats = mountStats(mount, game);
        const cost = costs.forge[slot];
        setText(fitted.icon, WEAPONS[mount.key].icon); setText(fitted.name, mountTitle(mount));
        setTier(fitted.name, GRADE_NAMES[mount.grade - 1]);
        setText(fitted.detail, place + ' / ' + share + ' ' + meter(mount, stats, game));
        setText(fitted.action, Number.isFinite(cost) ? '[ $' + cost + ' ]' : '[ Max ]');
        fitted.button.disabled = false;
        fitted.button.classList.toggle('cant-forge', !active || !Number.isFinite(cost) || cost > game.scrap);
        const nextMod = MOD_GRADES.find(at => at > mount.grade);
        const forgeHelp = Number.isFinite(cost) ? ' Forge to G' + (mount.grade + 1) + (nextMod === mount.grade + 1 ? ', which rolls a new mod' : '') + '.' : '';
        const rolls = describeMount(mount);
        const downside = [TRAITS[mount.trait]?.downside, WEAPONS[mount.key].downside].filter(Boolean).join(' ');
        const report = weaponReport(game, slot).slice(0, 6).map(([label, value]) => label + ' ' + value).join(' / ');
        fitted.button.title = WEAPONS[mount.key].description + (downside ? ' Downside: ' + downside : '') + '\n' + report + (rolls ? '\n' + rolls + '.' : '') + '\nClick for stats.' + (forgeHelp ? ' Click the price:' + forgeHelp : '');
        fitted.button.classList.remove('vacant');
      } else {
        setText(fitted.icon, EMPTY_ICON);
        setText(fitted.name, 'Empty hardpoint');
        setTier(fitted.name, 'standard');
        setText(fitted.detail, place + ' / ' + share + ' / next weapon fits here');
        setText(fitted.action, '[ Empty ]');
        fitted.button.disabled = true;
        fitted.button.classList.remove('cant-forge');
        fitted.button.title = '';
        fitted.button.classList.add('vacant');
      }
      fitted.button.setAttribute('aria-disabled', String(fitted.button.disabled));
    }
    for (const {key, control} of services) {
      const {name, icon} = SERVICES[key];
      const cost = costs[key];
      let detail, action, help, disabled;
      if (key === 'caches') {
        const arms = ws.armsCaches ? ' (' + ws.armsCaches + ' arms)' : '';
        // With no cache waiting, the same row orders one for scrap.
        const order = costs.commission;
        detail = ws.caches ? ws.caches + ' ready' + arms : 'None ready / order one';
        action = ws.caches ? '[ Open ]' : Number.isFinite(order) ? '[ $' + order + ' ]' : '[ Empty ]';
        help = ws.caches ? 'Open a big cache and pick one of three.' : 'Order a big cache. Elites and bosses also drop them.';
        disabled = !ws.caches && (!Number.isFinite(order) || order > game.scrap);
      } else {
        detail = key === 'repair' ? 'Restore 35% integrity' : key === 'tune' ? 'R' + pad(ws.tunes) + (ws.tunes < 12 ? ' / +2 dmg +0.02/s' : ' / +1 dmg +0.01/s')
          : key === 'relic' ? 'Pick 1 of 3 relics' : 'Buy a big cache';
        action = Number.isFinite(cost) ? '[ $' + cost + ' ]' : key === 'repair' ? '[ Full ]' : '[ Max ]';
        help = key === 'tune' ? 'Permanently increase damage and fire rate for this run. No rank limit. Ranks past 12 give half.' :
          key === 'relic' ? 'Buy a draft of three relics. Each one costs more.' : 'Repair the core immediately.';
        disabled = !Number.isFinite(cost) || cost > game.scrap;
      }
      control.button.disabled = !active || disabled;
      control.button.setAttribute('aria-disabled',String(control.button.disabled));
      control.button.title = help;
      setText(control.icon,icon); setText(control.name,name); setText(control.detail,detail); setText(control.action,action);
    }
  }
  // The C key only opens a waiting cache; it never spends scrap.
  return {render, open:() => { if (game.workshop.caches) transact('caches'); }};
}
