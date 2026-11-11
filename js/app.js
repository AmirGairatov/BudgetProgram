import { store, ACCOUNT_COLORS, serialize } from './store.js';
import { cloud, scheduleSync } from './sync.js';
import { barChart } from './charts.js';
import * as U from './util.js';
import { APP_VERSION } from './config.js';

const { esc, money } = U;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const LS = {
  get(k, d) { try { const v = localStorage.getItem('budget.v1.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('budget.v1.' + k, JSON.stringify(v)); } catch { /* ignore */ } },
};

/* ---------- Иконки ---------- */

const ICONS = {
  home: '<path d="M3.5 10.5 12 3.5l8.5 7"/><path d="M5.5 9v11h13V9"/><path d="M10 20v-5.5h4V20"/>',
  chart: '<path d="M4 20h16"/><path d="M6.5 16v-5M12 16V6M17.5 16v-8"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  transfer: '<path d="M5 8.5h13.5L15 5M19 15.5H5.5L9 19"/>',
  cloud: '<path d="M7 18.5h10.5a4.25 4.25 0 0 0 .6-8.46A6 6 0 0 0 6.4 9.7 4.4 4.4 0 0 0 7 18.5Z"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  chevR: '<path d="m9.5 5.5 6.5 6.5-6.5 6.5"/>',
  chevL: '<path d="m14.5 5.5-6.5 6.5 6.5 6.5"/>',
  chevD: '<path d="m6.5 9.5 5.5 5.5 5.5-5.5"/>',
  x: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>',
  card: '<rect x="3" y="5.5" width="18" height="13" rx="2.5"/><path d="M3 10h18M7 15h3.5"/>',
  cash: '<rect x="2.5" y="6.5" width="19" height="11" rx="2"/><circle cx="12" cy="12" r="2.4"/><path d="M6 12h.01M18 12h.01"/>',
  trash: '<path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13"/>',
  edit: '<path d="M4.5 19.5h4l10-10-4-4-10 10v4Z"/><path d="m13 7 4 4"/>',
  adjust: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  download: '<path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 20h14"/>',
  upload: '<path d="M12 15V4M7.5 8.5 12 4l4.5 4.5M5 20h14"/>',
  refresh: '<path d="M19.5 11A7.5 7.5 0 0 0 6 7.2L4.5 8.5M4.5 4.5v4h4M4.5 13A7.5 7.5 0 0 0 18 16.8l1.5-1.3M19.5 19.5v-4h-4"/>',
  archive: '<rect x="3.5" y="4.5" width="17" height="4" rx="1"/><path d="M5.5 8.5V19.5h13V8.5M10 12.5h4"/>',
  link: '<path d="M10.5 13.5a3.5 3.5 0 0 0 5 0l3-3a3.5 3.5 0 0 0-5-5l-1 1"/><path d="M13.5 10.5a3.5 3.5 0 0 0-5 0l-3 3a3.5 3.5 0 0 0 5 5l1-1"/>',
  up: '<path d="M12 18.5v-13M6.5 11 12 5.5l5.5 5.5"/>',
  down: '<path d="M12 5.5v13M6.5 13l5.5 5.5 5.5-5.5"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  warn: '<path d="M12 4 2.8 19.5h18.4L12 4Z"/><path d="M12 10v4M12 17h.01"/>',
  palette: '<path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.2 0 1.8-.8 1.8-1.7 0-1.3-1-1.6-1-2.6 0-.9.7-1.5 1.6-1.5h2a4.1 4.1 0 0 0 4.1-4.1C20.5 6.6 16.7 3.5 12 3.5Z"/><path d="M7.5 12h.01M9.5 8h.01M14.5 8h.01"/>',
  coins: '<ellipse cx="9" cy="7" rx="5.5" ry="2.5"/><path d="M3.5 7v4c0 1.4 2.5 2.5 5.5 2.5s5.5-1.1 5.5-2.5V7"/><path d="M9.5 16.4c.6.1 1.3.1 2 .1 3 0 5.5-1.1 5.5-2.5v-1.5"/><path d="M3.5 11v4c0 1.4 2.5 2.5 5.5 2.5"/><path d="M14.5 11.3c3 .1 6 .9 6 2.2v4c0 1.4-2.5 2.5-5.5 2.5s-5.5-1.1-5.5-2.5"/>',
  tag: '<path d="M3.5 12.5V4.5h8l9 9-8 8-9-9Z"/><path d="M8 8h.01"/>',
  ext: '<path d="M13.5 4.5h6v6M19.5 4.5l-8 8M18 14v5.5H4.5V6H10"/>',
};
const icon = (name, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ''}</svg>`;

const MONTHS_DAT = ['январю', 'февралю', 'марту', 'апрелю', 'маю', 'июню', 'июлю', 'августу', 'сентябрю', 'октябрю', 'ноябрю', 'декабрю'];
const TYPE_NAMES = { expense: 'Расход', income: 'Доход', transfer: 'Перевод', adjust: 'Корректировка' };
const EMOJIS = ['🛒', '🍽️', '☕', '🍔', '🍕', '🥗', '🚕', '🚌', '🚗', '⛽', '🅿️', '🚇', '🏠', '💡', '🔧', '🛋️', '🧹', '🪴', '📱', '💻', '🌐', '📺', '🔁', '🎮', '💊', '🏥', '🦷', '🏋️', '👕', '👟', '👜', '💅', '💇', '🎬', '🎵', '🎉', '🎁', '💐', '📚', '🎓', '✈️', '🏨', '🏖️', '🐶', '👶', '❤️', '🙏', '🍺', '🚬', '🧾', '🏦', '💳', '💼', '💰', '💸', '📈', '🛠️', '📦', '✨', '⭐'];
const CURRENCIES = [['₽', 'Российский рубль'], ['$', 'Доллар США'], ['€', 'Евро'], ['₸', 'Казахстанский тенге'], ['сўм', 'Узбекский сум'], ['Br', 'Белорусский рубль'], ['₴', 'Гривна'], ['₾', 'Грузинский лари'], ['֏', 'Армянский драм'], ['₼', 'Азербайджанский манат'], ['сом', 'Киргизский сом'], ['₺', 'Турецкая лира'], ['£', 'Фунт стерлингов']];

/* ---------- Состояние интерфейса ---------- */

const ui = {
  route: { name: 'home', sub: [] },
  hist: { q: '', type: 'all', account: 'all', category: 'all', period: { kind: 'all' }, limit: 150 },
  stats: { period: { kind: 'month', anchor: U.today() }, account: 'all', mode: 'expense', sel: -1 },
};
const sheets = [];

const view = $('#view');
const sheetRoot = $('#sheet-root');
const sheetEl = $('.sheet', sheetRoot);

/* ---------- Выборки для экранов ---------- */

const accName = (id) => store.account(id)?.name || 'Удалённый счёт';
function catInfo(id) {
  const c = id && store.category(id);
  return c ? { name: c.name, emoji: c.emoji } : { name: 'Без категории', emoji: '•' };
}
const inRange = (t, r) => { const d = t.date.slice(0, 10); return d >= r.start && d < r.end; };

function aggregateRange(r, account = 'all') {
  let expense = 0, income = 0;
  const list = [];
  for (const t of store.txs()) {
    if ((t.type !== 'expense' && t.type !== 'income') || !inRange(t, r)) continue;
    if (account !== 'all' && t.account !== account) continue;
    list.push(t);
    if (t.type === 'expense') expense += t.amount; else income += t.amount;
  }
  return { expense, income, list };
}

// Для текущего (незавершённого) периода сравниваем с тем же числом дней прошлого периода
function comparableRange(p) {
  const r = U.periodRange(U.prevPeriod(p));
  if (U.isCurrentPeriod(p)) {
    const elapsed = U.daysBetween(U.periodRange(p).start, U.ymd(U.addDays(new Date(), 1)));
    const cut = U.ymd(U.addDays(U.parseYmd(r.start), elapsed));
    if (cut < r.end) r.end = cut;
  }
  return r;
}

function breakdown(list, type, key) {
  const m = new Map();
  for (const t of list) {
    if (t.type !== type) continue;
    const k = t[key] || '_none';
    const e = m.get(k) || { id: k, sum: 0, count: 0 };
    e.sum += t.amount; e.count++;
    m.set(k, e);
  }
  return [...m.values()].sort((a, b) => b.sum - a.sum);
}

function deltaHtml(curV, prevV, goodWhenUp, suffix) {
  if (!prevV) return `<span class="delta muted">нет данных для сравнения</span>`;
  const pct = Math.round(((curV - prevV) / prevV) * 100);
  if (pct === 0) return `<span class="delta muted">без изменений ${suffix}</span>`;
  const up = pct > 0;
  const good = up === goodWhenUp;
  return `<span class="delta ${good ? 'good' : 'bad'}">${icon(up ? 'up' : 'down')}${Math.abs(pct) > 999 ? '>999' : Math.abs(pct)}% ${suffix}</span>`;
}

function compareSuffix(p) {
  const a = U.parseYmd(p.anchor || U.today());
  if (p.kind === 'month') return 'к ' + MONTHS_DAT[U.addMonths(a, -1).getMonth()];
  if (p.kind === 'week') return 'к прошлой неделе';
  if (p.kind === 'year') return 'к ' + (a.getFullYear() - 1);
  return 'к прошлому периоду';
}

/* ---------- Общие куски разметки ---------- */

function syncState() {
  const s = cloud.status;
  if (s === 'off') return { cls: 'off', text: 'Облако не подключено' };
  if (s === 'syncing') return { cls: 'syncing', text: 'Синхронизация…' };
  if (s === 'error') return { cls: 'error', text: cloud.error || 'Ошибка синхронизации' };
  if (s === 'offline') return { cls: 'offline', text: store.meta.dirty ? 'Нет сети — изменения сохранены на телефоне и отправятся позже' : 'Нет сети' };
  if (store.meta.dirty) return { cls: 'pending', text: 'Есть неотправленные изменения' };
  return { cls: 'ok', text: `Сохранено в облаке · ${U.relTime(store.meta.lastSync)}` };
}

const syncBadge = () => {
  const s = syncState();
  return `<button class="sync s-${s.cls}" data-act="go" data-to="more/cloud" aria-label="${esc(s.text)}" title="${esc(s.text)}">${icon('cloud')}<i></i></button>`;
};

function topbar(title, back) {
  return `<header class="bar">
    ${back ? `<a class="back" href="${back.href}">${icon('chevL')}<span>${esc(back.label)}</span></a>` : ''}
    <h1 class="${back ? 'small' : ''}">${esc(title)}</h1>
    <div class="bar-r">${syncBadge()}</div>
  </header>`;
}

function heroMoney(minor) {
  const cur = store.cur;
  const sign = minor < 0 ? '−' : '';
  const abs = Math.abs(minor);
  const int = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(Math.floor(abs / 100));
  const frac = abs % 100 ? `<span class="frac">,${U.pad(abs % 100)}</span>` : '';
  return `${sign}${int}${frac}<span class="cur">${esc(cur)}</span>`;
}

const accStyle = (a) => { const [c1, c2] = ACCOUNT_COLORS[a.color] || ACCOUNT_COLORS.indigo; return `--c1:${c1};--c2:${c2}`; };

function accCard(a, bal, { tag = 'button', extra = '' } = {}) {
  const attrs = tag === 'button' ? `data-act="acc-open" data-id="${a.id}"` : '';
  return `<${tag} class="acc t-${a.type} ${extra}" style="${accStyle(a)}" ${attrs}>
    <span class="acc-head"><span class="acc-name">${esc(a.name)}</span>${icon(a.type === 'cash' ? 'cash' : 'card')}</span>
    <span class="acc-bal">${money(bal, store.cur)}</span>
    <span class="acc-kind">${a.type === 'cash' ? 'Наличные' : 'Карта'}${a.archived ? ' · в архиве' : ''}</span>
  </${tag}>`;
}

function txRow(t, { withDate = false } = {}) {
  const cur = store.cur;
  let ic, title, amt, cls = '';
  const sub = [];
  if (t.type === 'transfer') {
    ic = `<span class="tx-ic sys">${icon('transfer')}</span>`;
    title = 'Перевод';
    sub.push(`${esc(accName(t.account))} → ${esc(accName(t.to))}`);
    amt = money(t.amount, cur);
    cls = 'neutral';
  } else if (t.type === 'adjust') {
    ic = `<span class="tx-ic sys">${icon('adjust')}</span>`;
    title = 'Корректировка';
    sub.push(esc(accName(t.account)));
    amt = money(t.amount, cur, 'always');
    cls = t.amount > 0 ? 'pos' : '';
  } else {
    const c = catInfo(t.category);
    ic = `<span class="tx-ic">${esc(c.emoji)}</span>`;
    title = c.name;
    sub.push(esc(accName(t.account)));
    amt = t.type === 'expense' ? money(-t.amount, cur) : money(t.amount, cur, 'always');
    cls = t.type === 'income' ? 'pos' : '';
  }
  if (t.note) sub.push(esc(t.note));
  const when = withDate ? `${U.dayTitle(t.date.slice(0, 10))}, ${t.date.slice(11, 16)}` : t.date.slice(11, 16);
  return `<button class="tx" data-act="tx-edit" data-id="${t.id}">
    ${ic}
    <span class="tx-main"><span class="tx-title">${esc(title)}</span><span class="tx-sub">${when} · ${sub.join(' · ')}</span></span>
    <span class="tx-amt ${cls}">${amt}</span>
  </button>`;
}

const empty = (text, sub = '') => `<div class="empty"><div class="empty-ic">${icon('coins')}</div><p>${text}</p>${sub ? `<small>${sub}</small>` : ''}</div>`;

function catRows(rows, total, { act = 'stat-cat', type = 'expense' } = {}) {
  const cur = store.cur;
  return rows.map((r) => {
    const c = catInfo(r.id === '_none' ? null : r.id);
    const pct = total ? (r.sum / total) * 100 : 0;
    return `<button class="cat-row" data-act="${act}" data-id="${r.id}" data-type="${type}">
      <span class="tx-ic">${esc(c.emoji)}</span>
      <span class="cat-mid">
        <span class="cat-line"><span class="cat-name">${esc(c.name)}</span><span class="cat-amt">${money(r.sum, cur)}</span></span>
        <span class="meter ${type}"><span style="width:${Math.max(pct, 0.8).toFixed(1)}%"></span></span>
        <span class="cat-sub">${pct < 1 && pct > 0 ? '<1' : Math.round(pct)}% · ${r.count} ${U.plural(r.count, 'операция', 'операции', 'операций')}</span>
      </span>
    </button>`;
  }).join('');
}

/* ---------- Экран: Главная ---------- */

function viewHome() {
  const cur = store.cur;
  const bal = store.balances();
  const accs = store.accounts();
  const sumOf = (list) => list.reduce((s, a) => s + (bal[a.id] || 0), 0);
  const cards = accs.filter((a) => a.type === 'card');
  const cash = accs.filter((a) => a.type === 'cash');
  const month = { kind: 'month', anchor: U.today() };
  const m = aggregateRange(U.periodRange(month));
  const pm = aggregateRange(comparableRange(month));
  const top = breakdown(m.list, 'expense', 'category').slice(0, 3);
  const recent = store.txs().slice(0, 7);
  const sync = syncState();

  let banner = '';
  if (!cloud.connected) {
    banner = `<button class="banner warn" data-act="go" data-to="more/cloud">${icon('cloud')}<span><b>Данные пока только на этом устройстве</b><small>Подключите облако, чтобы ничего не потерять</small></span>${icon('chevR')}</button>`;
  } else if (cloud.status === 'error') {
    banner = `<button class="banner err" data-act="go" data-to="more/cloud">${icon('warn')}<span><b>Не удалось синхронизировать</b><small>${esc(sync.text)}</small></span>${icon('chevR')}</button>`;
  }

  const hint = !LS.get('hintDone', false) && !store.txs().length ? `
    <section class="card hint">
      <div class="card-head"><h2>С чего начать</h2><button class="icon-btn" data-act="hint-close" aria-label="Скрыть">${icon('x')}</button></div>
      <ol>
        <li>Нажмите на карту или «Наличные» → «Изменить» и укажите, сколько денег сейчас на счёте. Добавьте остальные карты.</li>
        <li>Подключите облако в разделе «Ещё» — тогда история не потеряется, даже если телефон сменится.</li>
        <li>Записывайте траты и пополнения кнопкой <b>+</b> — балансы пересчитаются сами.</li>
      </ol>
    </section>` : '';

  return `${topbar('Бюджет')}
  <div class="pad stack">
    ${banner}
    <section class="hero">
      <div class="hero-label">Всего на счетах</div>
      <div class="hero-value">${heroMoney(sumOf(accs))}</div>
      <div class="hero-split">
        <span>${icon('card')}Карты <b>${money(sumOf(cards), cur)}</b></span>
        <span>${icon('cash')}Наличные <b>${money(sumOf(cash), cur)}</b></span>
      </div>
    </section>
  </div>
  <div class="acc-scroll">
    ${accs.map((a) => accCard(a, bal[a.id] || 0)).join('')}
    <button class="acc add" data-act="acc-new">${icon('plus')}<span>Новый счёт</span></button>
  </div>
  <div class="pad stack">
    <div class="quick">
      <button data-act="tx-new" data-type="expense"><span class="q-ic exp">${icon('minus')}</span>Расход</button>
      <button data-act="tx-new" data-type="income"><span class="q-ic inc">${icon('plus')}</span>Доход</button>
      <button data-act="tx-new" data-type="transfer"><span class="q-ic trf">${icon('transfer')}</span>Перевод</button>
    </div>
    ${hint}
    <section class="card">
      <div class="card-head"><h2>${U.MONTHS[new Date().getMonth()]}</h2><button class="link" data-act="go" data-to="stats">Статистика${icon('chevR')}</button></div>
      <div class="duo">
        <div><span class="lbl">Расходы</span><b>${money(m.expense, cur)}</b>${deltaHtml(m.expense, pm.expense, false, compareSuffix(month))}</div>
        <div><span class="lbl">Доходы</span><b>${money(m.income, cur)}</b>${deltaHtml(m.income, pm.income, true, compareSuffix(month))}</div>
      </div>
      ${top.length ? `<div class="cat-list compact">${catRows(top, m.expense, { act: 'home-cat' })}</div>` : ''}
    </section>
    <section class="card list-card">
      <div class="card-head"><h2>Последние операции</h2>${recent.length ? `<button class="link" data-act="go" data-to="history">Все${icon('chevR')}</button>` : ''}</div>
      ${recent.length ? `<div class="tx-list">${recent.map((t) => txRow(t, { withDate: true })).join('')}</div>` : empty('Пока нет операций', 'Нажмите «+» внизу, чтобы записать первую трату')}
    </section>
  </div>`;
}

/* ---------- Экран: История ---------- */

function histFiltered() {
  const h = ui.hist;
  const r = U.periodRange(h.period);
  const q = h.q.trim().toLowerCase();
  return store.txs().filter((t) => {
    if (!inRange(t, r)) return false;
    if (h.type !== 'all' && t.type !== h.type) return false;
    if (h.account !== 'all' && t.account !== h.account && t.to !== h.account) return false;
    if (h.category !== 'all') {
      if (t.type !== 'expense' && t.type !== 'income') return false;
      if ((t.category || '_none') !== h.category) return false;
    }
    if (q) {
      const hay = [t.note, catInfo(t.category).name, accName(t.account), t.to && accName(t.to), TYPE_NAMES[t.type], U.fmtNum(t.amount), String(t.amount / 100)]
        .join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

function histChips() {
  const h = ui.hist;
  const chip = (what, label, on) => `<button class="chip ${on ? 'on' : ''}" data-act="hist-pick" data-what="${what}">${label}${icon('chevD')}</button>`;
  const cat = h.category === 'all' ? 'Все категории' : `${esc(catInfo(h.category === '_none' ? null : h.category).emoji)} ${esc(catInfo(h.category === '_none' ? null : h.category).name)}`;
  const dirty = h.type !== 'all' || h.account !== 'all' || h.category !== 'all' || h.period.kind !== 'all' || h.q;
  return [
    chip('period', h.period.kind === 'all' ? 'Всё время' : esc(U.periodLabel(h.period)), h.period.kind !== 'all'),
    chip('type', h.type === 'all' ? 'Все типы' : TYPE_NAMES[h.type], h.type !== 'all'),
    chip('account', h.account === 'all' ? 'Все счета' : esc(accName(h.account)), h.account !== 'all'),
    chip('category', cat, h.category !== 'all'),
    dirty ? `<button class="chip ghost" data-act="hist-reset">${icon('x')}Сбросить</button>` : '',
  ].join('');
}

function histResults() {
  const cur = store.cur;
  const h = ui.hist;
  const list = histFiltered();
  const pnav = h.period.kind !== 'all' && h.period.kind !== 'custom'
    ? `<div class="pnav slim"><button class="icon-btn" data-act="hist-shift" data-d="-1" aria-label="Назад">${icon('chevL')}</button><span>${esc(U.periodLabel(h.period))}</span><button class="icon-btn" data-act="hist-shift" data-d="1" aria-label="Вперёд">${icon('chevR')}</button></div>`
    : '';
  if (!list.length) return pnav + empty(store.txs().length ? 'Ничего не найдено' : 'Пока нет операций', store.txs().length ? 'Попробуйте изменить фильтры' : 'Нажмите «+», чтобы записать первую');
  let exp = 0, inc = 0;
  for (const t of list) { if (t.type === 'expense') exp += t.amount; else if (t.type === 'income') inc += t.amount; }
  const shown = list.slice(0, h.limit);
  const groups = [];
  for (const t of shown) {
    const d = t.date.slice(0, 10);
    if (!groups.length || groups[groups.length - 1].d !== d) groups.push({ d, items: [] });
    groups[groups.length - 1].items.push(t);
  }
  return `${pnav}
    <div class="hist-sum pad">
      <span>${list.length} ${U.plural(list.length, 'операция', 'операции', 'операций')}</span>
      <span class="sum-vals">${exp ? `<span>${money(-exp, cur)}</span>` : ''}${inc ? `<span class="pos">${money(inc, cur, 'always')}</span>` : ''}</span>
    </div>
    ${groups.map((g) => {
      let ge = 0, gi = 0;
      for (const t of g.items) { if (t.type === 'expense') ge += t.amount; else if (t.type === 'income') gi += t.amount; }
      return `<section class="day">
        <div class="day-head"><span>${U.dayTitle(g.d)}</span><span>${ge ? money(-ge, cur) : ''}${ge && gi ? ' · ' : ''}${gi ? `<span class="pos">${money(gi, cur, 'always')}</span>` : ''}</span></div>
        <div class="card tx-list">${g.items.map((t) => txRow(t)).join('')}</div>
      </section>`;
    }).join('')}
    ${list.length > shown.length ? `<div class="pad"><button class="btn ghost wide" data-act="hist-more">Показать ещё (${list.length - shown.length})</button></div>` : ''}`;
}

function viewHistory() {
  return `${topbar('История')}
  <div class="pad">
    <label class="search">${icon('search')}<input type="search" placeholder="Поиск: комментарий, категория, сумма" value="${esc(ui.hist.q)}" data-bind="hist-q" enterkeyhint="search" autocomplete="off"></label>
  </div>
  <div class="chips-row" id="hist-chips">${histChips()}</div>
  <div id="hist-results">${histResults()}</div>`;
}

/* ---------- Экран: Статистика ---------- */

function chartBuckets(p, firstDate) {
  const { start, end } = U.periodRange(p);
  const keys = [], labels = [], titles = [];
  let gran = 'day';
  let s = start, e = end;
  if (p.kind === 'all') { s = (firstDate || U.today()).slice(0, 10); e = U.ymd(U.addDays(new Date(), 1)); }
  const days = U.daysBetween(s, e);
  if (p.kind === 'year' || (p.kind !== 'week' && p.kind !== 'month' && days > 45)) gran = 'month';
  if (gran === 'month' && U.daysBetween(s, e) > 750) gran = 'year';

  if (gran === 'day') {
    const every = p.kind === 'week' ? 1 : p.kind === 'month' ? 0 : Math.ceil(days / 7);
    for (let i = 0; i < days; i++) {
      const d = U.addDays(U.parseYmd(s), i);
      const k = U.ymd(d);
      keys.push(k);
      titles.push(`${U.WEEKDAYS[d.getDay()]}, ${U.dayMonth(k)}`);
      if (p.kind === 'week') labels.push(U.WEEKDAYS[d.getDay()]);
      else if (every === 0) labels.push(d.getDate() === 1 || d.getDate() % 5 === 0 ? String(d.getDate()) : '');
      else labels.push(i % every === 0 ? String(d.getDate()) : '');
    }
  } else if (gran === 'month') {
    let d = U.startOfMonth(U.parseYmd(s));
    const last = U.parseYmd(e);
    const n = (last.getFullYear() - d.getFullYear()) * 12 + last.getMonth() - d.getMonth() + (last.getDate() > 1 ? 1 : 0);
    const every = n > 12 ? Math.ceil(n / 8) : 1;
    for (let i = 0; i < n; i++, d = U.addMonths(d, 1)) {
      keys.push(U.ymd(d).slice(0, 7));
      titles.push(`${U.MONTHS[d.getMonth()]} ${d.getFullYear()}`);
      labels.push(i % every === 0 ? U.MONTHS_SHORT[d.getMonth()] : '');
    }
  } else {
    const y0 = U.parseYmd(s).getFullYear(), y1 = U.parseYmd(U.ymd(U.addDays(U.parseYmd(e), -1))).getFullYear();
    for (let y = y0; y <= y1; y++) { keys.push(String(y)); titles.push(String(y)); labels.push(String(y)); }
  }
  return { gran, keys, labels, titles, len: gran === 'day' ? 10 : gran === 'month' ? 7 : 4 };
}

function viewStats() {
  const cur = store.cur;
  const st = ui.stats;
  const p = st.period;
  const r = U.periodRange(p);
  const agg = aggregateRange(r, st.account);
  const prev = p.kind === 'all' ? null : aggregateRange(comparableRange(p), st.account);
  const all = store.txs();
  const firstDate = all.length ? all[all.length - 1].date : null;
  const days = U.elapsedDays(p, firstDate);
  const net = agg.income - agg.expense;
  const mode = st.mode;
  const total = mode === 'expense' ? agg.expense : agg.income;
  const suffix = compareSuffix(p);

  const kinds = [['week', 'Неделя'], ['month', 'Месяц'], ['year', 'Год'], ['all', 'Всё'], ['custom', 'Период']];
  const accLabel = st.account === 'all' ? 'Все счета' : esc(accName(st.account));

  // График
  const b = chartBuckets(p, firstDate);
  const sums = new Map();
  for (const t of agg.list) {
    if (t.type !== mode) continue;
    const k = t.date.slice(0, b.len);
    sums.set(k, (sums.get(k) || 0) + t.amount);
  }
  const values = b.keys.map((k) => sums.get(k) || 0);
  const todayKey = U.today().slice(0, b.len);
  const elapsedBuckets = Math.max(1, b.keys.filter((k) => k <= todayKey).length);
  const sel = st.sel >= 0 && st.sel < values.length ? st.sel : -1;
  const per = b.gran === 'day' ? 'в день' : b.gran === 'month' ? 'в месяц' : 'в год';
  const readout = sel >= 0
    ? `<b>${money(values[sel], cur)}</b><span>${esc(b.titles[sel])}</span><button class="icon-btn" data-act="bar-clear" aria-label="Сбросить">${icon('x')}</button>`
    : `<b>${money(Math.round(total / elapsedBuckets), cur)}</b><span>в среднем ${per}</span>`;

  const cats = breakdown(agg.list, mode, 'category');
  const accs = st.account === 'all' ? breakdown(agg.list, mode, 'account') : [];
  const topTx = agg.list.filter((t) => t.type === mode).sort((a, b2) => b2.amount - a.amount).slice(0, 5);

  return `${topbar('Статистика')}
  <div class="pad stack">
    <div class="seg seg-5">${kinds.map(([k, l]) => `<button data-act="st-kind" data-v="${k}" class="${p.kind === k ? 'on' : ''}">${l}</button>`).join('')}</div>
    <div class="pnav">
      <button class="icon-btn" data-act="st-shift" data-d="-1" ${p.kind === 'all' ? 'disabled' : ''} aria-label="Предыдущий период">${icon('chevL')}</button>
      <button class="pnav-label" data-act="st-range">${esc(U.periodLabel(p))}</button>
      <button class="icon-btn" data-act="st-shift" data-d="1" ${p.kind === 'all' ? 'disabled' : ''} aria-label="Следующий период">${icon('chevR')}</button>
    </div>
    <div class="row-between">
      <button class="chip ${st.account !== 'all' ? 'on' : ''}" data-act="st-acc">${accLabel}${icon('chevD')}</button>
      ${U.isCurrentPeriod(p) ? '<span class="muted small">сравнение — с тем же числом дней прошлого периода</span>' : ''}
    </div>
    <div class="kpis">
      <div class="kpi"><span class="lbl">Расходы</span><b>${money(agg.expense, cur)}</b>${prev ? deltaHtml(agg.expense, prev.expense, false, suffix) : ''}</div>
      <div class="kpi"><span class="lbl">Доходы</span><b>${money(agg.income, cur)}</b>${prev ? deltaHtml(agg.income, prev.income, true, suffix) : ''}</div>
      <div class="kpi"><span class="lbl">Разница</span><b class="${net > 0 ? 'pos' : ''}">${money(net, cur, 'always')}</b><span class="delta muted">доходы − расходы</span></div>
      <div class="kpi"><span class="lbl">Расход в день</span><b>${money(Math.round(agg.expense / days), cur)}</b><span class="delta muted">в среднем за ${days} ${U.plural(days, 'день', 'дня', 'дней')}</span></div>
    </div>
    <div class="seg seg-2">
      <button data-act="st-mode" data-v="expense" class="${mode === 'expense' ? 'on' : ''}">Расходы</button>
      <button data-act="st-mode" data-v="income" class="${mode === 'income' ? 'on' : ''}">Доходы</button>
    </div>
    ${total ? `
    <section class="card chart-card ${mode}">
      <div class="readout">${readout}</div>
      ${barChart(b.keys.map((k, i) => ({ label: b.labels[i], value: values[i] })), { selected: sel })}
    </section>
    <section class="card">
      <div class="card-head"><h2>По категориям</h2><span class="muted small">${money(total, cur)}</span></div>
      <div class="cat-list">${catRows(cats, total, { type: mode })}</div>
    </section>
    ${accs.length > 1 ? `<section class="card">
      <div class="card-head"><h2>По счетам</h2></div>
      <div class="cat-list">${accs.map((x) => {
        const a = store.account(x.id);
        const pct = (x.sum / total) * 100;
        return `<button class="cat-row" data-act="stat-acc" data-id="${x.id}">
          <span class="tx-ic acc-dot" style="${a ? accStyle(a) : ''}">${icon(a?.type === 'cash' ? 'cash' : 'card')}</span>
          <span class="cat-mid">
            <span class="cat-line"><span class="cat-name">${esc(accName(x.id))}</span><span class="cat-amt">${money(x.sum, cur)}</span></span>
            <span class="meter ${mode}"><span style="width:${Math.max(pct, 0.8).toFixed(1)}%"></span></span>
            <span class="cat-sub">${Math.round(pct)}% · ${x.count} ${U.plural(x.count, 'операция', 'операции', 'операций')}</span>
          </span>
        </button>`;
      }).join('')}</div>
    </section>` : ''}
    <section class="card list-card">
      <div class="card-head"><h2>${mode === 'expense' ? 'Самые крупные траты' : 'Самые крупные поступления'}</h2></div>
      <div class="tx-list">${topTx.map((t) => txRow(t, { withDate: true })).join('')}</div>
    </section>` : `<section class="card">${empty(mode === 'expense' ? 'Нет расходов за этот период' : 'Нет доходов за этот период')}</section>`}
  </div>`;
}

/* ---------- Экран: Ещё ---------- */

function viewMore() {
  const cur = store.cur;
  const bal = store.balances();
  const active = store.accounts();
  const archived = store.accounts({ archived: true }).filter((a) => a.archived);
  const theme = LS.get('theme', 'auto');
  const s = syncState();
  const accRow = (a) => `<button class="row" data-act="acc-open" data-id="${a.id}">
      <span class="row-ic acc-dot" style="${accStyle(a)}">${icon(a.type === 'cash' ? 'cash' : 'card')}</span>
      <span class="row-main">${esc(a.name)}<small>${a.type === 'cash' ? 'Наличные' : 'Карта'}</small></span>
      <span class="row-val">${money(bal[a.id] || 0, cur)}</span>${icon('chevR', 'chev')}
    </button>`;
  return `${topbar('Ещё')}
  <div class="pad stack">
    <section class="group">
      <h3>Счета</h3>
      <div class="card list">
        ${active.map(accRow).join('')}
        <button class="row add" data-act="acc-new"><span class="row-ic">${icon('plus')}</span><span class="row-main">Добавить карту или наличные</span></button>
      </div>
      ${archived.length ? `<h3>Архив</h3><div class="card list">${archived.map(accRow).join('')}</div>` : ''}
    </section>
    <section class="group">
      <h3>Категории</h3>
      <div class="card list">
        <a class="row" href="#/more/categories/expense"><span class="row-ic">${icon('tag')}</span><span class="row-main">Категории расходов</span><span class="row-val">${store.categories('expense').length}</span>${icon('chevR', 'chev')}</a>
        <a class="row" href="#/more/categories/income"><span class="row-ic">${icon('tag')}</span><span class="row-main">Категории доходов</span><span class="row-val">${store.categories('income').length}</span>${icon('chevR', 'chev')}</a>
      </div>
    </section>
    <section class="group">
      <h3>Сохранность данных</h3>
      <div class="card list">
        <a class="row" href="#/more/cloud"><span class="row-ic sync-ic s-${s.cls}">${icon('cloud')}<i></i></span><span class="row-main">Облако (GitHub)<small>${esc(s.text)}</small></span>${icon('chevR', 'chev')}</a>
        <button class="row" data-act="export-json"><span class="row-ic">${icon('download')}</span><span class="row-main">Скачать резервную копию<small>Файл JSON со всеми данными</small></span></button>
        <button class="row" data-act="export-csv"><span class="row-ic">${icon('download')}</span><span class="row-main">Экспорт в таблицу<small>CSV для Excel / Numbers</small></span></button>
        <button class="row" data-act="import-json"><span class="row-ic">${icon('upload')}</span><span class="row-main">Загрузить из копии<small>Объединит файл с текущими данными</small></span></button>
      </div>
    </section>
    <section class="group">
      <h3>Настройки</h3>
      <div class="card list">
        <button class="row" data-act="pick-currency"><span class="row-ic">${icon('coins')}</span><span class="row-main">Валюта</span><span class="row-val">${esc(cur)}</span>${icon('chevR', 'chev')}</button>
        <button class="row" data-act="pick-theme"><span class="row-ic">${icon('palette')}</span><span class="row-main">Тема</span><span class="row-val">${{ auto: 'Как в системе', light: 'Светлая', dark: 'Тёмная' }[theme]}</span>${icon('chevR', 'chev')}</button>
      </div>
    </section>
    <p class="foot">Бюджет · версия ${APP_VERSION}</p>
  </div>`;
}

function viewCategories(kind) {
  const cats = store.categories(kind, { archived: true });
  const counts = {};
  for (const t of store.txs()) if (t.category) counts[t.category] = (counts[t.category] || 0) + 1;
  const row = (c) => `<button class="row" data-act="cat-edit" data-id="${c.id}">
      <span class="row-ic emoji">${esc(c.emoji)}</span>
      <span class="row-main">${esc(c.name)}<small>${counts[c.id] ? `${counts[c.id]} ${U.plural(counts[c.id], 'операция', 'операции', 'операций')}` : 'нет операций'}</small></span>
      ${icon('chevR', 'chev')}
    </button>`;
  const active = cats.filter((c) => !c.archived), arch = cats.filter((c) => c.archived);
  return `${topbar('Категории', { href: '#/more', label: 'Ещё' })}
  <div class="pad stack">
    <div class="seg seg-2">
      <a href="#/more/categories/expense" class="${kind === 'expense' ? 'on' : ''}">Расходы</a>
      <a href="#/more/categories/income" class="${kind === 'income' ? 'on' : ''}">Доходы</a>
    </div>
    <div class="card list">
      ${active.map(row).join('')}
      <button class="row add" data-act="cat-new" data-kind="${kind}"><span class="row-ic">${icon('plus')}</span><span class="row-main">Новая категория</span></button>
    </div>
    ${arch.length ? `<section class="group"><h3>Архив</h3><div class="card list">${arch.map(row).join('')}</div></section>` : ''}
  </div>`;
}

function tokenUrl() {
  const c = cloud.defaults;
  const q = new URLSearchParams({
    name: 'Budget app',
    description: `Доступ приложения «Бюджет» к ${c.repo}`,
    target_name: c.owner,
    expires_in: 'none',
    contents: 'write',
  });
  return `https://github.com/settings/personal-access-tokens/new?${q}`;
}

function viewCloud() {
  const c = cloud.defaults;
  const s = syncState();
  const back = { href: '#/more', label: 'Ещё' };
  if (cloud.connected) {
    return `${topbar('Облако', back)}
    <div class="pad stack">
      <section class="card cloud-status s-${s.cls}">
        <div class="cs-ic">${icon(s.cls === 'error' ? 'warn' : 'cloud')}</div>
        <div><b>${s.cls === 'ok' ? 'Все данные в облаке' : esc(s.cls === 'syncing' ? 'Синхронизация…' : s.cls === 'pending' ? 'Ожидает отправки' : s.cls === 'offline' ? 'Нет сети' : 'Ошибка')}</b><small>${esc(s.text)}</small></div>
      </section>
      <div class="card list">
        <div class="row static"><span class="row-ic">${icon('archive')}</span><span class="row-main">Репозиторий<small>${esc(cloud.cfg.owner)}/${esc(cloud.cfg.repo)} · ${esc(cloud.cfg.path)}</small></span></div>
        <button class="row" data-act="sync-now"><span class="row-ic">${icon('refresh')}</span><span class="row-main">Синхронизировать сейчас</span></button>
        <a class="row" href="${cloud.historyUrl}" target="_blank" rel="noopener"><span class="row-ic">${icon('clock')}</span><span class="row-main">История изменений на GitHub<small>Каждое сохранение — отдельная версия, любую можно восстановить</small></span>${icon('ext', 'chev')}</a>
        <button class="row" data-act="copy-link"><span class="row-ic">${icon('link')}</span><span class="row-main">Ссылка для другого устройства<small>Откройте её на новом телефоне — облако подключится само</small></span></button>
      </div>
      <p class="note">Данные хранятся в приватном репозитории GitHub: видите их только вы. На телефоне хранится копия, поэтому приложение работает и без интернета — изменения отправятся, когда сеть появится.</p>
      <div class="card list">
        <button class="row danger" data-act="disconnect"><span class="row-ic">${icon('x')}</span><span class="row-main">Отключить на этом устройстве<small>Данные в облаке останутся</small></span></button>
      </div>
    </div>`;
  }
  return `${topbar('Облако', back)}
  <div class="pad stack">
    <section class="card cloud-status s-off">
      <div class="cs-ic">${icon('cloud')}</div>
      <div><b>Облако не подключено</b><small>Сейчас данные хранятся только в этом браузере. Если очистить Safari или сменить телефон — они пропадут.</small></div>
    </section>
    <section class="card steps">
      <h2>Подключение — один раз на устройство</h2>
      <ol>
        <li>
          <p>Создайте токен доступа на GitHub. Это ключ только к одному приватному репозиторию с данными.</p>
          <a class="btn secondary wide" href="${esc(tokenUrl())}" target="_blank" rel="noopener">${icon('ext')}Создать токен на GitHub</a>
          <p class="small muted">На странице GitHub: <b>Expiration</b> — «No expiration»; <b>Repository access</b> — «Only select repositories» → <b>${esc(c.repo)}</b>; <b>Permissions → Contents</b> — «Read and write». Нажмите «Generate token» и скопируйте его.</p>
        </li>
        <li>
          <p>Вставьте токен сюда:</p>
          <form id="cloud-form" class="form" autocomplete="on">
            <label class="field"><span>Репозиторий</span><input name="username" autocomplete="username" value="${esc(c.owner)}/${esc(c.repo)}" autocapitalize="off" spellcheck="false" required></label>
            <label class="field"><span>Токен</span><input name="password" type="password" autocomplete="current-password" placeholder="github_pat_…" autocapitalize="off" spellcheck="false" required></label>
            <details class="adv"><summary>Дополнительно</summary>
              <label class="field"><span>Файл с данными</span><input name="path" value="${esc(c.path)}" autocapitalize="off" spellcheck="false"></label>
            </details>
            <button class="btn primary wide" type="submit">Подключить</button>
            <p class="form-error" id="cloud-error" hidden></p>
          </form>
          <p class="small muted">Если Safari предложит сохранить пароль — согласитесь: тогда токен будет в Связке ключей iCloud и его не придётся искать.</p>
        </li>
      </ol>
    </section>
  </div>`;
}

const VIEWS = { home: viewHome, history: viewHistory, stats: viewStats, more: viewMore };

function parseRoute() {
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  const name = VIEWS[parts[0]] ? parts[0] : 'home';
  return { name, sub: parts.slice(1) };
}

function render() {
  const r = ui.route;
  if (r.name === 'more' && r.sub[0] === 'cloud') view.innerHTML = viewCloud();
  else if (r.name === 'more' && r.sub[0] === 'categories') view.innerHTML = viewCategories(r.sub[1] === 'income' ? 'income' : 'expense');
  else view.innerHTML = VIEWS[r.name]();
  $$('.tabbar [data-tab]').forEach((a) => a.classList.toggle('on', a.dataset.tab === r.name));
}

function go(to) {
  const hash = '#/' + (to === 'home' ? '' : to);
  if (location.hash === hash || (to === 'home' && !location.hash)) { ui.route = parseRoute(); render(); }
  else location.hash = hash;
}

/* ---------- Нижние шторки ---------- */

const topSheet = () => sheets[sheets.length - 1];

function openSheet(s) {
  sheets.push(s);
  renderSheet(true);
}

function closeSheet() {
  sheets.pop();
  if (sheets.length) renderSheet(true);
  else {
    sheetRoot.classList.remove('open');
    document.documentElement.classList.remove('locked');
    setTimeout(() => { if (!sheets.length) { sheetRoot.hidden = true; sheetEl.innerHTML = ''; } }, 300);
  }
}

function renderSheet(fresh = false) {
  const s = topSheet();
  if (!s) return;
  const { title, body, action } = SHEETS[s.type](s);
  const prevBody = $('.sheet-body', sheetEl);
  const scroll = !fresh && prevBody ? prevBody.scrollTop : 0;
  sheetEl.innerHTML = `
    <div class="grabber"></div>
    <div class="sheet-head">
      <button class="hbtn" data-act="sheet-close">${sheets.length > 1 ? 'Назад' : 'Закрыть'}</button>
      <h3>${esc(title)}</h3>
      ${action ? `<button class="hbtn strong" data-act="${action.act}">${action.label}</button>` : '<span class="hbtn"></span>'}
    </div>
    <div class="sheet-body">${body}</div>`;
  $('.sheet-body', sheetEl).scrollTop = scroll;
  if (!sheetRoot.classList.contains('open')) {
    sheetRoot.hidden = false;
    void sheetRoot.offsetHeight;
    sheetRoot.classList.add('open');
    document.documentElement.classList.add('locked');
  }
}

function setOn(container, selector, el) {
  $$(selector, container).forEach((x) => x.classList.toggle('on', x === el));
}

/* --- Шторка: операция --- */

function newTxForm(type, account) {
  const accs = store.accounts();
  const last = LS.get('lastAcc.' + type, null);
  const acc = account || (accs.some((a) => a.id === last) ? last : accs[0]?.id) || null;
  let to = null;
  if (type === 'transfer') to = accs.find((a) => a.id !== acc && a.type !== store.account(acc)?.type)?.id || accs.find((a) => a.id !== acc)?.id || null;
  return { type, amount: '', account: acc, to, category: null, date: U.nowLocal(), note: '' };
}

function accChips(selected, act, exclude) {
  const bal = store.balances();
  const list = store.accounts({ archived: true }).filter((a) => a.id !== exclude && (!a.archived || a.id === selected));
  if (!list.length) return `<button class="chip" data-act="acc-new">${icon('plus')}Добавить счёт</button>`;
  return list.map((a) => `<button class="chip acc-chip ${a.id === selected ? 'on' : ''}" data-act="${act}" data-id="${a.id}">
      <span class="sw" style="${accStyle(a)}"></span><span>${esc(a.name)}<small>${money(bal[a.id] || 0, store.cur)}</small></span>
    </button>`).join('');
}

function amountHint(f) {
  if (!U.isExpression(f.amount)) return '';
  const v = U.parseAmount(f.amount);
  return v == null ? 'Не получается посчитать' : `= ${money(v, store.cur)}`;
}

function txSheet(s) {
  const f = s.form;
  const isAdjust = f.type === 'adjust';
  const types = [['expense', 'Расход'], ['income', 'Доход'], ['transfer', 'Перевод']];
  const t = U.today(), y = U.ymd(U.addDays(new Date(), -1));
  const day = f.date.slice(0, 10);
  let cats = '';
  if (f.type === 'expense' || f.type === 'income') {
    const list = store.categories(f.type, { archived: true }).filter((c) => !c.archived || c.id === f.category);
    cats = `<div class="field-label">Категория</div>
      <div class="cat-grid">
        ${list.map((c) => `<button class="cat ${c.id === f.category ? 'on' : ''}" data-act="tx-cat" data-id="${c.id}"><span class="cat-e">${esc(c.emoji)}</span><span class="cat-n">${esc(c.name)}</span></button>`).join('')}
        <button class="cat add" data-act="cat-new-inline"><span class="cat-e">${icon('plus')}</span><span class="cat-n">Новая</span></button>
      </div>`;
  }
  const body = `
    ${isAdjust ? '' : `<div class="seg seg-3">${types.map(([k, l]) => `<button data-act="tx-type" data-v="${k}" class="${f.type === k ? 'on' : ''} ${k}">${l}</button>`).join('')}</div>`}
    <div class="amount-box ${f.type}">
      <input id="amt" class="amount-input" data-f="amount" inputmode="decimal" placeholder="0" value="${esc(f.amount)}" autocomplete="off" enterkeyhint="done" aria-label="Сумма">
      <span class="amount-cur">${esc(store.cur)}</span>
      <button class="mini-key" data-act="amt-plus" aria-label="Прибавить">+</button>
    </div>
    <div class="amount-hint" id="amt-hint">${amountHint(f)}</div>
    <div class="field-label">${f.type === 'transfer' ? 'Откуда' : 'Счёт'}</div>
    <div class="chips-row in-sheet" data-group="acc">${accChips(f.account, 'tx-acc')}</div>
    ${f.type === 'transfer' ? `<div class="field-label">Куда</div><div class="chips-row in-sheet" data-group="to">${accChips(f.to, 'tx-to', f.account)}</div>` : ''}
    ${cats}
    <div class="field-label">Дата</div>
    <div class="date-row">
      <button class="chip ${day === t ? 'on' : ''}" data-act="tx-day" data-d="0">Сегодня</button>
      <button class="chip ${day === y ? 'on' : ''}" data-act="tx-day" data-d="-1">Вчера</button>
      <input type="datetime-local" class="date-input" data-f="date" value="${esc(f.date)}" aria-label="Дата и время">
    </div>
    <div class="field-label">Комментарий</div>
    <input class="text-input" data-f="note" value="${esc(f.note)}" placeholder="${f.type === 'expense' ? 'Например: обед с коллегами' : 'Необязательно'}" maxlength="200" enterkeyhint="done">
    <button class="btn primary big wide" data-act="tx-save">${s.id ? 'Сохранить изменения' : 'Записать'}</button>
    ${s.id ? `<button class="btn danger wide" data-act="tx-delete">${icon('trash')}Удалить операцию</button>` : ''}
  `;
  return { title: s.id ? TYPE_NAMES[f.type] : 'Новая операция', body, action: { act: 'tx-save', label: 'Готово' } };
}

function openTx(type, account) {
  openSheet({ type: 'tx', form: newTxForm(type, account) });
  focusAmount();
}

function focusAmount() {
  const el = $('#amt', sheetEl);
  if (el) try { el.focus({ preventScroll: true }); } catch { /* ignore */ }
}

function openTxEdit(id) {
  const t = store.data.transactions.find((x) => x.id === id);
  if (!t) return;
  const amount = (t.type === 'adjust' && t.amount < 0 ? '-' : '') + U.amountToInput(t.amount);
  openSheet({ type: 'tx', id, form: { type: t.type, amount, account: t.account, to: t.to || null, category: t.category || null, date: t.date, note: t.note || '' } });
}

/* --- Шторка: счёт (просмотр) --- */

function accViewSheet(s) {
  const a = store.account(s.id);
  if (!a) return { title: 'Счёт', body: empty('Счёт удалён') };
  const cur = store.cur;
  const bal = store.balances()[a.id] || 0;
  const m = aggregateRange(U.periodRange({ kind: 'month', anchor: U.today() }), a.id);
  const recent = store.txs().filter((t) => t.account === a.id || t.to === a.id).slice(0, 5);
  const body = `
    ${accCard(a, bal, { tag: 'div', extra: 'big' })}
    <div class="duo slim">
      <div><span class="lbl">Расходы за ${U.MONTHS[new Date().getMonth()].toLowerCase()}</span><b>${money(m.expense, cur)}</b></div>
      <div><span class="lbl">Доходы за ${U.MONTHS[new Date().getMonth()].toLowerCase()}</span><b>${money(m.income, cur)}</b></div>
    </div>
    <div class="actions4">
      <button data-act="tx-new" data-type="expense" data-acc="${a.id}"><span class="q-ic exp">${icon('minus')}</span>Расход</button>
      <button data-act="tx-new" data-type="income" data-acc="${a.id}"><span class="q-ic inc">${icon('plus')}</span>Доход</button>
      <button data-act="tx-new" data-type="transfer" data-acc="${a.id}"><span class="q-ic trf">${icon('transfer')}</span>Перевод</button>
      <button data-act="acc-adjust" data-id="${a.id}"><span class="q-ic adj">${icon('adjust')}</span>Сверить</button>
    </div>
    <div class="field-label">Последние операции</div>
    ${recent.length ? `<div class="card tx-list">${recent.map((t) => txRow(t, { withDate: true })).join('')}</div>
      <button class="btn ghost wide" data-act="acc-history" data-id="${a.id}">Вся история счёта${icon('chevR')}</button>` : empty('По этому счёту ещё нет операций')}
  `;
  return { title: a.name, body, action: { act: 'acc-edit', label: 'Изменить' } };
}

/* --- Шторка: сверка баланса --- */

function adjustSheet(s) {
  const a = store.account(s.id);
  const bal = store.balances()[a.id] || 0;
  const body = `
    <p class="note">Сейчас в приложении: <b>${money(bal, store.cur)}</b>. Введите, сколько на самом деле на счёте «${esc(a.name)}» — разница запишется отдельной операцией «Корректировка», и история останется честной.</p>
    <div class="amount-box">
      <input id="amt" class="amount-input" data-f="amount" inputmode="decimal" value="${esc(s.form.amount)}" autocomplete="off" enterkeyhint="done" aria-label="Фактический баланс">
      <span class="amount-cur">${esc(store.cur)}</span>
    </div>
    <div class="amount-hint" id="amt-hint">${adjustHint(s)}</div>
    <button class="btn primary big wide" data-act="adj-save">Сохранить</button>`;
  return { title: 'Сверка баланса', body, action: { act: 'adj-save', label: 'Готово' } };
}

function adjustHint(s) {
  const v = U.parseAmount(s.form.amount);
  if (v == null) return 'Введите сумму';
  const d = v - (store.balances()[s.id] || 0);
  return d ? `Корректировка: ${money(d, store.cur, 'always')}` : 'Баланс совпадает — ничего менять не нужно';
}

/* --- Шторка: редактор счёта --- */

function accEditSheet(s) {
  const f = s.form;
  const isNew = !s.id;
  const preview = { name: f.name || 'Новый счёт', type: f.type, color: f.color };
  const bal = isNew ? U.parseAmount(f.initial) || 0 : (store.balances()[s.id] || 0) - (store.account(s.id).initial || 0) + (U.parseAmount(f.initial) || 0);
  const a = s.id && store.account(s.id);
  const used = s.id && store.usage('account', s.id);
  const body = `
    ${accCard(preview, bal, { tag: 'div', extra: 'big' })}
    <div class="seg seg-2">
      <button data-act="acc-type" data-v="card" class="${f.type === 'card' ? 'on' : ''}">${icon('card')}Карта</button>
      <button data-act="acc-type" data-v="cash" class="${f.type === 'cash' ? 'on' : ''}">${icon('cash')}Наличные</button>
    </div>
    <label class="field"><span>Название</span><input class="text-input" data-f="name" value="${esc(f.name)}" placeholder="${f.type === 'cash' ? 'Например: Кошелёк' : 'Например: Т-Банк зарплатная'}" maxlength="40"></label>
    <div class="field-label">Цвет</div>
    <div class="swatches">${Object.keys(ACCOUNT_COLORS).map((k) => `<button class="swatch ${f.color === k ? 'on' : ''}" data-act="acc-color" data-v="${k}" style="${accStyle({ color: k })}" aria-label="${k}"></button>`).join('')}</div>
    <label class="field"><span>${isNew ? 'Сколько сейчас на счёте' : 'Начальный баланс'}</span>
      <input class="text-input" data-f="initial" inputmode="decimal" value="${esc(f.initial)}" placeholder="0" autocomplete="off"></label>
    <p class="small muted">${isNew ? 'Дальше баланс будет меняться сам по мере записи операций.' : 'Сумма, которая была на счёте до первой записанной операции. Если нужно просто поправить текущий баланс — используйте «Сверить» на карточке счёта.'}</p>
    <button class="btn primary big wide" data-act="acc-save">${isNew ? 'Добавить счёт' : 'Сохранить'}</button>
    ${a ? `
      <div class="row-btns">
        <button class="btn ghost" data-act="acc-move" data-d="-1">${icon('up')}Выше</button>
        <button class="btn ghost" data-act="acc-move" data-d="1">${icon('down')}Ниже</button>
      </div>
      ${a.archived
        ? `<button class="btn secondary wide" data-act="acc-archive" data-v="0">${icon('archive')}Вернуть из архива</button>`
        : `<button class="btn ghost wide" data-act="acc-archive" data-v="1">${icon('archive')}Убрать в архив</button>`}
      ${used ? '<p class="small muted center">Счёт с операциями нельзя удалить — только убрать в архив, чтобы история не потерялась.</p>' : `<button class="btn danger wide" data-act="acc-delete">${icon('trash')}Удалить счёт</button>`}
    ` : ''}`;
  return { title: isNew ? 'Новый счёт' : 'Изменить счёт', body, action: { act: 'acc-save', label: 'Готово' } };
}

/* --- Шторка: категория --- */

function catEditSheet(s) {
  const f = s.form;
  const c = s.id && store.category(s.id);
  const used = s.id && store.usage('category', s.id);
  const body = `
    <div class="emoji-hero">${esc(f.emoji || '•')}</div>
    <label class="field"><span>Название</span><input class="text-input" data-f="name" value="${esc(f.name)}" placeholder="Например: Кофе" maxlength="30"></label>
    <div class="field-label">Иконка</div>
    <div class="emoji-grid">${EMOJIS.map((e) => `<button class="emo ${e === f.emoji ? 'on' : ''}" data-act="cat-emoji" data-v="${e}">${e}</button>`).join('')}</div>
    <label class="field"><span>Или свой эмодзи</span><input class="text-input" data-f="emoji" value="${esc(f.emoji)}" maxlength="8"></label>
    <button class="btn primary big wide" data-act="cat-save">${c ? 'Сохранить' : 'Добавить категорию'}</button>
    ${c ? `
      <div class="row-btns">
        <button class="btn ghost" data-act="cat-move" data-d="-1">${icon('up')}Выше</button>
        <button class="btn ghost" data-act="cat-move" data-d="1">${icon('down')}Ниже</button>
      </div>
      ${c.archived
        ? `<button class="btn secondary wide" data-act="cat-archive" data-v="0">${icon('archive')}Вернуть из архива</button>`
        : used ? `<button class="btn ghost wide" data-act="cat-archive" data-v="1">${icon('archive')}Убрать в архив</button><p class="small muted center">Категория используется в операциях — её можно только скрыть из списка, история сохранится.</p>`
          : `<button class="btn danger wide" data-act="cat-delete">${icon('trash')}Удалить категорию</button>`}` : ''}`;
  return { title: c ? 'Категория' : (f.kind === 'income' ? 'Новая категория дохода' : 'Новая категория расхода'), body, action: { act: 'cat-save', label: 'Готово' } };
}

/* --- Шторка: выбор из списка --- */

function pickerSheet(s) {
  const body = `<div class="card list">${s.options.map((o) => `<button class="row" data-act="pick" data-v="${esc(o.v)}">
      ${o.icon ? `<span class="row-ic ${o.iconCls || ''}" ${o.iconStyle ? `style="${o.iconStyle}"` : ''}>${o.icon}</span>` : ''}
      <span class="row-main">${esc(o.label)}${o.sub ? `<small>${esc(o.sub)}</small>` : ''}</span>
      ${o.v === s.value ? icon('check', 'chk') : ''}
    </button>`).join('')}</div>`;
  return { title: s.title, body };
}

function pick(title, options, value, onPick) {
  openSheet({ type: 'picker', title, options, value, onPick });
}

/* --- Шторка: свой период --- */

function rangeSheet(s) {
  const t = new Date();
  const presets = [
    ['Последние 7 дней', U.ymd(U.addDays(t, -6)), U.today()],
    ['Последние 30 дней', U.ymd(U.addDays(t, -29)), U.today()],
    ['Последние 90 дней', U.ymd(U.addDays(t, -89)), U.today()],
    ['Прошлый месяц', U.ymd(U.addMonths(t, -1)), U.ymd(U.addDays(U.startOfMonth(t), -1))],
    ['С начала года', `${t.getFullYear()}-01-01`, U.today()],
    ['Последние 12 месяцев', U.ymd(U.addMonths(t, -11)), U.today()],
  ];
  const body = `
    <div class="card list">${presets.map(([l, a, b]) => `<button class="row" data-act="range-preset" data-from="${a}" data-to="${b}"><span class="row-main">${l}<small>${U.dayMonth(a)} – ${U.dayMonth(b)}</small></span></button>`).join('')}</div>
    <div class="field-label">Свои даты</div>
    <div class="range-row">
      <label class="field"><span>С</span><input type="date" class="text-input" data-f="from" value="${esc(s.form.from)}"></label>
      <label class="field"><span>По</span><input type="date" class="text-input" data-f="to" value="${esc(s.form.to)}"></label>
    </div>
    <button class="btn primary big wide" data-act="range-apply">Показать</button>`;
  return { title: 'Период', body, action: { act: 'range-apply', label: 'Готово' } };
}

const SHEETS = { tx: txSheet, 'acc-view': accViewSheet, adjust: adjustSheet, 'acc-edit': accEditSheet, 'cat-edit': catEditSheet, picker: pickerSheet, range: rangeSheet };

/* ---------- Тост ---------- */

let toastTimer;
function toast(text, action) {
  const root = $('#toast');
  root.innerHTML = `<span>${esc(text)}</span>${action ? `<button data-act="toast-action">${esc(action.label)}</button>` : ''}`;
  root._action = action;
  root.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => root.classList.remove('show'), action ? 5000 : 2600);
}

function shake(el) {
  if (!el) return;
  el.classList.remove('shake');
  void el.offsetWidth;
  el.classList.add('shake');
}

/* ---------- Файлы ---------- */

async function download(filename, text, mime) {
  const blob = new Blob([text], { type: mime });
  try {
    const file = new File([blob], filename, { type: mime });
    if (/iPhone|iPad|iPod/.test(navigator.userAgent) && navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: filename });
      return;
    }
  } catch (e) {
    if (e?.name === 'AbortError') return;
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
}

