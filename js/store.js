// Модель данных и локальное хранилище.
//
// Баланс счёта не хранится, а считается: начальный баланс + все операции.
// Поэтому правка или удаление любой операции сразу корректно меняет баланс.
// Каждая запись имеет id и updatedAt — это позволяет сливать данные с разных
// устройств без потерь (побеждает более свежая версия записи).
// Удалённые записи остаются «надгробиями» (deleted: true), чтобы удаление тоже синхронизировалось.

import { uid, nowLocal, money } from './util.js';

const DATA_KEY = 'budget.v1.data';
const META_KEY = 'budget.v1.meta';
const BACKUP_KEY = 'budget.v1.backup';

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
    settings: { currency: '₽', updatedAt: 0 },
    accounts: [
      { id: 'acc-card', name: 'Карта', type: 'card', color: 'indigo', initial: 0, archived: false, order: 0, updatedAt: 0 },
      { id: 'acc-cash', name: 'Наличные', type: 'cash', color: 'green', initial: 0, archived: false, order: 1, updatedAt: 0 },
    ],
    categories: SEED_CATEGORIES.map(([id, kind, name, emoji], i) => ({
      id: 'cat-' + id, kind, name, emoji, archived: false, order: i, updatedAt: 0,
    })),
    transactions: [],
  };
}

export function normalize(d) {
  if (!d || typeof d !== 'object') throw new Error('Неверный формат данных');
  const arr = (x) => (Array.isArray(x) ? x.filter((r) => r && typeof r.id === 'string') : []);
  return {
    schema: d.schema || 1,
    settings: { currency: '₽', updatedAt: 0, ...(d.settings || {}) },
    accounts: arr(d.accounts),
    categories: arr(d.categories),
    transactions: arr(d.transactions),
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
    `"transactions": ${list([...d.transactions].sort(txSort))}`,
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

  get cur() { return this.data.settings.currency || '₽'; },

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
};
