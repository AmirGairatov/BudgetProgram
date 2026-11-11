// Столбчатый график в SVG. Один ряд (расходы или доходы), цвет — через CSS-переменную --series.

import { compact } from './util.js';

// «Красивый» максимум оси: 2 шага по 1/2/2.5/5 × 10^k (в рублях, вход в копейках)
function niceStep(maxMinor) {
  const m = Math.max(maxMinor / 100, 1) / 2;
  const p = 10 ** Math.floor(Math.log10(m));
  for (const k of [1, 2, 2.5, 5, 10]) if (k * p >= m) return k * p * 100;
  return 10 * p * 100;
}

function barPath(x, y, w, h) {
  const r = Math.min(4, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

// items: [{ label: 'Пн' | '', value: копейки }]
export function barChart(items, { selected = -1, height = 168 } = {}) {
  const W = 340, H = height, padL = 38, padR = 2, padT = 8, padB = 22;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const step = niceStep(Math.max(0, ...items.map((i) => i.value)));
  const max = step * 2;
  const n = Math.max(items.length, 1);
  const band = plotW / n;
  const bw = Math.max(2, Math.min(24, band - 2));
  const y = (v) => padT + plotH - (v / max) * plotH;
  const out = [];

  for (const v of [0, step, max]) {
    const yy = Math.round(y(v)) + 0.5;
    out.push(`<line class="${v ? 'grid' : 'axis'}" x1="${padL}" x2="${W - padR}" y1="${yy}" y2="${yy}"/>`);
    out.push(`<text class="tick" x="${padL - 6}" y="${yy + 3.5}" text-anchor="end">${v ? compact(v) : '0'}</text>`);
  }

  items.forEach((it, i) => {
    const x = padL + i * band + (band - bw) / 2;
    if (it.value > 0) {
      const h = Math.max(2, (it.value / max) * plotH);
      const dim = selected >= 0 && selected !== i ? ' dim' : '';
      out.push(`<path class="bar${dim}" d="${barPath(x, padT + plotH - h, bw, h)}"/>`);
    }
    if (it.label) {
      const sel = selected === i ? ' sel' : '';
      out.push(`<text class="xl${sel}" x="${x + bw / 2}" y="${H - 6}" text-anchor="middle">${it.label}</text>`);
    }
    out.push(`<rect class="hit" data-act="bar" data-i="${i}" x="${padL + i * band}" y="0" width="${band}" height="${H}"/>`);
  });

  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="График по периодам">${out.join('')}</svg>`;
}
