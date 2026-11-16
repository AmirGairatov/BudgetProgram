// Модель данных и локальное хранилище.
//
// Баланс счёта не хранится, а считается: начальный баланс + все операции.
// Поэтому правка или удаление любой операции сразу корректно меняет баланс.
// Каждая запись имеет id и updatedAt — это позволяет сливать данные с разных
// устройств без потерь (побеждает более свежая версия записи).
// Удалённые записи остаются «надгробиями» (deleted: true), чтобы удаление тоже синхронизировалось.

import { uid, nowLocal, money, parseYmd, ymd, addDays } from './util.js';

const DATA_KEY = 'budget.v1.data';
const META_KEY = 'budget.v1.meta';
const BACKUP_KEY = 'budget.v1.backup';
const DEFAULT_CURRENCY = 'UZS';

export const ACCOUNT_COLORS = {
  indigo: ['#4338CA', '#6D63F2'],
  graphite: ['#24262C', '#4F535E'],
  emerald: ['#0B6B53', '#14A47A'],
  ocean: ['#075985', '#2B9BD8'],
  plum: ['#6B21A8', '#C0347E'],
  coral: ['#C2410C', '#F08A4B'],
  gold: ['#8A5A00', '#D9A21B'],
  ruby: ['#9F1239', '#E04F5F'],
  green: ['#1F6B3A', '#3FA05F'],
};

const SEED_CATEGORIES = [
  ['food', 'expense', 'Продукты', '🛒'],
  ['cafe', 'expense', 'Кафе и рестораны', '🍽️'],
  ['transport', 'expense', 'Транспорт', '🚕'],
  ['home', 'expense', 'Дом и ЖКХ', '🏠'],
  ['phone', 'expense', 'Связь и интернет', '📱'],
  ['health', 'expense', 'Здоровье', '💊'],
  ['clothes', 'expense', 'Одежда', '👕'],
  ['beauty', 'expense', 'Красота', '💅'],
  ['fun', 'expense', 'Развлечения', '🎬'],
  ['subs', 'expense', 'Подписки', '🔁'],
  ['gifts', 'expense', 'Подарки', '🎁'],
  ['edu', 'expense', 'Образование', '📚'],
  ['travel', 'expense', 'Путешествия', '✈️'],
  ['other', 'expense', 'Другое', '📦'],
  ['salary', 'income', 'Зарплата', '💼'],
  ['side', 'income', 'Подработка', '💻'],
  ['gift-in', 'income', 'Подарки', '🎁'],
  ['cashback', 'income', 'Кэшбэк', '💸'],
  ['interest', 'income', 'Проценты', '🏦'],
  ['other-in', 'income', 'Другое', '✨'],
];

// Начальные записи имеют фиксированные id и updatedAt = 0:
// при подключении второго устройства они не задвоятся, а любая правка их перекроет.
export function seedData() {
  return {
    schema: 1,
    settings: { currency: DEFAULT_CURRENCY, updatedAt: 0 },
    accounts: [
      { id: 'acc-card', name: 'Карта', type: 'card', color: 'indigo', initial: 0, archived: false, order: 0, updatedAt: 0 },
      { id: 'acc-cash', name: 'Наличные', type: 'cash', color: 'green', initial: 0, archived: false, order: 1, updatedAt: 0 },
    ],
    categories: SEED_CATEGORIES.map(([id, kind, name, emoji], i) => ({
      id: 'cat-' + id, kind, name, emoji, archived: false, order: i, updatedAt: 0,
    })),
    transactions: [],
    plans: [],
  };
}

export function normalize(d) {
  if (!d || typeof d !== 'object') throw new Error('Неверный формат данных');
  const arr = (x) => (Array.isArray(x) ? x.filter((r) => r && typeof r.id === 'string') : []);
  const settings = { currency: DEFAULT_CURRENCY, updatedAt: 0, ...(d.settings || {}) };
  // Валюта по умолчанию раньше была ₽; если её никто не выбирал вручную — переводим на UZS
  if (!settings.updatedAt) settings.currency = DEFAULT_CURRENCY;
  return {
    schema: d.schema || 1,
    settings,
    accounts: arr(d.accounts),
    categories: arr(d.categories),
    transactions: arr(d.transactions),
    plans: arr(d.plans),
  };
}

/* ---------- Слияние ---------- */

