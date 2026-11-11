// Синхронизация с GitHub: данные лежат JSON-файлом в приватном репозитории.
// Каждое сохранение — отдельный коммит, поэтому вся история изменений хранится в git
// и любую прошлую версию можно восстановить.

import { store, serialize } from './store.js';
import { DEFAULT_CLOUD } from './config.js';
import { debounce, plural } from './util.js';

const CFG_KEY = 'budget.v1.cloud';
const API = 'https://api.github.com';

class SyncError extends Error {
  constructor(kind, message, status) { super(message); this.kind = kind; this.status = status; }
}

function b64encode(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

function b64decode(b64) {
  const bin = atob(b64.replace(/\s/g, ''));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

const encPath = (p) => p.split('/').map(encodeURIComponent).join('/');

export const cloud = {
  cfg: null, // { owner, repo, path, token }
  status: 'off', // off | idle | syncing | ok | offline | error
  error: '',
  listeners: new Set(),
  running: false,
  again: false,

  load() {
    try { this.cfg = JSON.parse(localStorage.getItem(CFG_KEY)); } catch { this.cfg = null; }
    if (this.cfg && !this.cfg.token) this.cfg = null;
    this.status = this.cfg ? 'idle' : 'off';
  },

  get connected() { return !!this.cfg; },
  get defaults() { return { ...DEFAULT_CLOUD, ...(this.cfg || {}) }; },
  get repoUrl() { const c = this.defaults; return `https://github.com/${c.owner}/${c.repo}`; },
  get historyUrl() { const c = this.defaults; return `https://github.com/${c.owner}/${c.repo}/commits/HEAD/${c.path}`; },

  subscribe(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); },
  set(status, error = '') { this.status = status; this.error = error; for (const fn of this.listeners) fn(); },

  async api(path, opts = {}, cfg = this.cfg) {
    let res;
    // Плохая сеть не должна подвешивать синхронизацию навсегда
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 20000);
    try {
      res = await fetch(API + path, {
        ...opts,
        cache: 'no-store',
        signal: ctrl.signal,
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${cfg.token}`,
          ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
        },
      });
    } catch {
      throw new SyncError('offline', 'Нет соединения с интернетом');
    } finally {
      clearTimeout(timer);
    }
    if (res.status === 401) throw new SyncError('auth', 'Токен недействителен или истёк — создайте новый', 401);
    if (res.status === 403) {
      const j = await res.json().catch(() => ({}));
      if (/rate limit/i.test(j.message || '')) throw new SyncError('error', 'Превышен лимит запросов GitHub, попробуйте позже', 403);
      throw new SyncError('auth', 'У токена нет права записи. Нужно разрешение Contents: Read and write', 403);
    }
    return res;
  },

  async getFile(cfg = this.cfg) {
    const res = await this.api(`/repos/${cfg.owner}/${cfg.repo}/contents/${encPath(cfg.path)}`, {}, cfg);
    if (res.status === 404) return null;
    if (!res.ok) throw new SyncError('error', `GitHub ответил ${res.status}`, res.status);
    const j = await res.json();
    let b64 = j.content;
    // Файлы больше 1 МБ API отдаёт без содержимого — тогда читаем blob по sha
    if (!b64 && j.sha) {
      const rb = await this.api(`/repos/${cfg.owner}/${cfg.repo}/git/blobs/${j.sha}`, {}, cfg);
      if (!rb.ok) throw new SyncError('error', `GitHub ответил ${rb.status}`, rb.status);
      b64 = (await rb.json()).content;
    }
    let data;
    try { data = JSON.parse(b64decode(b64 || '')); } catch { throw new SyncError('error', 'Файл в облаке повреждён — проверьте историю коммитов'); }
    return { sha: j.sha, data };
  },

  async putFile(sha, message) {
    const { owner, repo, path } = this.cfg;
    const body = { message, content: b64encode(serialize(store.data)) };
    if (sha) body.sha = sha;
    const res = await this.api(`/repos/${owner}/${repo}/contents/${encPath(path)}`, { method: 'PUT', body: JSON.stringify(body) });
    if (res.status === 409 || res.status === 422) throw new SyncError('conflict', 'Конфликт версий', res.status);
    if (res.status === 404) throw new SyncError('auth', 'Репозиторий не найден или у токена нет к нему доступа', 404);
    if (!res.ok) throw new SyncError('error', `GitHub ответил ${res.status}`, res.status);
    return (await res.json()).content.sha;
  },

  commitMessage() {
    const msgs = store.meta.messages;
    if (!msgs.length) return 'Синхронизация данных';
    if (msgs.length === 1) return msgs[0];
    const head = `${msgs.length} ${plural(msgs.length, 'изменение', 'изменения', 'изменений')}: ${msgs[msgs.length - 1]}`;
    return head + '\n\n' + msgs.map((m) => '- ' + m).join('\n');
  },

  async push(sha) {
    const v = store.version;
    const sent = store.meta.messages.length;
    const newSha = await this.putFile(sha, this.commitMessage());
    store.meta.sha = newSha;
    if (store.version === v) {
      store.meta.dirty = false;
      store.meta.messages = [];
    } else {
      // Пока шла отправка, пользователь успел что-то изменить — отправим следующим заходом
      store.meta.messages = store.meta.messages.slice(sent);
      this.again = true;
    }
  },

  async sync() {
    if (!this.cfg) return;
    if (this.running) { this.again = true; return; }
    this.running = true;
    this.set('syncing');
    try {
      let forcePull = false;
      for (let attempt = 0; ; attempt++) {
        try {
          if (store.meta.dirty && store.meta.sha && !forcePull) {
            await this.push(store.meta.sha);
          } else {
            const remote = await this.getFile();
            if (!remote) {
              await this.push(null);
            } else if (remote.sha !== store.meta.sha) {
              const localAhead = store.applyRemote(remote.data, remote.sha);
              if (localAhead || store.meta.dirty) await this.push(remote.sha);
            } else if (store.meta.dirty) {
              await this.push(remote.sha);
            }
          }
          break;
        } catch (e) {
          if (e.kind === 'conflict' && attempt < 3) { forcePull = true; await new Promise((r) => setTimeout(r, 400 * (attempt + 1))); continue; }
          throw e;
        }
      }
      store.meta.lastSync = Date.now();
      store.persistMeta();
      this.set('ok');
    } catch (e) {
      console.warn('sync', e);
      this.set(e.kind === 'offline' ? 'offline' : 'error', e.message || String(e));
    } finally {
      this.running = false;
      if (this.again) { this.again = false; setTimeout(() => this.sync(), 300); }
    }
  },

  // Проверка доступа и первое подключение на устройстве
  async connect(cfg) {
    const res = await this.api(`/repos/${cfg.owner}/${cfg.repo}`, {}, cfg);
    if (res.status === 404) throw new SyncError('auth', 'Репозиторий не найден или у токена нет к нему доступа');
    if (!res.ok) throw new SyncError('error', `GitHub ответил ${res.status}`);
    const remote = await this.getFile(cfg);
    this.cfg = cfg;
    localStorage.setItem(CFG_KEY, JSON.stringify(cfg));
    if (remote) store.applyRemote(remote.data, remote.sha);
    else store.meta.sha = null;
    store.persistMeta();
    await this.sync();
    return { found: !!remote };
  },

  disconnect() {
    this.cfg = null;
    localStorage.removeItem(CFG_KEY);
    store.meta.sha = null;
    store.persistMeta();
    this.set('off');
  },

  // Ссылка для подключения другого устройства (токен в #фрагменте не уходит на сервер)
  connectLink() {
    const payload = btoa(JSON.stringify(this.cfg)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    return `${location.origin}${location.pathname}#connect=${payload}`;
  },

  parseConnectLink(hash) {
    const m = /#connect=([\w-]+)/.exec(hash || '');
    if (!m) return null;
    try {
      const cfg = JSON.parse(atob(m[1].replace(/-/g, '+').replace(/_/g, '/')));
      return cfg && cfg.token && cfg.owner && cfg.repo ? { path: DEFAULT_CLOUD.path, ...cfg } : null;
    } catch { return null; }
  },
};

export const scheduleSync = debounce(() => cloud.sync(), 1200);