function exportCsv() {
  const cur = store.cur;
  const rows = [['Дата', 'Время', 'Тип', 'Сумма', 'Валюта', 'Счёт', 'Счёт зачисления', 'Категория', 'Комментарий']];
  for (const t of [...store.txs()].reverse()) {
    const signed = t.type === 'expense' ? -t.amount : t.amount;
    rows.push([
      t.date.slice(0, 10), t.date.slice(11, 16), TYPE_NAMES[t.type], (signed / 100).toFixed(2).replace('.', ','), cur,
      accName(t.account), t.to ? accName(t.to) : '', t.type === 'expense' || t.type === 'income' ? catInfo(t.category).name : '', t.note || '',
    ]);
  }
  const cell = (v) => { const s = String(v ?? ''); return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  download(`budget-${U.today()}.csv`, '\ufeff' + rows.map((r) => r.map(cell).join(';')).join('\r\n'), 'text/csv');
}

/* ---------- Действия ---------- */

function histSet(patch) {
  Object.assign(ui.hist, patch, { limit: 150 });
  $('#hist-chips') && ($('#hist-chips').innerHTML = histChips());
  $('#hist-results') && ($('#hist-results').innerHTML = histResults());
}

function periodOptions(current) {
  const t = U.today();
  const prevMonth = U.ymd(U.addMonths(new Date(), -1));
  return {
    options: [
      { v: 'all', label: 'Всё время' },
      { v: 'week', label: 'Эта неделя' },
      { v: 'month', label: 'Этот месяц' },
      { v: 'prev-month', label: 'Прошлый месяц' },
      { v: 'year', label: 'Этот год' },
      { v: 'custom', label: 'Выбрать даты…' },
    ],
    value: current.kind === 'month' && current.anchor?.slice(0, 7) === prevMonth.slice(0, 7) ? 'prev-month' : current.kind,
    resolve: (v) => (v === 'prev-month' ? { kind: 'month', anchor: prevMonth } : { kind: v, anchor: t }),
  };
}

function openRange(period, onApply) {
  const r = U.periodRange(period.kind === 'all' ? { kind: 'month', anchor: U.today() } : period);
  openSheet({ type: 'range', form: { from: r.start, to: U.ymd(U.addDays(U.parseYmd(r.end), -1)) }, onApply });
}

const accountOptions = (allLabel) => [
  { v: 'all', label: allLabel },
  ...store.accounts({ archived: true }).map((a) => ({ v: a.id, label: a.name, sub: a.archived ? 'в архиве' : a.type === 'cash' ? 'Наличные' : 'Карта', icon: icon(a.type === 'cash' ? 'cash' : 'card'), iconCls: 'acc-dot', iconStyle: accStyle(a) })),
];

const A = {
  go: (el) => go(el.dataset.to),
  'sheet-close': () => closeSheet(),
  'hint-close': () => { LS.set('hintDone', true); render(); },
  'toast-action': () => { const r = $('#toast'); r.classList.remove('show'); r._action?.fn(); },

  // операции
  'tx-new': (el) => {
    if (!store.accounts().length) { toast('Сначала добавьте счёт'); return; }
    openTx(el.dataset.type || 'expense', el.dataset.acc);
  },
  'tx-edit': (el) => openTxEdit(el.dataset.id),
  'tx-type': (el) => {
    const s = topSheet();
    const f = s.form;
    if (f.type === el.dataset.v) return;
    const fresh = newTxForm(el.dataset.v, f.account);
    s.form = { ...fresh, amount: f.amount, date: f.date, note: f.note };
    renderSheet();
  },
  'tx-acc': (el) => {
    const f = topSheet().form;
    f.account = el.dataset.id;
    if (f.type === 'transfer') {
      if (f.to === f.account) f.to = store.accounts().find((a) => a.id !== f.account)?.id || null;
      renderSheet();
    } else setOn(el.parentElement, '.chip', el);
  },
  'tx-to': (el) => { topSheet().form.to = el.dataset.id; setOn(el.parentElement, '.chip', el); },
  'tx-cat': (el) => { topSheet().form.category = el.dataset.id; setOn(el.parentElement, '.cat', el); },
  'tx-day': (el) => {
    const f = topSheet().form;
    const time = f.date.slice(11, 16) || U.hm(new Date());
    f.date = `${U.ymd(U.addDays(new Date(), Number(el.dataset.d)))}T${time}`;
    $('.date-input', sheetEl).value = f.date;
    setOn(el.parentElement, '.chip', el);
  },
  'amt-plus': () => {
    const f = topSheet().form;
    const input = $('#amt', sheetEl);
    if (f.amount && !/[-+]\s*$/.test(f.amount)) f.amount += '+';
    input.value = f.amount;
    input.focus();
    $('#amt-hint', sheetEl).textContent = amountHint(f);
  },
  'tx-save': () => {
    const s = topSheet();
    const f = s.form;
    const amount = U.parseAmount(f.amount);
    if (amount == null || amount === 0 || (f.type !== 'adjust' && amount < 0)) { shake($('.amount-box', sheetEl)); toast('Введите сумму'); return; }
    if (!f.account) { toast('Выберите счёт'); return; }
    if (f.type === 'transfer' && (!f.to || f.to === f.account)) { toast('Выберите, на какой счёт перевод'); return; }
    if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d/.test(f.date)) f.date = U.nowLocal();
    store.saveTx({ id: s.id, ...f, amount, date: f.date.slice(0, 16) });
    LS.set('lastAcc.' + f.type, f.account);
    closeSheet();
    toast(s.id ? 'Изменения сохранены' : 'Записано');
  },
  'tx-delete': () => {
    const s = topSheet();
    store.setTxDeleted(s.id, true);
    closeSheet();
    toast('Операция удалена', { label: 'Вернуть', fn: () => store.setTxDeleted(s.id, false) });
  },

  // счета
  'acc-open': (el) => openSheet({ type: 'acc-view', id: el.dataset.id, live: true }),
  'acc-new': () => openSheet({ type: 'acc-edit', form: { name: '', type: 'card', color: 'graphite', initial: '' } }),
  'acc-edit': () => {
    const a = store.account(topSheet().id);
    openSheet({ type: 'acc-edit', id: a.id, form: { name: a.name, type: a.type, color: a.color, initial: a.initial ? (a.initial < 0 ? '-' : '') + U.amountToInput(a.initial) : '' } });
  },
  'acc-type': (el) => {
    const f = topSheet().form;
    f.type = el.dataset.v;
    if (!topSheet().id && f.type === 'cash' && f.color === 'graphite') f.color = 'green';
    renderSheet();
  },
  'acc-color': (el) => { topSheet().form.color = el.dataset.v; renderSheet(); },
  'acc-save': () => {
    const s = topSheet();
    const f = s.form;
    const name = f.name.trim();
    if (!name) { shake($('[data-f="name"]', sheetEl)); toast('Введите название'); return; }
    const initial = f.initial.trim() ? U.parseAmount(f.initial) : 0;
    if (initial == null) { shake($('[data-f="initial"]', sheetEl)); toast('Не получается прочитать сумму'); return; }
    store.saveAccount({ id: s.id, name, type: f.type, color: f.color, initial });
    closeSheet();
    toast(s.id ? 'Счёт сохранён' : 'Счёт добавлен');
  },
  'acc-move': (el) => { store.moveAccount(topSheet().id, Number(el.dataset.d)); toast('Порядок изменён'); },
  'acc-archive': (el) => {
    const s = topSheet();
    const a = store.account(s.id);
    const on = el.dataset.v === '1';
    if (on && (store.balances()[a.id] || 0) !== 0 && !confirm(`На счёте «${a.name}» ещё ${money(store.balances()[a.id], store.cur)}. Архивный счёт не учитывается в общем балансе. Убрать в архив?`)) return;
    store.setAccountState(a.id, { archived: on }, `${on ? 'Счёт в архиве' : 'Счёт из архива'}: ${a.name}`);
    sheets.length = 0;
    closeSheet();
    toast(on ? 'Счёт убран в архив' : 'Счёт возвращён');
  },
  'acc-delete': () => {
    const a = store.account(topSheet().id);
    if (!confirm(`Удалить счёт «${a.name}»?`)) return;
    store.setAccountState(a.id, { deleted: true }, `Счёт удалён: ${a.name}`);
    sheets.length = 0;
    closeSheet();
    toast('Счёт удалён');
  },
  'acc-adjust': (el) => {
    const bal = store.balances()[el.dataset.id] || 0;
    openSheet({ type: 'adjust', id: el.dataset.id, form: { amount: (bal < 0 ? '-' : '') + U.amountToInput(bal) } });
    const input = $('#amt', sheetEl);
    try { input.focus({ preventScroll: true }); input.select(); } catch { /* ignore */ }
  },
  'adj-save': () => {
    const s = topSheet();
    const v = U.parseAmount(s.form.amount);
    if (v == null) { shake($('.amount-box', sheetEl)); return; }
    const tx = store.adjustBalance(s.id, v);
    closeSheet();
    toast(tx ? 'Баланс сверен' : 'Баланс не изменился');
  },
  'acc-history': (el) => {
    sheets.length = 0;
    closeSheet();
    Object.assign(ui.hist, { q: '', type: 'all', account: el.dataset.id, category: 'all', period: { kind: 'all' }, limit: 150 });
    go('history');
  },

  // категории
  'cat-new': (el) => openSheet({ type: 'cat-edit', form: { name: '', emoji: '🏷️', kind: el.dataset.kind } }),
  'cat-new-inline': () => {
    const kind = topSheet().form.type;
    openSheet({ type: 'cat-edit', fromTx: true, form: { name: '', emoji: '🏷️', kind } });
  },
  'cat-edit': (el) => { const c = store.category(el.dataset.id); openSheet({ type: 'cat-edit', id: c.id, form: { name: c.name, emoji: c.emoji, kind: c.kind } }); },
  'cat-emoji': (el) => { const f = topSheet().form; f.emoji = el.dataset.v; renderSheet(); },
  'cat-save': () => {
    const s = topSheet();
    const f = s.form;
    const name = f.name.trim();
    if (!name) { shake($('[data-f="name"]', sheetEl)); toast('Введите название'); return; }
    const c = store.saveCategory({ id: s.id, name, emoji: f.emoji.trim() || '🏷️', kind: f.kind });
    closeSheet();
    if (s.fromTx && sheets.length) { topSheet().form.category = c.id; renderSheet(); }
    toast(s.id ? 'Категория сохранена' : 'Категория добавлена');
  },
  'cat-move': (el) => { store.moveCategory(topSheet().id, Number(el.dataset.d)); toast('Порядок изменён'); },
  'cat-archive': (el) => {
    const c = store.category(topSheet().id);
    const on = el.dataset.v === '1';
    store.setCategoryState(c.id, { archived: on }, `${on ? 'Категория в архиве' : 'Категория из архива'}: ${c.name}`);
    closeSheet();
  },
  'cat-delete': () => {
    const c = store.category(topSheet().id);
    store.setCategoryState(c.id, { deleted: true }, `Категория удалена: ${c.name}`);
    closeSheet();
    toast('Категория удалена');
  },

  // история
  'hist-pick': (el) => {
    const h = ui.hist;
    const what = el.dataset.what;
    if (what === 'period') {
      const po = periodOptions(h.period);
      pick('Период', po.options, po.value, (v) => {
        if (v === 'custom') openRange(h.period, (p) => histSet({ period: p }));
        else histSet({ period: po.resolve(v) });
      });
    } else if (what === 'type') {
      pick('Тип операции', [{ v: 'all', label: 'Все типы' }, ...Object.entries(TYPE_NAMES).map(([v, label]) => ({ v, label }))], h.type, (v) => histSet({ type: v }));
    } else if (what === 'account') {
      pick('Счёт', accountOptions('Все счета'), h.account, (v) => histSet({ account: v }));
    } else if (what === 'category') {
      const opts = [{ v: 'all', label: 'Все категории' }];
      for (const kind of ['expense', 'income']) {
        for (const c of store.categories(kind, { archived: true })) opts.push({ v: c.id, label: c.name, sub: (kind === 'expense' ? 'Расход' : 'Доход') + (c.archived ? ' · в архиве' : ''), icon: esc(c.emoji), iconCls: 'emoji' });
      }
      opts.push({ v: '_none', label: 'Без категории' });
      pick('Категория', opts, h.category, (v) => histSet({ category: v }));
    }
  },
  'hist-reset': () => { histSet({ q: '', type: 'all', account: 'all', category: 'all', period: { kind: 'all' } }); const q = $('[data-bind="hist-q"]'); if (q) q.value = ''; },
  'hist-shift': (el) => histSet({ period: U.shiftPeriod(ui.hist.period, Number(el.dataset.d)) }),
  'hist-more': () => { ui.hist.limit += 300; $('#hist-results').innerHTML = histResults(); },
  'home-cat': (el) => {
    Object.assign(ui.hist, { q: '', type: 'all', account: 'all', category: el.dataset.id, period: { kind: 'month', anchor: U.today() }, limit: 150 });
    go('history');
  },

  // статистика
  'st-kind': (el) => {
    const st = ui.stats;
    const k = el.dataset.v;
    st.sel = -1;
    if (k === 'custom') { openRange(st.period, (p) => { st.period = p; render(); }); return; }
    st.period = { kind: k, anchor: U.today() };
    render();
  },
  'st-shift': (el) => { ui.stats.period = U.shiftPeriod(ui.stats.period, Number(el.dataset.d)); ui.stats.sel = -1; render(); },
  'st-range': () => openRange(ui.stats.period, (p) => { ui.stats.period = p; ui.stats.sel = -1; render(); }),
  'st-mode': (el) => { ui.stats.mode = el.dataset.v; ui.stats.sel = -1; render(); },
  'st-acc': () => pick('Счёт', accountOptions('Все счета'), ui.stats.account, (v) => { ui.stats.account = v; ui.stats.sel = -1; render(); }),
  bar: (el) => { const i = Number(el.dataset.i); ui.stats.sel = ui.stats.sel === i ? -1 : i; render(); },
  'bar-clear': () => { ui.stats.sel = -1; render(); },
  'stat-cat': (el) => {
    const st = ui.stats;
    Object.assign(ui.hist, { q: '', type: el.dataset.type || st.mode, account: st.account, category: el.dataset.id, period: { ...st.period }, limit: 150 });
    go('history');
  },
  'stat-acc': (el) => {
    const st = ui.stats;
    Object.assign(ui.hist, { q: '', type: st.mode, account: el.dataset.id, category: 'all', period: { ...st.period }, limit: 150 });
    go('history');
  },

  // период
  'range-preset': (el) => {
    const s = topSheet();
    closeSheet();
    s.onApply({ kind: 'custom', from: el.dataset.from, to: el.dataset.to });
  },
  'range-apply': () => {
    const s = topSheet();
    let { from, to } = s.form;
    if (!from || !to) { toast('Выберите обе даты'); return; }
    if (from > to) [from, to] = [to, from];
    closeSheet();
    s.onApply({ kind: 'custom', from, to });
  },

  pick: (el) => { const s = topSheet(); closeSheet(); s.onPick(el.dataset.v); },

  // настройки
  'pick-currency': () => {
    const opts = CURRENCIES.map(([v, label]) => ({ v, label: `${v} — ${label}` }));
    opts.push({ v: '_other', label: 'Другая…' });
    pick('Валюта', opts, store.cur, (v) => {
      if (v === '_other') { const x = prompt('Обозначение валюты', store.cur); if (x && x.trim()) store.setCurrency(x.trim().slice(0, 6)); }
      else store.setCurrency(v);
    });
  },
  'pick-theme': () => pick('Тема', [{ v: 'auto', label: 'Как в системе' }, { v: 'light', label: 'Светлая' }, { v: 'dark', label: 'Тёмная' }], LS.get('theme', 'auto'), (v) => { LS.set('theme', v); applyTheme(); render(); }),
  'export-json': () => download(`budget-backup-${U.today()}.json`, serialize(store.data), 'application/json'),
  'export-csv': () => exportCsv(),
  'import-json': () => $('#import-file').click(),

  // облако
  'sync-now': () => cloud.sync(),
  'copy-link': async () => {
    if (!confirm('Ссылка содержит ваш токен доступа. Отправляйте её только себе (например, в «Избранное») и удалите сообщение после подключения. Скопировать?')) return;
    try { await navigator.clipboard.writeText(cloud.connectLink()); toast('Ссылка скопирована'); }
    catch { prompt('Скопируйте ссылку:', cloud.connectLink()); }
  },
  disconnect: () => {
    if (!confirm('Отключить облако на этом устройстве? Данные в облаке останутся, локальная копия тоже.')) return;
    cloud.disconnect();
    render();
  },
};

