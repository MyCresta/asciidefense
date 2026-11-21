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
