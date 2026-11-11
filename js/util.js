// Общие утилиты: id, экранирование, деньги (в копейках), даты и периоды.

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

/* ---------- Деньги ---------- */

// Суммы храним целыми числами в минимальных единицах (копейках), чтобы не ловить ошибки float.
// Принимает "1 250,50", "1250.5" и простые выражения "120+45-10".
export function parseAmount(input) {
  const s = String(input ?? '')
    .replace(/[\s  ]/g, '')
    .replace(/,/g, '.')
    .replace(/[−–—]/g, '-');
  if (!s || !/^[-+]?[\d.]+([-+][\d.]+)*$/.test(s)) return null;
  let total = 0;
  for (const part of s.match(/[-+]?[\d.]+/g)) {
    const n = Number(part);
    if (!Number.isFinite(n)) return null;
    total += Math.round(n * 100);
  }
  return total;
}

export const isExpression = (s) => /\d\s*[-+]\s*\d/.test(String(s ?? '').replace(/[−–—]/g, '-'));

const nf0 = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });
const nf2 = new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nfCompact = new Intl.NumberFormat('ru-RU', { notation: 'compact', maximumFractionDigits: 1 });

export function fmtNum(minor) {
  const abs = Math.abs(minor);
  return abs % 100 === 0 ? nf0.format(abs / 100) : nf2.format(abs / 100);
}

// sign: 'auto' — минус только у отрицательных; 'always' — +/− всегда; 'none' — без знака
export function money(minor, cur, sign = 'auto') {
  let s = '';
  if (sign !== 'none') {
    if (minor < 0) s = '−';
    else if (sign === 'always' && minor > 0) s = '+';
  }
  return s + fmtNum(minor) + ' ' + cur;
}

export const compact = (minor) => nfCompact.format(minor / 100);

// Значение для поля ввода: 1250.5 -> "1250,5"
export const amountToInput = (minor) =>
  minor % 100 === 0 ? String(Math.abs(minor) / 100) : (Math.abs(minor) / 100).toFixed(2).replace('.', ',');

/* ---------- Даты ---------- */

export const pad = (n) => String(n).padStart(2, '0');
export const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const hm = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
export const nowLocal = () => { const d = new Date(); return `${ymd(d)}T${hm(d)}`; };
export const today = () => ymd(new Date());
export const parseYmd = (s) => { const [y, m, d] = s.slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d); };
export const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
export const addMonths = (d, n) => new Date(d.getFullYear(), d.getMonth() + n, 1);
export const startOfWeek = (d) => addDays(d, -((d.getDay() + 6) % 7));
export const startOfMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1);
export const daysBetween = (a, b) => Math.round((parseYmd(b) - parseYmd(a)) / 86400000);

export const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
export const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
export const MONTHS_SHORT = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
export const WEEKDAYS = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

// "12 ноября" (+ год, если не текущий)
export function dayMonth(s, short = false) {
  const d = parseYmd(s);
  const m = short ? MONTHS_SHORT[d.getMonth()] : MONTHS_GEN[d.getMonth()];
  const y = d.getFullYear() !== new Date().getFullYear() ? ` ${d.getFullYear()}` : '';
  return `${d.getDate()} ${m}${y}`;
}

// Заголовок дня в истории: "Сегодня", "Вчера", "Пн, 10 ноября"
export function dayTitle(s) {
  const t = today();
  if (s === t) return 'Сегодня';
  if (s === ymd(addDays(new Date(), -1))) return 'Вчера';
  return `${WEEKDAYS[parseYmd(s).getDay()]}, ${dayMonth(s)}`;
}

/* ---------- Периоды ---------- */
// period = { kind: 'week'|'month'|'year'|'all'|'custom', anchor: 'YYYY-MM-DD', from?, to? }
// Диапазон: start включительно, end — исключительно (строки YYYY-MM-DD сравниваются лексикографически).

export function periodRange(p) {
  const a = parseYmd(p.anchor || today());
  switch (p.kind) {
    case 'week': { const s = startOfWeek(a); return { start: ymd(s), end: ymd(addDays(s, 7)) }; }
    case 'month': { const s = startOfMonth(a); return { start: ymd(s), end: ymd(addMonths(s, 1)) }; }
    case 'year': return { start: `${a.getFullYear()}-01-01`, end: `${a.getFullYear() + 1}-01-01` };
    case 'custom': return { start: p.from, end: ymd(addDays(parseYmd(p.to), 1)) };
    default: return { start: '0000-01-01', end: '9999-12-31' };
  }
}

export function shiftPeriod(p, dir) {
  const a = parseYmd(p.anchor || today());
  switch (p.kind) {
    case 'week': return { ...p, anchor: ymd(addDays(a, 7 * dir)) };
    case 'month': return { ...p, anchor: ymd(addMonths(a, dir)) };
    case 'year': return { ...p, anchor: ymd(new Date(a.getFullYear() + dir, 0, 1)) };
    case 'custom': {
      const len = daysBetween(p.from, p.to) + 1;
      return { ...p, from: ymd(addDays(parseYmd(p.from), len * dir)), to: ymd(addDays(parseYmd(p.to), len * dir)) };
    }
    default: return p;
  }
}

// Предыдущий период такой же длины — для сравнения в статистике
export const prevPeriod = (p) => shiftPeriod(p, -1);

export function periodLabel(p) {
  const { start, end } = periodRange(p);
  const a = parseYmd(p.anchor || today());
  const curYear = new Date().getFullYear();
  switch (p.kind) {
    case 'month': return `${MONTHS[a.getMonth()]}${a.getFullYear() !== curYear ? ' ' + a.getFullYear() : ''}`;
    case 'year': return String(a.getFullYear());
    case 'all': return 'Всё время';
    case 'week':
    case 'custom': {
      const last = ymd(addDays(parseYmd(end), -1));
      if (start === last) return dayMonth(start, true);
      const s = parseYmd(start), e = parseYmd(last);
      if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()) {
        return `${s.getDate()} – ${dayMonth(last, true)}`;
      }
      return `${dayMonth(start, true)} – ${dayMonth(last, true)}`;
    }
  }
  return '';
}

export function isCurrentPeriod(p) {
  if (p.kind === 'all' || p.kind === 'custom') return false;
  const { start, end } = periodRange(p);
  const t = today();
  return t >= start && t < end;
}

// Сколько дней периода уже прошло (для «в среднем в день»)
export function elapsedDays(p, firstTxDate) {
  let { start, end } = periodRange(p);
  if (p.kind === 'all') { start = firstTxDate || today(); end = ymd(addDays(new Date(), 1)); }
  const t = ymd(addDays(new Date(), 1));
  const realEnd = end < t ? end : t;
  return Math.max(1, daysBetween(start, realEnd));
}

/* ---------- Прочее ---------- */

export function relTime(ts) {
  if (!ts) return 'никогда';
  const diff = (Date.now() - ts) / 1000;
  if (diff < 45) return 'только что';
  if (diff < 3600) return `${Math.round(diff / 60)} мин назад`;
  if (diff < 86400) return `${Math.round(diff / 3600)} ч назад`;
  const d = new Date(ts);
  return `${dayMonth(ymd(d))}, ${hm(d)}`;
}

export function plural(n, one, few, many) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

export function debounce(fn, ms) {
  let t;
  const wrapped = (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  wrapped.flush = () => { clearTimeout(t); fn(); };
  return wrapped;
}