/* ---------- События ---------- */

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled) return;
  const fn = A[el.dataset.act];
  if (!fn) return;
  e.preventDefault();
  fn(el, e);
});

document.addEventListener('input', (e) => {
  const t = e.target;
  if (t.dataset.bind === 'hist-q') {
    ui.hist.q = t.value;
    ui.hist.limit = 150;
    $('#hist-results').innerHTML = histResults();
    $('#hist-chips').innerHTML = histChips();
    return;
  }
  const s = topSheet();
  if (!s || !t.dataset.f || !sheetEl.contains(t)) return;
  s.form[t.dataset.f] = t.value;
  if (t.dataset.f === 'amount') {
    const hint = $('#amt-hint', sheetEl);
    if (hint) hint.textContent = s.type === 'adjust' ? adjustHint(s) : amountHint(s.form);
  } else if (t.dataset.f === 'date' && s.type === 'tx') {
    const day = t.value.slice(0, 10);
    $$('[data-act="tx-day"]', sheetEl).forEach((c) => c.classList.toggle('on', day === U.ymd(U.addDays(new Date(), Number(c.dataset.d)))));
  } else if (t.dataset.f === 'emoji' && s.type === 'cat-edit') {
    $('.emoji-hero', sheetEl).textContent = t.value || '•';
  } else if (t.dataset.f === 'name' && s.type === 'acc-edit') {
    $('.acc-name', sheetEl).textContent = t.value || 'Новый счёт';
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.id === 'amt') { e.preventDefault(); e.target.blur(); }
  if (e.key === 'Escape' && sheets.length) closeSheet();
});