function mergeList(local, remote, stats) {
  const map = new Map(local.map((r) => [r.id, r]));
  const remoteIds = new Set();
  for (const r of remote) {
    remoteIds.add(r.id);
    const cur = map.get(r.id);
    if (!cur) { map.set(r.id, r); stats.remoteAhead = true; continue; }
    const lu = cur.updatedAt || 0, ru = r.updatedAt || 0;
    if (ru > lu) { map.set(r.id, r); stats.remoteAhead = true; }
    else if (lu > ru) stats.localAhead = true;
  }
  for (const r of local) if (!remoteIds.has(r.id)) stats.localAhead = true;
  return [...map.values()];
}

export function merge(local, remote) {
  const stats = { localAhead: false, remoteAhead: false };
  const ls = local.settings || {}, rs = remote.settings || {};
  let settings = ls;
  if ((rs.updatedAt || 0) > (ls.updatedAt || 0)) { settings = rs; stats.remoteAhead = true; }
  else if ((ls.updatedAt || 0) > (rs.updatedAt || 0)) stats.localAhead = true;
  const data = {
    schema: Math.max(local.schema || 1, remote.schema || 1),
    settings,
    accounts: mergeList(local.accounts, remote.accounts, stats),
    categories: mergeList(local.categories, remote.categories, stats),
    transactions: mergeList(local.transactions, remote.transactions, stats),
    plans: mergeList(local.plans || [], remote.plans || [], stats),
  };
  return { data, ...stats };
}

/* ---------- Сериализация ---------- */

const txSort = (a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : (a.createdAt || 0) - (b.createdAt || 0));

// По одной записи на строку — чтобы в истории коммитов на GitHub были читаемые диффы.
export function serialize(d) {
  const list = (arr) => (arr.length ? '[\n' + arr.map((r) => '  ' + JSON.stringify(r)).join(',\n') + '\n]' : '[]');
  return [
    '{',
    `"schema": ${d.schema || 1},`,
    `"settings": ${JSON.stringify(d.settings)},`,
    `"accounts": ${list(d.accounts)},`,
    `"categories": ${list(d.categories)},`,
    `"transactions": ${list([...d.transactions].sort(txSort))},`,
    `"plans": ${list(d.plans || [])}`,
    '}',
    '',
  ].join('\n');
}

/* ---------- Хранилище ---------- */

const read = (key) => { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } };

