export const $ = id => document.getElementById(id);
export const pad = (n, digits = 2) => String(n).padStart(digits, '0');
export const tierName = tier => ['I', 'II', 'III', 'IV'][tier - 1] || String(tier);

export function setText(node, value) {
  const text = String(value);
  if (node.textContent !== text) node.textContent = text;
}

export function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function decorateFrame(frame) {
  const border = element('div', 'frame-art');
  border.setAttribute('aria-hidden', 'true');
  for (const edge of ['h t', 'h b', 'v l', 'v r']) {
    const line = edge.startsWith('h') ? '-'.repeat(1024) : '|\n'.repeat(256);
    border.append(element('span', 'frame-line ' + edge, line));
  }
  for (const corner of ['tl', 'tr', 'bl', 'br']) {
    border.append(element('span', 'frame-corner ' + corner, '+'));
  }
  frame.prepend(border);
}

export function drawStats(node, entries, dotted = false) {
  const rows = entries.map(([label, value]) => {
    const row = element('div');
    row.append(element('dt', '', label));
    if (dotted) {
      const dots = element('span', 'leader', '.'.repeat(90));
      dots.setAttribute('aria-hidden', 'true');
      row.append(dots);
    }
    row.append(element('dd', '', value));
    return row;
  });
  node.replaceChildren(...rows);
}

// Rarity colours run from plain (1) to gold (5). Cache grades, weapon grades and relic rarities share them.
const NAME_TIERS = { standard: 1, common: 1, reserve: 1, refined: 2, tuned: 2, uncommon: 2, masterwork: 3, exotic: 4, prime: 4, rare: 4,
  mythic: 5, legend: 5, ascendant: 5, apex: 5 };
export const rarityTier = name => NAME_TIERS[String(name || '').toLowerCase()] || 1;

export function setTier(node, name) {
  const tier = String(rarityTier(name));
  if (node.dataset.tier !== tier) node.dataset.tier = tier;
}

// Weapon rolls and mod text, with every negative roll marked as a downside.
export function rollsElement(className, text) {
  const node = element('span', className);
  for (const part of String(text).split(/(-\d+% \w+)/)) {
    if (!part) continue;
    node.append(/^-\d+% \w+$/.test(part) ? element('span', 'downside', part) : part);
  }
  return node;
}

// The full text of something with a downside, for tooltips.
export const withDownside = (description, downside) => description + (downside ? ' Downside: ' + downside : '');