document.addEventListener('submit', async (e) => {
  if (e.target.id !== 'cloud-form') return;
  e.preventDefault();
  const fd = new FormData(e.target);
  const [owner, repo] = String(fd.get('username') || '').trim().replace(/^https?:\/\/github\.com\//, '').split('/');
  const token = String(fd.get('password') || '').trim();
  const path = String(fd.get('path') || 'budget.json').trim() || 'budget.json';
  const errEl = $('#cloud-error');
  const btn = e.target.querySelector('[type="submit"]');
  if (!owner || !repo || !token) { errEl.hidden = false; errEl.textContent = 'Заполните репозиторий (владелец/имя) и токен'; return; }
  btn.disabled = true;
  btn.textContent = 'Подключаю…';
  try {
    const { found } = await cloud.connect({ owner, repo, path, token });
    render();
    toast(found ? 'Подключено — данные загружены из облака' : 'Подключено — данные сохранены в облако');
  } catch (err) {
    errEl.hidden = false;
    errEl.textContent = err.message || String(err);
    btn.disabled = false;
    btn.textContent = 'Подключить';
  }
});

$('#import-file').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    const n = (data.transactions || []).filter((t) => !t.deleted).length;
    if (!confirm(`В файле ${n} ${U.plural(n, 'операция', 'операции', 'операций')}. Объединить с текущими данными? Ничего не удалится — записи из файла добавятся или обновятся.`)) return;
    store.importMerge(data);
    toast('Данные загружены');
  } catch (err) {
    alert('Не удалось прочитать файл: ' + (err.message || err));
  }
});