export const store = {
  data: null,
  // sha — версия файла в облаке, с которой мы синхронизированы;
  // dirty — есть локальные изменения, ещё не отправленные в облако;
  // pristine — пользователь ещё ничего не вводил на этом устройстве.
  meta: { sha: null, dirty: false, pristine: true, messages: [], lastSync: 0 },
  version: 0,
  listeners: new Set(),
  storageError: false,

  load() {
    const d = read(DATA_KEY);
    this.data = d ? normalize(d) : seedData();
    this.meta = { ...this.meta, ...(read(META_KEY) || {}) };
    if (!Array.isArray(this.meta.messages)) this.meta.messages = [];
  },

  persist() {
    try {
      localStorage.setItem(DATA_KEY, JSON.stringify(this.data));
      localStorage.setItem(META_KEY, JSON.stringify(this.meta));
      this.storageError = false;
    } catch (e) {
      this.storageError = true;
      console.error('localStorage', e);
    }
  },

  persistMeta() {
    try { localStorage.setItem(META_KEY, JSON.stringify(this.meta)); } catch { /* облако остаётся источником истины */ }
  },

  subscribe(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); },
  emit() { this.version++; this._cache = null; for (const fn of this.listeners) fn(); },

  // Любое изменение пользователя проходит через commit: сохранить локально и пометить к отправке.
  commit(message) {
    this.meta.dirty = true;
    this.meta.pristine = false;
    this.meta.messages.push(message);
    if (this.meta.messages.length > 30) this.meta.messages = this.meta.messages.slice(-30);
    this.persist();
    this.emit();
    this.onCommit?.();
  },

  // Снимок перед заменой/слиянием с облаком — последняя страховка на устройстве.
  backupLocal() {
    try { localStorage.setItem(BACKUP_KEY, JSON.stringify({ at: Date.now(), data: this.data })); } catch { /* ignore */ }
  },

  // Применить данные из облака. Возвращает, есть ли у нас то, чего нет в облаке.
  applyRemote(remoteData, sha) {
    const remote = normalize(remoteData);
    this.backupLocal();
    let localAhead;
    if (this.meta.pristine && !this.meta.dirty) {
      this.data = remote;
      localAhead = false;
    } else {
      const res = merge(this.data, remote);
      this.data = res.data;
      localAhead = res.localAhead;
      if (localAhead) this.meta.dirty = true;
    }
    this.meta.sha = sha;
    if (this.data.transactions.length) this.meta.pristine = false;
    this.persist();
    this.emit();
    return localAhead;
  },

  replaceAll(data) {
    this.backupLocal();
    this.data = normalize(data);
    this.commit('Импорт данных');
  },

  importMerge(data) {
    this.backupLocal();
    this.data = merge(this.data, normalize(data)).data;
    this.commit('Импорт данных (слияние)');
  },

  /* ---------- Выборки ---------- */

  get cur() { return this.data.settings.currency || DEFAULT_CURRENCY; },

  cached(key, fn) {
    if (!this._cache) this._cache = {};
    if (!(key in this._cache)) this._cache[key] = fn();
    return this._cache[key];
  },

  // Все живые операции, новые сверху
  txs() {
    return this.cached('txs', () =>
      this.data.transactions.filter((t) => !t.deleted).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : (b.createdAt || 0) - (a.createdAt || 0))));
  },

  accounts({ archived = false } = {}) {
    return this.data.accounts
      .filter((a) => !a.deleted && (archived || !a.archived))
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name));
  },

  account(id) { return this.data.accounts.find((a) => a.id === id); },

  categories(kind, { archived = false } = {}) {
    return this.data.categories
      .filter((c) => !c.deleted && c.kind === kind && (archived || !c.archived))
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  },

  category(id) { return this.data.categories.find((c) => c.id === id); },

  balances() {
    return this.cached('balances', () => {
      const b = {};
      for (const a of this.data.accounts) b[a.id] = a.initial || 0;
      for (const t of this.data.transactions) {
        if (t.deleted) continue;
        const amt = t.amount || 0;
        if (t.type === 'expense') { if (t.account in b) b[t.account] -= amt; }
        else if (t.type === 'income' || t.type === 'adjust') { if (t.account in b) b[t.account] += amt; }
        else if (t.type === 'transfer') {
          if (t.account in b) b[t.account] -= amt;
          if (t.to in b) b[t.to] += amt;
        }
      }
      return b;
    });
  },

  usage(field, id) { return this.data.transactions.some((t) => !t.deleted && (t[field] === id || (field === 'account' && t.to === id))); },

  /* ---------- Изменения ---------- */

  describeTx(t) {
    const cur = this.cur;
    const acc = (id) => this.account(id)?.name || '?';
    const cat = this.category(t.category)?.name || 'Без категории';
    switch (t.type) {
      case 'expense': return `Расход ${money(t.amount, cur)} · ${cat} · ${acc(t.account)}`;
      case 'income': return `Доход ${money(t.amount, cur)} · ${cat} · ${acc(t.account)}`;
      case 'transfer': return `Перевод ${money(t.amount, cur)} · ${acc(t.account)} → ${acc(t.to)}`;
      case 'adjust': return `Корректировка ${money(t.amount, cur, 'always')} · ${acc(t.account)}`;
    }
    return 'Операция';
  },

  saveTx(input) {
    const now = Date.now();
    const fields = {
      type: input.type,
      amount: input.amount,
      account: input.account,
      to: input.type === 'transfer' ? input.to : undefined,
      category: input.type === 'expense' || input.type === 'income' ? input.category || null : undefined,
      note: (input.note || '').trim() || undefined,
      date: input.date || nowLocal(),
    };
    let tx = input.id && this.data.transactions.find((t) => t.id === input.id);
    if (tx) {
      for (const k of ['to', 'category', 'note']) delete tx[k];
      Object.assign(tx, fields, { updatedAt: now });
      for (const k of Object.keys(tx)) if (tx[k] === undefined) delete tx[k];
      this.commit('Изменено: ' + this.describeTx(tx));
    } else {
      tx = { id: uid(), ...fields, createdAt: now, updatedAt: now };
      for (const k of Object.keys(tx)) if (tx[k] === undefined) delete tx[k];
      this.data.transactions.push(tx);
      this.commit(this.describeTx(tx));
    }
    return tx;
  },

  setTxDeleted(id, deleted) {
    const tx = this.data.transactions.find((t) => t.id === id);
    if (!tx) return;
    tx.deleted = deleted || undefined;
    if (!deleted) delete tx.deleted;
    tx.updatedAt = Date.now();
    this.commit((deleted ? 'Удалено: ' : 'Восстановлено: ') + this.describeTx(tx));
  },

  adjustBalance(accountId, actual, note) {
    const delta = actual - (this.balances()[accountId] || 0);
    if (!delta) return null;
    return this.saveTx({ type: 'adjust', amount: delta, account: accountId, note: note || 'Корректировка баланса' });
  },

  saveAccount(input) {
    const now = Date.now();
    let a = input.id && this.data.accounts.find((x) => x.id === input.id);
    if (a) {
      Object.assign(a, { name: input.name, type: input.type, color: input.color, initial: input.initial, updatedAt: now });
      this.commit(`Счёт изменён: ${a.name}`);
    } else {
      const order = Math.max(-1, ...this.data.accounts.map((x) => x.order ?? 0)) + 1;
      a = { id: uid(), name: input.name, type: input.type, color: input.color, initial: input.initial || 0, archived: false, order, updatedAt: now };
      this.data.accounts.push(a);
      this.commit(`Новый счёт: ${a.name}`);
    }
    return a;
  },

  setAccountState(id, patch, message) {
    const a = this.account(id);
    if (!a) return;
    Object.assign(a, patch, { updatedAt: Date.now() });
    this.commit(message);
  },

  moveAccount(id, dir) {
    const list = this.accounts({ archived: true });
    const i = list.findIndex((a) => a.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    const now = Date.now();
    list.forEach((a, k) => { if (a.order !== k) { a.order = k; a.updatedAt = now; } });
    this.commit('Порядок счетов');
  },

  saveCategory(input) {
    const now = Date.now();
    let c = input.id && this.data.categories.find((x) => x.id === input.id);
    if (c) {
      Object.assign(c, { name: input.name, emoji: input.emoji, updatedAt: now });
      this.commit(`Категория изменена: ${c.emoji} ${c.name}`);
    } else {
      const order = Math.max(-1, ...this.data.categories.map((x) => x.order ?? 0)) + 1;
      c = { id: uid(), kind: input.kind, name: input.name, emoji: input.emoji, archived: false, order, updatedAt: now };
      this.data.categories.push(c);
      this.commit(`Новая категория: ${c.emoji} ${c.name}`);
    }
    return c;
  },

  setCategoryState(id, patch, message) {
    const c = this.category(id);
    if (!c) return;
    Object.assign(c, patch, { updatedAt: Date.now() });
    this.commit(message);
  },

  moveCategory(id, dir) {
    const c = this.category(id);
    if (!c) return;
    const list = this.categories(c.kind, { archived: true });
    const i = list.findIndex((x) => x.id === id);
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    const now = Date.now();
    list.forEach((x, k) => { if (x.order !== k) { x.order = k; x.updatedAt = now; } });
    this.commit('Порядок категорий');
  },

  setCurrency(currency) {
    this.data.settings = { ...this.data.settings, currency, updatedAt: Date.now() };
    this.commit(`Валюта: ${currency}`);
  },

  /* ---------- Планы ---------- */
  // План — «фантомная» операция: на баланс не влияет, пока не подтверждена.
  // { id, type: 'expense'|'income', title, amount (0 — просто заметка), account?, category?,
  //   due?: 'YYYY-MM-DD', repeat: 'none'|'week'|'month'|'year', day? (число месяца для повтора),
  //   note?, done?, doneAt?, txId?, createdAt, updatedAt, deleted? }

  plan(id) { return this.data.plans.find((p) => p.id === id); },

  // Активные планы: с датой — по сроку, без даты — в конце
  activePlans() {
    return this.cached('plans', () => this.data.plans.filter((p) => !p.deleted && !p.done).sort((a, b) => {
      if (a.due && b.due) return a.due < b.due ? -1 : a.due > b.due ? 1 : (a.createdAt || 0) - (b.createdAt || 0);
      if (a.due || b.due) return a.due ? -1 : 1;
      return (a.createdAt || 0) - (b.createdAt || 0);
    }));
  },

  donePlans() {
    return this.data.plans.filter((p) => !p.deleted && p.done).sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0));
  },

  // Сколько останется на счетах после планов (необязательно — только со сроком до `until`)
  projection(until) {
    const bal = this.balances();
    const accs = this.accounts();
    const active = new Set(accs.map((a) => a.id));
    const now = accs.reduce((s, a) => s + (bal[a.id] || 0), 0);
    const byAcc = {};
    let exp = 0, inc = 0;
    for (const p of this.activePlans()) {
      if (!p.amount || (until && p.due && p.due > until)) continue;
      const signed = p.type === 'income' ? p.amount : -p.amount;
      if (p.type === 'income') inc += p.amount; else exp += p.amount;
      if (p.account && active.has(p.account)) byAcc[p.account] = (byAcc[p.account] || 0) + signed;
    }
    return { now, exp, inc, after: now - exp + inc, byAcc };
  },

  describePlan(p) {
    const amt = p.amount ? ` ${money(p.type === 'income' ? p.amount : -p.amount, this.cur, 'always')}` : '';
    return `${p.title}${amt}`;
  },

  savePlan(input) {
    const now = Date.now();
    const fields = {
      type: input.type,
      title: input.title,
      amount: input.amount || 0,
      account: input.account || undefined,
      category: input.category || undefined,
      due: input.due || undefined,
      repeat: input.repeat && input.repeat !== 'none' ? input.repeat : undefined,
      note: (input.note || '').trim() || undefined,
    };
    fields.day = fields.repeat && fields.due ? Number(fields.due.slice(8, 10)) : undefined;
    let p = input.id && this.plan(input.id);
    if (p) {
      for (const k of ['account', 'category', 'due', 'repeat', 'note', 'day']) delete p[k];
      Object.assign(p, fields, { updatedAt: now });
      for (const k of Object.keys(p)) if (p[k] === undefined) delete p[k];
      this.commit('План изменён: ' + this.describePlan(p));
    } else {
      p = { id: uid(), ...fields, createdAt: now, updatedAt: now };
      for (const k of Object.keys(p)) if (p[k] === undefined) delete p[k];
      this.data.plans.push(p);
      this.commit('Новый план: ' + this.describePlan(p));
    }
    return p;
  },

  // План выполнен. Повторяющийся план остаётся и переносится на следующий срок,
  // а в «Выполнено» попадает его копия.
  completePlan(id, txId) {
    const p = this.plan(id);
    if (!p) return;
    const now = Date.now();
    if (p.repeat) {
      const { id: _id, repeat, day, ...rest } = p;
      const copy = { ...rest, id: uid(), done: true, doneAt: now, createdAt: now, updatedAt: now };
      if (txId) copy.txId = txId;
      this.data.plans.push(copy);
      p.due = nextDue(p.due || nowLocal().slice(0, 10), p.repeat, p.day);
      p.updatedAt = now;
    } else {
      Object.assign(p, { done: true, doneAt: now, updatedAt: now });
      if (txId) p.txId = txId;
    }
    this.commit('План выполнен: ' + this.describePlan(p));
  },

  reopenPlan(id) {
    const p = this.plan(id);
    if (!p) return;
    delete p.done; delete p.doneAt; delete p.txId;
    p.updatedAt = Date.now();
    this.commit('План снова активен: ' + this.describePlan(p));
  },

  setPlanDeleted(id, deleted) {
    const p = this.plan(id);
    if (!p) return;
    if (deleted) p.deleted = true; else delete p.deleted;
    p.updatedAt = Date.now();
    this.commit((deleted ? 'План удалён: ' : 'План восстановлен: ') + this.describePlan(p));
  },
};

// Следующий срок повторяющегося плана. Для «каждый месяц» держим исходное число:
// план на 31-е в коротком месяце встанет на последний день, а потом вернётся на 31-е.
export function nextDue(due, repeat, day) {
  const d = parseYmd(due);
  if (repeat === 'week') return ymd(addDays(d, 7));
  const months = repeat === 'year' ? 12 : 1;
  const first = new Date(d.getFullYear(), d.getMonth() + months, 1);
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  return ymd(new Date(first.getFullYear(), first.getMonth(), Math.min(day || d.getDate(), last)));
}