function applyTheme() {
  const t = LS.get('theme', 'auto');
  if (t === 'auto') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = t;
  const forced = t === 'dark' ? '#0f0f10' : t === 'light' ? '#f5f5f2' : null;
  $$('meta[name="theme-color"]').forEach((m) => {
    if (!m.dataset.orig) m.dataset.orig = m.content;
    m.content = forced || m.dataset.orig;
  });
}

function refreshSyncBadges() {
  $$('.sync').forEach((el) => { el.outerHTML = syncBadge(); });
}

/* ---------- Запуск ---------- */

store.load();
cloud.load();
applyTheme();

store.onCommit = () => { if (cloud.connected) scheduleSync(); };
store.subscribe(() => {
  render();
  const s = topSheet();
  if (s?.live) renderSheet();
});
cloud.subscribe(() => {
  refreshSyncBadges();
  if (ui.route.name === 'more' || (ui.route.name === 'home' && (cloud.status === 'error' || cloud.status === 'ok'))) render();
});

function connectFromLink(cfg) {
  history.replaceState(null, '', location.pathname + '#/more/cloud');
  ui.route = parseRoute();
  render();
  cloud.connect(cfg)
    .then(({ found }) => { render(); toast(found ? 'Облако подключено — данные загружены' : 'Облако подключено'); })
    .catch((err) => { render(); alert('Не удалось подключить облако по ссылке: ' + err.message); });
}

const linkCfg = cloud.parseConnectLink(location.hash);
if (linkCfg) history.replaceState(null, '', location.pathname + '#/more/cloud');

ui.route = parseRoute();
render();

window.addEventListener('hashchange', () => {
  const cfg = cloud.parseConnectLink(location.hash);
  if (cfg) { connectFromLink(cfg); return; }
  const prev = ui.route.name + ui.route.sub.join('/');
  ui.route = parseRoute();
  if (sheets.length) { sheets.length = 0; closeSheet(); }
  render();
  if (prev !== ui.route.name + ui.route.sub.join('/')) window.scrollTo(0, 0);
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    if (cloud.connected && Date.now() - (store.meta.lastSync || 0) > 10000) cloud.sync();
    if (!sheets.length) render();
  } else if (cloud.connected && store.meta.dirty) {
    scheduleSync.flush();
  }
});
window.addEventListener('online', () => { if (cloud.connected) cloud.sync(); });

if (linkCfg) {
  connectFromLink(linkCfg);
} else if (cloud.connected) {
  cloud.sync();
}

if (store.storageError) toast('Не удалось сохранить на устройстве — проверьте свободное место');
navigator.storage?.persist?.().catch(() => {});

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('./sw.js').catch((e) => console.warn('sw', e));
}
